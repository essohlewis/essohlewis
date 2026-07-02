<?php

namespace Database\Seeders;

use App\Enums\FixtureStatus;
use App\Enums\KycStatus;
use App\Enums\Market;
use App\Enums\TipsterStatus;
use App\Enums\Visibility;
use App\Models\Competition;
use App\Models\Fixture;
use App\Models\Prediction;
use App\Models\Sport;
use App\Models\Team;
use App\Models\User;
use App\Models\Wallet;
use App\Services\SettlementService;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $football = Sport::create(['name' => 'Football', 'slug' => 'football']);

        $ligue1 = Competition::create([
            'sport_id' => $football->id,
            'name' => 'Ligue 1 (Côte d\'Ivoire)',
            'country_code' => 'CI',
        ]);

        $names = ['ASEC Mimosas', 'Africa Sports', 'Stade d\'Abidjan', 'SOL FC', 'Sporting Gagnoa', 'San Pedro'];
        $teams = collect($names)->map(fn ($n) => Team::create([
            'sport_id' => $football->id,
            'name' => $n,
        ]));

        // A verified, approved tipster.
        $tipster = User::create([
            'phone' => '+2250700000001',
            'phone_verified_at' => now(),
            'display_name' => 'Koffi Pronos',
            'bio' => 'Spécialiste Ligue 1 CI. Value betting, discipline, transparence.',
            'country_code' => 'CI',
            'tipster_status' => TipsterStatus::Approved,
            'kyc_status' => KycStatus::Verified,
        ]);
        Wallet::create(['user_id' => $tipster->id]);

        // A consumer with a funded wallet.
        $consumer = User::create([
            'phone' => '+2250700000002',
            'phone_verified_at' => now(),
            'display_name' => 'Awa',
            'country_code' => 'CI',
        ]);
        Wallet::create(['user_id' => $consumer->id, 'balance_cents' => 2_000_000]); // 20 000 XOF

        $settlement = app(SettlementService::class);

        // 40 settled past fixtures to build a real track record + reliability score.
        for ($i = 0; $i < 40; $i++) {
            $home = $teams->random();
            $away = $teams->reject(fn ($t) => $t->id === $home->id)->random();

            $fixture = Fixture::create([
                'competition_id' => $ligue1->id,
                'home_team_id' => $home->id,
                'away_team_id' => $away->id,
                'external_ref' => 'past-'.$i,
                'kickoff_at' => Carbon::now()->subDays(60 - $i),
                'status' => FixtureStatus::Scheduled,
            ]);

            $homeGoals = random_int(0, 3);
            $awayGoals = random_int(0, 3);

            // Tipster backs the home side ~65% of the time at plausible odds.
            $backsHome = random_int(1, 100) <= 65;
            Prediction::create([
                'tipster_id' => $tipster->id,
                'fixture_id' => $fixture->id,
                'market' => Market::Result1x2,
                'selection' => $backsHome ? 'home' : 'away',
                'odds' => $backsHome ? 1.85 : 2.60,
                'stake_units' => 1,
                'confidence' => 3,
                'visibility' => Visibility::Subscribers,
                'locked_at' => $fixture->kickoff_at,
            ]);

            $settlement->settle($fixture, ['home' => $homeGoals, 'away' => $awayGoals]);
        }

        // A few upcoming fixtures open for predictions.
        for ($i = 0; $i < 5; $i++) {
            $home = $teams->random();
            $away = $teams->reject(fn ($t) => $t->id === $home->id)->random();
            Fixture::create([
                'competition_id' => $ligue1->id,
                'home_team_id' => $home->id,
                'away_team_id' => $away->id,
                'external_ref' => 'upcoming-'.$i,
                'kickoff_at' => Carbon::now()->addDays($i + 1),
                'status' => FixtureStatus::Scheduled,
            ]);
        }

        $latest = $tipster->latestReliability();
        $this->command?->info(sprintf(
            'Seeded. Tipster reliability: score=%s badge=%s (%d settled).',
            $latest?->score,
            $latest?->badge,
            $latest?->settled_count,
        ));
    }
}

<?php

namespace Tests\Feature;

use App\Enums\FixtureStatus;
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
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class SubscriptionAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_subscriber_only_pick_is_masked_then_revealed_after_subscribing(): void
    {
        $sport = Sport::create(['name' => 'Football', 'slug' => 'football']);
        $comp = Competition::create(['sport_id' => $sport->id, 'name' => 'Ligue 1 CI']);
        $home = Team::create(['sport_id' => $sport->id, 'name' => 'ASEC']);
        $away = Team::create(['sport_id' => $sport->id, 'name' => 'Africa']);

        $tipster = User::create([
            'phone' => '+2250700000021',
            'display_name' => 'Pro',
            'tipster_status' => TipsterStatus::Approved,
        ]);
        Wallet::create(['user_id' => $tipster->id]);

        $fixture = Fixture::create([
            'competition_id' => $comp->id,
            'home_team_id' => $home->id,
            'away_team_id' => $away->id,
            'kickoff_at' => Carbon::now()->addDay(),
            'status' => FixtureStatus::Scheduled,
        ]);

        Prediction::create([
            'tipster_id' => $tipster->id,
            'fixture_id' => $fixture->id,
            'market' => Market::Result1x2,
            'selection' => 'home',
            'odds' => 1.90,
            'stake_units' => 1,
            'confidence' => 4,
            'visibility' => Visibility::Subscribers,
            'locked_at' => Carbon::now(),
        ]);

        $consumer = User::create(['phone' => '+2250700000022']);
        Wallet::create(['user_id' => $consumer->id, 'balance_cents' => 1_000_000]);

        // Before subscribing: selection is masked.
        $masked = $this->actingAs($consumer)
            ->getJson("/api/v1/tipsters/{$tipster->id}/predictions")
            ->assertOk()
            ->json('data.0');
        $this->assertTrue($masked['locked']);
        $this->assertNull($masked['selection']);

        // Subscribe (debits wallet).
        $this->actingAs($consumer)
            ->postJson('/api/v1/subscriptions', ['tipster_id' => $tipster->id])
            ->assertCreated();

        // After subscribing: selection is visible.
        $revealed = $this->actingAs($consumer)
            ->getJson("/api/v1/tipsters/{$tipster->id}/predictions")
            ->assertOk()
            ->json('data.0');
        $this->assertFalse($revealed['locked']);
        $this->assertSame('home', $revealed['selection']);
    }

    public function test_subscription_pays_tipster_net_of_commission(): void
    {
        $tipster = User::create([
            'phone' => '+2250700000023',
            'display_name' => 'Pro2',
            'tipster_status' => TipsterStatus::Approved,
        ]);
        $tipsterWallet = Wallet::create(['user_id' => $tipster->id]);

        $consumer = User::create(['phone' => '+2250700000024']);
        Wallet::create(['user_id' => $consumer->id, 'balance_cents' => 1_000_000]);

        $price = (int) config('momo.default_subscription_price_cents'); // 500000

        $this->actingAs($consumer)
            ->postJson('/api/v1/subscriptions', ['tipster_id' => $tipster->id])
            ->assertCreated();

        // 20% commission retained → tipster gets 80%.
        $this->assertSame((int) round($price * 0.8), $tipsterWallet->fresh()->balance_cents);
    }
}

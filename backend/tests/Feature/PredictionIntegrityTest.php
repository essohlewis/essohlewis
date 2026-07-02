<?php

namespace Tests\Feature;

use App\Enums\FixtureStatus;
use App\Enums\TipsterStatus;
use App\Models\Competition;
use App\Models\Fixture;
use App\Models\Sport;
use App\Models\Team;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class PredictionIntegrityTest extends TestCase
{
    use RefreshDatabase;

    private function makeFixture(Carbon $kickoff): Fixture
    {
        $sport = Sport::create(['name' => 'Football', 'slug' => 'football']);
        $comp = Competition::create(['sport_id' => $sport->id, 'name' => 'Ligue 1 CI']);
        $home = Team::create(['sport_id' => $sport->id, 'name' => 'ASEC']);
        $away = Team::create(['sport_id' => $sport->id, 'name' => 'Africa Sports']);

        return Fixture::create([
            'competition_id' => $comp->id,
            'home_team_id' => $home->id,
            'away_team_id' => $away->id,
            'kickoff_at' => $kickoff,
            'status' => FixtureStatus::Scheduled,
        ]);
    }

    private function approvedTipster(): User
    {
        return User::create([
            'phone' => '+2250700000009',
            'display_name' => 'Tester',
            'tipster_status' => TipsterStatus::Approved,
        ]);
    }

    public function test_approved_tipster_can_publish_before_kickoff(): void
    {
        $tipster = $this->approvedTipster();
        $fixture = $this->makeFixture(Carbon::now()->addHours(2));

        $response = $this->actingAs($tipster)->postJson('/api/v1/predictions', [
            'fixture_id' => $fixture->id,
            'market' => '1x2',
            'selection' => 'home',
            'odds' => 1.90,
            'visibility' => 'subscribers',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('predictions', [
            'tipster_id' => $tipster->id,
            'fixture_id' => $fixture->id,
            'selection' => 'home',
        ]);
    }

    public function test_prediction_is_rejected_after_kickoff(): void
    {
        $tipster = $this->approvedTipster();
        $fixture = $this->makeFixture(Carbon::now()->subMinutes(1));

        $response = $this->actingAs($tipster)->postJson('/api/v1/predictions', [
            'fixture_id' => $fixture->id,
            'market' => '1x2',
            'selection' => 'home',
            'odds' => 1.90,
            'visibility' => 'subscribers',
        ]);

        $response->assertStatus(422);
        $this->assertDatabaseCount('predictions', 0);
    }

    public function test_non_tipster_cannot_publish(): void
    {
        $user = User::create(['phone' => '+2250700000010']);
        $fixture = $this->makeFixture(Carbon::now()->addHours(2));

        $this->actingAs($user)->postJson('/api/v1/predictions', [
            'fixture_id' => $fixture->id,
            'market' => '1x2',
            'selection' => 'home',
            'odds' => 1.90,
            'visibility' => 'free',
        ])->assertStatus(403);
    }
}

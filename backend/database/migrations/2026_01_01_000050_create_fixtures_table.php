<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('fixtures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('competition_id')->constrained()->cascadeOnDelete();
            $table->foreignId('home_team_id')->constrained('teams');
            $table->foreignId('away_team_id')->constrained('teams');
            $table->string('external_ref')->nullable()->unique();
            // The temporal lock: predictions close at kickoff. Stored in UTC.
            $table->timestamp('kickoff_at');
            $table->string('status')->default('scheduled');
            // Normalised final result, filled at settlement. e.g. {"home":2,"away":1}
            $table->json('result')->nullable();
            $table->timestamp('settled_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'kickoff_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('fixtures');
    }
};

<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Predictions are append-only and immutable after `locked_at`.
     * There is deliberately no application route that UPDATEs or DELETEs a row here.
     * The integrity of every tipster's public track record depends on it.
     */
    public function up(): void
    {
        Schema::create('predictions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tipster_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('fixture_id')->constrained()->cascadeOnDelete();
            $table->string('market');
            $table->string('selection');
            $table->decimal('odds', 6, 2);
            $table->decimal('stake_units', 4, 2)->default(1);
            $table->unsignedTinyInteger('confidence')->default(3);
            $table->string('visibility')->default('subscribers');
            $table->text('analysis')->nullable();
            // Frozen at creation = min(now, kickoff). Server clock only.
            $table->timestamp('locked_at');
            // Settlement outcome, null until the fixture is settled.
            $table->string('outcome')->nullable();
            $table->timestamp('settled_at')->nullable();
            $table->timestamps();

            $table->index(['tipster_id', 'created_at']);
            $table->index(['fixture_id', 'outcome']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('predictions');
    }
};

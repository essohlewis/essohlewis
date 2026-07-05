<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Append-only history of a tipster's reliability. Never overwritten, so the score
     * cannot be "recomputed away" retroactively and the profile can show a real curve.
     */
    public function up(): void
    {
        Schema::create('reliability_snapshots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('tipster_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedInteger('settled_count');
            $table->decimal('win_rate', 5, 2);          // 0-100
            $table->decimal('yield', 6, 2);              // ROI %, can be negative
            $table->decimal('score', 5, 2);              // composite 0-100
            $table->string('badge')->default('unrated'); // unrated/bronze/silver/gold
            $table->timestamps();

            $table->index(['tipster_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reliability_snapshots');
    }
};

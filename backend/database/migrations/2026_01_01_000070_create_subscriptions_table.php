<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('consumer_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('tipster_id')->constrained('users')->cascadeOnDelete();
            // Price frozen at subscription time.
            $table->bigInteger('price_cents');
            $table->timestamp('period_start');
            $table->timestamp('period_end');
            $table->string('status')->default('active');
            $table->boolean('auto_renew')->default(true);
            $table->timestamps();

            $table->index(['consumer_id', 'tipster_id', 'status']);
            $table->index(['status', 'period_end']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subscriptions');
    }
};

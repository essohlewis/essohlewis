<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('wallet_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            // Signed: positive = credit, negative = debit.
            $table->bigInteger('amount_cents');
            // Snapshot of the balance after this line, for audit / reconciliation.
            $table->bigInteger('balance_after_cents');
            // Idempotency key (e.g. Mobile Money transaction id). Replaying never double-posts.
            $table->string('reference')->unique();
            $table->string('status')->default('completed');
            $table->nullableMorphs('related');
            $table->json('meta')->nullable();
            $table->timestamps();

            $table->index(['wallet_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('wallet_transactions');
    }
};

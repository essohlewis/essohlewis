<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\FixtureController;
use App\Http\Controllers\Api\PredictionController;
use App\Http\Controllers\Api\SubscriptionController;
use App\Http\Controllers\Api\TipsterController;
use App\Http\Controllers\Api\WalletController;
use App\Http\Controllers\Api\WebhookController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {
    // --- Auth (phone + OTP) ---
    Route::post('auth/request-otp', [AuthController::class, 'requestOtp'])
        ->middleware('throttle:6,1');
    Route::post('auth/verify-otp', [AuthController::class, 'verifyOtp'])
        ->middleware('throttle:10,1');

    // --- Public discovery ---
    Route::get('tipsters', [TipsterController::class, 'index']);
    Route::get('tipsters/{tipster}', [TipsterController::class, 'show']);
    Route::get('tipsters/{tipster}/predictions', [TipsterController::class, 'predictions']);
    Route::get('fixtures', [FixtureController::class, 'index']);

    // --- Signed webhooks (no session auth) ---
    Route::post('webhooks/momo', [WebhookController::class, 'mobileMoney']);
    Route::post('webhooks/results', [WebhookController::class, 'results']);

    // --- Authenticated ---
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('me', [AuthController::class, 'me']);
        Route::post('auth/logout', [AuthController::class, 'logout']);

        Route::post('tipster/apply', [TipsterController::class, 'apply']);
        Route::post('predictions', [PredictionController::class, 'store']);
        Route::get('predictions/{prediction}', [PredictionController::class, 'show']);

        Route::get('wallet', [WalletController::class, 'show']);
        Route::post('wallet/topup', [WalletController::class, 'topup']);

        Route::get('subscriptions', [SubscriptionController::class, 'index']);
        Route::post('subscriptions', [SubscriptionController::class, 'store']);
        Route::delete('subscriptions/{subscription}', [SubscriptionController::class, 'destroy']);
    });
});

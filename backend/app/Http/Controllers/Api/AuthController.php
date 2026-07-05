<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Wallet;
use App\Services\OtpService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private OtpService $otp)
    {
    }

    /**
     * Step 1 of phone-first onboarding: request an OTP. Works for both new and
     * returning users — the phone is the identity.
     */
    public function requestOtp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone' => ['required', 'string', 'regex:/^\+?[0-9]{8,15}$/'],
        ]);

        $code = $this->otp->issue($data['phone']);

        // In production this is sent by SMS, never returned. Exposed only in local.
        $payload = ['message' => 'OTP sent.'];
        if (app()->environment('local', 'testing')) {
            $payload['debug_code'] = $code;
        }

        return response()->json($payload);
    }

    /**
     * Step 2: verify the OTP. Creates the user (and wallet) on first login,
     * marks the phone verified, and issues a Sanctum token.
     */
    public function verifyOtp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'phone' => ['required', 'string'],
            'code' => ['required', 'string'],
        ]);

        if (! $this->otp->verify($data['phone'], $data['code'])) {
            throw ValidationException::withMessages([
                'code' => ['Invalid or expired code.'],
            ]);
        }

        $user = DB::transaction(function () use ($data) {
            $user = User::firstOrCreate(
                ['phone' => $data['phone']],
                ['phone_verified_at' => Carbon::now()],
            );

            if (! $user->phone_verified_at) {
                $user->forceFill(['phone_verified_at' => Carbon::now()])->save();
            }

            // Every user gets a wallet on first sight.
            Wallet::firstOrCreate(['user_id' => $user->id]);

            return $user;
        });

        $token = $user->createToken('mobile')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'phone' => $user->phone,
                'display_name' => $user->display_name,
                'tipster_status' => $user->tipster_status,
            ],
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user()->load('wallet');

        return response()->json([
            'id' => $user->id,
            'phone' => $user->phone,
            'display_name' => $user->display_name,
            'country_code' => $user->country_code,
            'tipster_status' => $user->tipster_status,
            'kyc_status' => $user->kyc_status,
            'wallet' => $user->wallet ? [
                'balance_cents' => $user->wallet->balance_cents,
                'currency' => $user->wallet->currency,
            ] : null,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out.']);
    }
}

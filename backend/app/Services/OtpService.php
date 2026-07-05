<?php

namespace App\Services;

use App\Models\OtpCode;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;

class OtpService
{
    private const TTL_MINUTES = 5;
    private const MAX_ATTEMPTS = 5;

    /**
     * Issue a fresh OTP for a phone. Returns the plaintext code so the caller can
     * dispatch it over SMS. In local/testing we also log it.
     */
    public function issue(string $phone): string
    {
        // A new request supersedes any pending code for this phone.
        OtpCode::where('phone', $phone)->whereNull('consumed_at')->delete();

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        OtpCode::create([
            'phone' => $phone,
            'code_hash' => Hash::make($code),
            'expires_at' => Carbon::now()->addMinutes(self::TTL_MINUTES),
        ]);

        return $code;
    }

    /**
     * Verify a submitted code. Consumes it on success. Returns false on
     * expiry, wrong code, or too many attempts.
     */
    public function verify(string $phone, string $code): bool
    {
        $otp = OtpCode::where('phone', $phone)
            ->whereNull('consumed_at')
            ->latest('id')
            ->first();

        if (! $otp || $otp->isExpired() || $otp->attempts >= self::MAX_ATTEMPTS) {
            return false;
        }

        if (! Hash::check($code, $otp->code_hash)) {
            $otp->increment('attempts');

            return false;
        }

        $otp->update(['consumed_at' => Carbon::now()]);

        return true;
    }
}

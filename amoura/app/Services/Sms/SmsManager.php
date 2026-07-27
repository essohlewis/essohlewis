<?php
declare(strict_types=1);

namespace Amoura\Services\Sms;

use Amoura\Core\Env;

/** Fabrique la passerelle SMS selon SMS_DRIVER (log | http). */
final class SmsManager
{
    private static ?SmsGateway $gateway = null;

    public static function gateway(): SmsGateway
    {
        if (self::$gateway instanceof SmsGateway) {
            return self::$gateway;
        }
        $driver = strtolower((string) Env::get('SMS_DRIVER', 'log'));
        return self::$gateway = $driver === 'http' ? new HttpSmsGateway() : new LogSmsGateway();
    }

    /** Injection d'une passerelle (tests). */
    public static function setGateway(?SmsGateway $gateway): void
    {
        self::$gateway = $gateway;
    }
}

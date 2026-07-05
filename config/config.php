<?php

declare(strict_types=1);

/**
 * Configuration centrale de l'application.
 * Les valeurs proviennent du fichier .env (chargé par Transouscris\Core\Env).
 */

use Transouscris\Core\Env;

return [
    'app' => [
        'name'     => Env::get('APP_NAME', 'Transouscris'),
        'env'      => Env::get('APP_ENV', 'production'),
        'debug'    => Env::bool('APP_DEBUG', false),
        'url'      => Env::get('APP_URL', 'http://localhost:8000'),
        'key'      => Env::get('APP_KEY', ''),
        'timezone' => Env::get('APP_TIMEZONE', 'Africa/Abidjan'),
    ],

    'db' => [
        'host'    => Env::get('DB_HOST', '127.0.0.1'),
        'port'    => (int) Env::get('DB_PORT', '3306'),
        'name'    => Env::get('DB_NAME', 'transouscris'),
        'user'    => Env::get('DB_USER', 'root'),
        'pass'    => Env::get('DB_PASS', ''),
        'charset' => 'utf8mb4',
    ],

    'session' => [
        'lifetime' => (int) Env::get('SESSION_LIFETIME', '7200'),
        'secure'   => Env::bool('SESSION_SECURE', false),
        'name'     => 'transouscris_session',
    ],

    'security' => [
        'csrf_ttl'         => (int) Env::get('CSRF_TOKEN_TTL', '7200'),
        'otp_ttl'          => (int) Env::get('OTP_TTL', '300'),
        'otp_max_attempts' => (int) Env::get('OTP_MAX_ATTEMPTS', '5'),
    ],

    // Délai (secondes) avant déclenchement de la garantie de remboursement
    // automatique si l'opérateur n'a pas confirmé la recharge.
    'recharge' => [
        'guarantee_delay' => (int) Env::get('RECHARGE_GUARANTEE_DELAY', '900'),
    ],

    'payments' => [
        'cinetpay' => [
            'api_key'    => Env::get('CINETPAY_API_KEY', ''),
            'site_id'    => Env::get('CINETPAY_SITE_ID', ''),
            'secret_key' => Env::get('CINETPAY_SECRET_KEY', ''),
            'base_url'   => Env::get('CINETPAY_BASE_URL', 'https://api-checkout.cinetpay.com/v2'),
            'notify_url' => Env::get('CINETPAY_NOTIFY_URL', ''),
            'return_url' => Env::get('CINETPAY_RETURN_URL', ''),
        ],
        'paydunya' => [
            'master_key'  => Env::get('PAYDUNYA_MASTER_KEY', ''),
            'private_key' => Env::get('PAYDUNYA_PRIVATE_KEY', ''),
            'public_key'  => Env::get('PAYDUNYA_PUBLIC_KEY', ''),
            'token'       => Env::get('PAYDUNYA_TOKEN', ''),
            'mode'        => Env::get('PAYDUNYA_MODE', 'test'),
            'base_url'    => Env::get('PAYDUNYA_BASE_URL', 'https://app.paydunya.com/api/v1'),
        ],
        'wave' => [
            'api_key'  => Env::get('WAVE_API_KEY', ''),
            'base_url' => Env::get('WAVE_BASE_URL', 'https://api.wave.com/v1'),
        ],
        'stripe' => [
            'secret_key'     => Env::get('STRIPE_SECRET_KEY', ''),
            'webhook_secret' => Env::get('STRIPE_WEBHOOK_SECRET', ''),
        ],
    ],

    'sms' => [
        'api_key'  => Env::get('CINETPAY_SMS_API_KEY', ''),
        'sender'   => Env::get('CINETPAY_SMS_SENDER', 'Transouscr'),
        'base_url' => Env::get('CINETPAY_SMS_BASE_URL', 'https://sms.cinetpay.com/api/v1'),
    ],
];

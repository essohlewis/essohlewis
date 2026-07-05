<?php

return [
    // Default Mobile Money driver. 'sandbox' for local/dev.
    'driver' => env('MOMO_DRIVER', 'sandbox'),

    // Shared secret used to sign/verify provider webhooks.
    'webhook_secret' => env('MOMO_WEBHOOK_SECRET', 'local-momo-secret'),

    // Shared secret used to verify the sports-results webhook.
    'results_webhook_secret' => env('RESULTS_WEBHOOK_SECRET', 'local-results-secret'),

    // Default monthly subscription price in minor units (XOF centimes).
    // 5000 XOF => 500000 centimes.
    'default_subscription_price_cents' => (int) env('DEFAULT_SUB_PRICE_CENTS', 500000),
];

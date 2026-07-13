<?php
/**
 * CONTEO — Chargement de la configuration depuis .env
 *
 * Parseur .env minimal (aucune dépendance). Renvoie un tableau de config
 * consommé par le noyau. Les valeurs sont lues une seule fois.
 */

declare(strict_types=1);

/**
 * Charge le fichier .env dans $_ENV / getenv, sans écraser l'environnement réel.
 * Gardé par function_exists : ce fichier peut être `require` plusieurs fois
 * (il renvoie un tableau de config à chaque appel).
 */
if (!function_exists('conteo_load_env')):
function conteo_load_env(string $path): void
{
    if (!is_file($path)) {
        return;
    }
    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#') {
            continue;
        }
        if (!str_contains($line, '=')) {
            continue;
        }
        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);
        // Retire un commentaire de fin de ligne s'il n'est pas dans une valeur entre quotes
        if ($value !== '' && $value[0] !== '"' && $value[0] !== "'") {
            $value = trim(preg_replace('/\s+#.*$/', '', $value));
        }
        // Retire les guillemets encadrants
        if (strlen($value) >= 2 && ($value[0] === '"' || $value[0] === "'")) {
            $value = substr($value, 1, -1);
        }
        if (getenv($key) === false) {
            putenv("$key=$value");
            $_ENV[$key] = $value;
        }
    }
}
endif;

/**
 * Récupère une variable d'environnement avec valeur par défaut et cast.
 */
if (!function_exists('env')):
function env(string $key, mixed $default = null): mixed
{
    $val = getenv($key);
    if ($val === false) {
        return $default;
    }
    return match (strtolower($val)) {
        'true'  => true,
        'false' => false,
        'null'  => null,
        default => $val,
    };
}
endif;

conteo_load_env(dirname(__DIR__) . '/.env');

$appTimezone = (string) env('APP_TIMEZONE', 'Africa/Abidjan');
date_default_timezone_set($appTimezone);

return [
    'app' => [
        'env'      => (string) env('APP_ENV', 'production'),
        'debug'    => (bool) env('APP_DEBUG', false),
        'url'      => rtrim((string) env('APP_URL', 'http://localhost:8000'), '/'),
        'key'      => (string) env('APP_KEY', ''),
        'timezone' => $appTimezone,
    ],
    'db' => [
        'host'    => (string) env('DB_HOST', '127.0.0.1'),
        'port'    => (int) env('DB_PORT', 3306),
        'name'    => (string) env('DB_NAME', 'conteo'),
        'user'    => (string) env('DB_USER', 'root'),
        'pass'    => (string) env('DB_PASS', ''),
        'charset' => (string) env('DB_CHARSET', 'utf8mb4'),
    ],
    'security' => [
        'token_ttl_days'   => (int) env('TOKEN_TTL_DAYS', 30),
        'csrf_ttl_minutes' => (int) env('CSRF_TTL_MINUTES', 120),
    ],
    'rate' => [
        'auth_max'    => (int) env('RATE_AUTH_MAX', 10),
        'auth_window' => (int) env('RATE_AUTH_WINDOW', 300),
        'pay_max'     => (int) env('RATE_PAY_MAX', 5),
        'pay_window'  => (int) env('RATE_PAY_WINDOW', 300),
    ],
    'cdn' => [
        'base_url' => rtrim((string) env('CDN_BASE_URL', ''), '/'),
    ],
    'cinetpay' => [
        'api_key'      => (string) env('CINETPAY_API_KEY', ''),
        'site_id'      => (string) env('CINETPAY_SITE_ID', ''),
        'secret_key'   => (string) env('CINETPAY_SECRET_KEY', ''),
        'base_url'     => rtrim((string) env('CINETPAY_BASE_URL', 'https://api-checkout.cinetpay.com/v2'), '/'),
        'webhook_ips'  => array_filter(array_map('trim', explode(',', (string) env('CINETPAY_WEBHOOK_IPS', '')))),
    ],
    'paydunya' => [
        'master_key'  => (string) env('PAYDUNYA_MASTER_KEY', ''),
        'private_key' => (string) env('PAYDUNYA_PRIVATE_KEY', ''),
        'public_key'  => (string) env('PAYDUNYA_PUBLIC_KEY', ''),
        'token'       => (string) env('PAYDUNYA_TOKEN', ''),
        'mode'        => (string) env('PAYDUNYA_MODE', 'test'),
        'webhook_ips' => array_filter(array_map('trim', explode(',', (string) env('PAYDUNYA_WEBHOOK_IPS', '')))),
    ],
    'sms' => [
        'provider' => (string) env('SMS_PROVIDER', 'log'),
        'api_key'  => (string) env('SMS_API_KEY', ''),
        'sender'   => (string) env('SMS_SENDER', 'CONTEO'),
    ],
    'plans' => [
        'monthly' => ['price_fcfa' => 1500,  'label' => 'Abonnement mensuel'],
        'yearly'  => ['price_fcfa' => 12000, 'label' => 'Abonnement annuel (2 mois offerts)'],
    ],
];

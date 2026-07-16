<?php
/* ==========================================================================
   core/Request.php — Accès à la requête entrante (corps JSON, params, headers).
   ========================================================================== */

class Request
{
    private static ?array $corpsCache = null;

    /** Méthode HTTP (GET, POST, PATCH, DELETE…). */
    public static function methode(): string
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    }

    /** Chemin demandé, sans query string ni préfixe /api. */
    public static function chemin(): string
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
        // Retire un éventuel préfixe de sous-dossier /api ou /coachlink/api.
        $uri = preg_replace('#^.*?/api#', '', $uri);
        $uri = '/' . trim($uri, '/');
        return $uri === '' ? '/' : $uri;
    }

    /** Corps JSON décodé (mis en cache). */
    public static function corps(): array
    {
        if (self::$corpsCache !== null) {
            return self::$corpsCache;
        }
        $brut = file_get_contents('php://input');
        $data = json_decode($brut, true);
        self::$corpsCache = is_array($data) ? $data : [];
        return self::$corpsCache;
    }

    /** Récupère un champ du corps JSON. */
    public static function champ(string $cle, $defaut = null)
    {
        return self::corps()[$cle] ?? $defaut;
    }

    /** Paramètre de query string (?cle=valeur). */
    public static function query(string $cle, $defaut = null)
    {
        return $_GET[$cle] ?? $defaut;
    }

    /** En-tête HTTP (insensible à la casse). */
    public static function entete(string $nom): ?string
    {
        $cle = 'HTTP_' . strtoupper(str_replace('-', '_', $nom));
        return $_SERVER[$cle] ?? null;
    }

    /** Jeton Bearer de l'en-tête Authorization. */
    public static function bearer(): ?string
    {
        $auth = self::entete('Authorization') ?? '';
        if (stripos($auth, 'Bearer ') === 0) {
            return trim(substr($auth, 7));
        }
        return null;
    }
}

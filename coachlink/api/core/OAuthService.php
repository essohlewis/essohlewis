<?php
/* ==========================================================================
   core/OAuthService.php — Sélectionne le fournisseur de connexion sociale et
   construit les URL (autorisation, callback, redirection front).
   Renvoie null si le réseau n'est pas configuré (le front bascule alors sur la
   simulation hors-ligne).
   ========================================================================== */

class OAuthService
{
    public static function pour(string $reseau): ?OAuthProvider
    {
        $cfg = App::config('oauth', []);
        $r   = strtolower(trim($reseau));
        $c   = $cfg[$r] ?? [];
        if (empty($c['actif']) || empty($c['client_id'])) {
            return null;
        }
        return match ($r) {
            'facebook' => new OAuthFacebook($c),
            'linkedin' => new OAuthLinkedIn($c),
            default    => null,
        };
    }

    /** URL de callback de l'API (à déclarer côté fournisseur). */
    public static function redirectUri(string $reseau): string
    {
        $base = rtrim(App::config('oauth', [])['redirect_base'] ?? '', '/');
        return $base . '/auth/oauth/' . strtolower($reseau) . '/callback';
    }

    /** URL du front vers laquelle revenir après authentification. */
    public static function frontUrl(): string
    {
        return rtrim(App::config('oauth', [])['front_url'] ?? '', '/');
    }
}

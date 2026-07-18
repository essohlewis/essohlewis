<?php
/* ==========================================================================
   core/OAuthFacebook.php — Connexion Facebook (OAuth 2.0 + Graph API).
   Squelette prêt pour la production. Activez via config.php → oauth.facebook
   (client_id, client_secret) et déclarez le redirect_uri dans votre app Meta.
   ========================================================================== */

class OAuthFacebook implements OAuthProvider
{
    public function __construct(private array $cfg) {}

    public function urlAutorisation(string $state, string $redirectUri): string
    {
        return 'https://www.facebook.com/v19.0/dialog/oauth?' . http_build_query([
            'client_id'     => $this->cfg['client_id'] ?? '',
            'redirect_uri'  => $redirectUri,
            'state'         => $state,
            'scope'         => 'email,public_profile',
            'response_type' => 'code',
        ], '', '&', PHP_QUERY_RFC3986);
    }

    public function profil(string $code, string $redirectUri): ?array
    {
        $t = HttpClient::get('https://graph.facebook.com/v19.0/oauth/access_token?' . http_build_query([
            'client_id'     => $this->cfg['client_id'] ?? '',
            'client_secret' => $this->cfg['client_secret'] ?? '',
            'redirect_uri'  => $redirectUri,
            'code'          => $code,
        ]));
        $token = $t['json']['access_token'] ?? '';
        if ($token === '') return null;

        $u = HttpClient::get('https://graph.facebook.com/me?' . http_build_query([
            'fields'       => 'id,first_name,last_name,email',
            'access_token' => $token,
        ]));
        $j = $u['json'] ?? null;
        if (!$j || empty($j['email'])) return null;

        return [
            'email'  => strtolower($j['email']),
            'prenom' => $j['first_name'] ?? '',
            'nom'    => $j['last_name'] ?? '',
            'source' => 'facebook',
        ];
    }
}

<?php
/* ==========================================================================
   core/OAuthLinkedIn.php — Connexion LinkedIn (OpenID Connect).
   Squelette prêt pour la production. Activez via config.php → oauth.linkedin
   (client_id, client_secret) et déclarez le redirect_uri dans votre app LinkedIn.
   ========================================================================== */

class OAuthLinkedIn implements OAuthProvider
{
    public function __construct(private array $cfg) {}

    public function urlAutorisation(string $state, string $redirectUri): string
    {
        return 'https://www.linkedin.com/oauth/v2/authorization?' . http_build_query([
            'response_type' => 'code',
            'client_id'     => $this->cfg['client_id'] ?? '',
            'redirect_uri'  => $redirectUri,
            'state'         => $state,
            'scope'         => 'openid profile email',
        ], '', '&', PHP_QUERY_RFC3986);
    }

    public function profil(string $code, string $redirectUri): ?array
    {
        $t = HttpClient::postForm('https://www.linkedin.com/oauth/v2/accessToken', [
            'grant_type'    => 'authorization_code',
            'code'          => $code,
            'redirect_uri'  => $redirectUri,
            'client_id'     => $this->cfg['client_id'] ?? '',
            'client_secret' => $this->cfg['client_secret'] ?? '',
        ]);
        $token = $t['json']['access_token'] ?? '';
        if ($token === '') return null;

        // OpenID Connect : /userinfo renvoie email, given_name, family_name.
        $u = HttpClient::get('https://api.linkedin.com/v2/userinfo', ['Authorization: Bearer ' . $token]);
        $j = $u['json'] ?? null;
        if (!$j || empty($j['email'])) return null;

        return [
            'email'  => strtolower($j['email']),
            'prenom' => $j['given_name'] ?? '',
            'nom'    => $j['family_name'] ?? '',
            'source' => 'linkedin',
        ];
    }
}

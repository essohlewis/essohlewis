<?php

class OAuthTest extends ApiTestCase
{
    public function testServiceNullSansConfiguration(): void
    {
        // La config de test ne définit pas 'oauth' → aucun fournisseur.
        $this->assertNull(OAuthService::pour('facebook'));
        $this->assertNull(OAuthService::pour('linkedin'));
        $this->assertNull(OAuthService::pour('inconnu'));
    }

    public function testUrlAutorisationFacebook(): void
    {
        $p = new OAuthFacebook(['client_id' => 'FBID']);
        $url = $p->urlAutorisation('etat123', 'https://api.test/auth/oauth/facebook/callback');
        $this->assertStringContainsString('facebook.com', $url);
        $this->assertStringContainsString('client_id=FBID', $url);
        $this->assertStringContainsString('state=etat123', $url);
        $this->assertStringContainsString(rawurlencode('https://api.test/auth/oauth/facebook/callback'), $url);
        $this->assertStringContainsString('response_type=code', $url);
    }

    public function testUrlAutorisationLinkedIn(): void
    {
        $p = new OAuthLinkedIn(['client_id' => 'LIID']);
        $url = $p->urlAutorisation('xyz', 'https://api.test/auth/oauth/linkedin/callback');
        $this->assertStringContainsString('linkedin.com/oauth/v2/authorization', $url);
        $this->assertStringContainsString('client_id=LIID', $url);
        $this->assertStringContainsString('scope=' . rawurlencode('openid profile email'), $url);
    }

    public function testRedirectUriConstruiteDepuisLaConfig(): void
    {
        // Sans redirect_base configuré, l'URI se termine par le chemin de callback.
        $this->assertStringEndsWith('/auth/oauth/facebook/callback', OAuthService::redirectUri('facebook'));
        $this->assertStringEndsWith('/auth/oauth/linkedin/callback', OAuthService::redirectUri('LinkedIn'));
    }

    public function testLesDeuxFournisseursImplemententLeContrat(): void
    {
        $this->assertInstanceOf(OAuthProvider::class, new OAuthFacebook(['client_id' => 'a']));
        $this->assertInstanceOf(OAuthProvider::class, new OAuthLinkedIn(['client_id' => 'b']));
    }
}

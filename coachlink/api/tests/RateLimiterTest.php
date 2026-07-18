<?php
use PHPUnit\Framework\TestCase;

class RateLimiterTest extends TestCase
{
    private function fichierSeau(string $seau): string
    {
        $dir = rtrim(App::config('cache_dir'), '/') . '/ratelimit';
        return $dir . '/' . md5($seau . '|' . ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0')) . '.json';
    }

    public function testCompteurIncrementeDansLaFenetre(): void
    {
        $seau = 'test_' . uniqid();
        // Quota très élevé → n'atteint jamais la limite (pas de sortie 429).
        RateLimiter::verifier($seau, 1000, 60);
        RateLimiter::verifier($seau, 1000, 60);
        RateLimiter::verifier($seau, 1000, 60);

        $etat = json_decode(file_get_contents($this->fichierSeau($seau)), true);
        $this->assertSame(3, $etat['count']);
        $this->assertArrayHasKey('debut', $etat);
    }

    public function testDesactiveQuandMaxNul(): void
    {
        $seau = 'off_' . uniqid();
        RateLimiter::verifier($seau, 0, 60); // désactivé → aucun fichier créé
        $this->assertFileDoesNotExist($this->fichierSeau($seau));
    }
}

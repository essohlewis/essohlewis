<?php
declare(strict_types=1);

namespace Amoura\Tests\Unit;

use Amoura\Services\Seo\MetaTags;
use PHPUnit\Framework\TestCase;

/** Balises SEO / Open Graph / JSON-LD (Phase 5, Sprint +18). */
final class MetaTagsTest extends TestCase
{
    private const BASE = 'https://amoura.example';

    public function testRendersOpenGraphAndTwitter(): void
    {
        $out = MetaTags::render(
            ['title' => 'Mon événement', 'description' => 'Venez nombreux', 'type' => 'article'],
            'Amoura', self::BASE, '/e/mon-evenement'
        );
        $this->assertStringContainsString('<meta property="og:title" content="Mon événement">', $out);
        $this->assertStringContainsString('<meta property="og:type" content="article">', $out);
        $this->assertStringContainsString('<meta property="og:description" content="Venez nombreux">', $out);
        $this->assertStringContainsString('name="twitter:card" content="summary_large_image"', $out);
        $this->assertStringContainsString('<link rel="canonical" href="https://amoura.example/e/mon-evenement">', $out);
    }

    public function testDefaultsWhenEmpty(): void
    {
        $out = MetaTags::render([], 'Amoura', self::BASE, '/');
        $this->assertStringContainsString('<meta property="og:title" content="Amoura">', $out);
        $this->assertStringContainsString('og:image', $out);
        $this->assertStringContainsString('https://amoura.example/', $out);
    }

    public function testEscapesUserContent(): void
    {
        $out = MetaTags::render(['title' => 'A"><script>alert(1)</script>'], 'Amoura', self::BASE, '/');
        $this->assertStringNotContainsString('<script>alert(1)</script>', $out);
        $this->assertStringContainsString('&quot;', $out);
    }

    public function testAbsolutizesRelativeImage(): void
    {
        $out = MetaTags::render(['image' => 'uploads/photos/a.jpg'], 'Amoura', self::BASE, '/');
        $this->assertStringContainsString('content="https://amoura.example/uploads/photos/a.jpg"', $out);
        // Une URL déjà absolue est conservée telle quelle.
        $out2 = MetaTags::render(['image' => 'https://cdn.x/y.jpg'], 'Amoura', self::BASE, '/');
        $this->assertStringContainsString('content="https://cdn.x/y.jpg"', $out2);
    }

    public function testJsonLdWithNonceAndTagBreakout(): void
    {
        $out = MetaTags::render(
            ['jsonld' => ['@type' => 'Event', 'name' => 'Fin </script> injection']],
            'Amoura', self::BASE, '/e/x', 'abc123'
        );
        $this->assertStringContainsString('<script type="application/ld+json" nonce="abc123">', $out);
        $this->assertStringContainsString('"@type":"Event"', $out);
        // La séquence </ est neutralisée pour ne pas fermer la balise script.
        $this->assertStringNotContainsString('</script> injection', $out);
        $this->assertStringContainsString('<\/script>', $out);
    }

    public function testNoJsonLdWhenAbsent(): void
    {
        $out = MetaTags::render(['title' => 'x'], 'Amoura', self::BASE, '/');
        $this->assertStringNotContainsString('application/ld+json', $out);
    }
}

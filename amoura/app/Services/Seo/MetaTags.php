<?php
declare(strict_types=1);

namespace Amoura\Services\Seo;

/**
 * Génère les balises SEO / partage social (Phase 5, Sprint +18).
 * Open Graph + Twitter Card + URL canonique + données structurées (JSON-LD).
 * Pur et testable ; tout est échappé.
 */
final class MetaTags
{
    /**
     * @param array{title?:string,description?:string,image?:string,type?:string,jsonld?:array} $seo
     * @param string $siteName  nom du site
     * @param string $baseUrl   origine publique (ex. https://amoura.example)
     * @param string $path      chemin de la page courante (pour l'URL canonique)
     * @param ?string $nonce    nonce CSP pour le bloc JSON-LD
     */
    public static function render(array $seo, string $siteName, string $baseUrl, string $path, ?string $nonce = null): string
    {
        $baseUrl = rtrim($baseUrl, '/');
        $title = (string) ($seo['title'] ?? $siteName);
        $description = (string) ($seo['description']
            ?? 'Amoura — rencontrez la bonne personne. Chat, appels vidéo, statuts et bien plus.');
        $type = (string) ($seo['type'] ?? 'website');
        $url = $baseUrl . '/' . ltrim($path, '/');
        $image = (string) ($seo['image'] ?? ($baseUrl . '/assets/img/logo.svg'));
        if ($image !== '' && !preg_match('#^https?://#i', $image)) {
            $image = $baseUrl . '/' . ltrim($image, '/');
        }

        $e = static fn(string $v): string => htmlspecialchars($v, ENT_QUOTES, 'UTF-8');
        $tags = [
            '<link rel="canonical" href="' . $e($url) . '">',
            '<meta property="og:site_name" content="' . $e($siteName) . '">',
            '<meta property="og:type" content="' . $e($type) . '">',
            '<meta property="og:title" content="' . $e($title) . '">',
            '<meta property="og:description" content="' . $e($description) . '">',
            '<meta property="og:url" content="' . $e($url) . '">',
            '<meta property="og:image" content="' . $e($image) . '">',
            '<meta name="twitter:card" content="summary_large_image">',
            '<meta name="twitter:title" content="' . $e($title) . '">',
            '<meta name="twitter:description" content="' . $e($description) . '">',
            '<meta name="twitter:image" content="' . $e($image) . '">',
        ];

        // Données structurées (schema.org) — encodées sûrement pour un bloc script.
        if (!empty($seo['jsonld'])) {
            $json = json_encode($seo['jsonld'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if ($json !== false) {
                // Neutralise toute tentative de sortie de balise dans les données.
                $json = str_replace('</', '<\/', $json);
                $attr = $nonce !== null ? ' nonce="' . $e($nonce) . '"' : '';
                $tags[] = '<script type="application/ld+json"' . $attr . '>' . $json . '</script>';
            }
        }

        return implode("\n", $tags);
    }
}

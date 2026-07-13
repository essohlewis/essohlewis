<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\Tale;
use App\Models\TaleAudio;
use App\Models\TaleVersion;

/**
 * Assemble la charge utile « détail de conte » consommée par le lecteur :
 * métadonnées + URL du manifest + piste audio + langues disponibles.
 *
 * Le manifest lui-même (pages/hotspots/jeux) est un fichier JSON statique
 * servi depuis le CDN ; ce service en fournit l'URL absolue et les URL audio.
 */
final class ManifestService
{
    public function __construct(
        private Tale $tales = new Tale(),
        private TaleVersion $versions = new TaleVersion(),
        private TaleAudio $audio = new TaleAudio(),
    ) {
    }

    /**
     * @param array<string,mixed> $tale ligne tales
     * @return array<string,mixed>|null
     */
    public function buildDetail(array $tale, string $level, string $lang): ?array
    {
        $version = $this->versions->findByTaleLevel((int) $tale['id'], $level);
        if ($version === null) {
            return null;
        }

        $track = $this->audio->forVersionLang((int) $version['id'], $lang);
        $langs = $this->audio->langsForVersion((int) $version['id']);

        return [
            'tale' => [
                'id'     => (int) $tale['id'],
                'slug'   => $tale['slug'],
                'title'  => $tale['title'],
                'origin' => $tale['origin'],
                'moral'  => $tale['moral'],
                'cover'  => $this->url($tale['cover_url']),
            ],
            'version' => [
                'level'        => $version['level'],
                'duration_sec' => (int) $version['duration_sec'],
                'page_count'   => (int) $version['page_count'],
                'manifest_url' => $this->url($version['manifest_url']),
            ],
            'audio' => $track ? [
                'lang'        => $track['lang'],
                'audio_url'   => $this->url($track['audio_url']),
                'audio_url_fb' => $this->url($track['audio_url_fb']),
                'timings_url' => $this->url($track['timings_url']),
                'size_kb'     => (int) $track['file_size_kb'],
            ] : null,
            'available_langs' => $langs,
        ];
    }

    /** Préfixe une URL relative avec la base CDN si configurée. */
    private function url(string $path): string
    {
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://')) {
            return $path;
        }
        $config = require dirname(__DIR__, 2) . '/config/config.php';
        $base = $config['cdn']['base_url'] ?? '';
        return $base !== '' ? $base . '/' . ltrim($path, '/') : $path;
    }
}

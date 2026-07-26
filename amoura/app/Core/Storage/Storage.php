<?php
declare(strict_types=1);

namespace Amoura\Core\Storage;

/**
 * Abstraction de stockage de fichiers (Sprint +6).
 * Permet de basculer entre disque local et un stockage objet (S3/compatible)
 * sans changer le code applicatif. Prépare le déport vers un CDN.
 */
interface Storage
{
    /** Écrit un contenu et renvoie le chemin/clé relatif stocké. */
    public function put(string $relativePath, string $contents): string;

    /** Déplace un fichier temporaire (upload) vers le stockage. */
    public function putFile(string $relativePath, string $sourcePath): string;

    /** URL publique d'accès (locale ou CDN). */
    public function url(string $relativePath): string;

    public function delete(string $relativePath): bool;

    public function exists(string $relativePath): bool;
}

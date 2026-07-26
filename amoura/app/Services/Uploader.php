<?php
declare(strict_types=1);

namespace Amoura\Services;

/**
 * Téléversement sécurisé de médias (images, audio des messages vocaux).
 * - Validation stricte du type MIME réel (pas seulement l'extension).
 * - Renommage aléatoire (empêche l'exécution / la traversée de chemin).
 * - Génération de vignettes pour les images (GD).
 */
final class Uploader
{
    private const IMAGE_TYPES = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
        'image/gif'  => 'gif',
    ];
    private const AUDIO_TYPES = [
        'audio/webm' => 'webm',
        'audio/ogg'  => 'ogg',
        'audio/mpeg' => 'mp3',
        'audio/mp4'  => 'm4a',
        'audio/wav'  => 'wav',
    ];

    private static function uploadRoot(): string
    {
        return dirname(__DIR__, 2) . '/public/uploads';
    }

    /**
     * @param array  $file    entrée $_FILES[...]
     * @param string $subdir  sous-dossier (photos, posts, stories, voice, covers)
     * @param int    $maxBytes taille max autorisée
     * @return array{ok:bool, path:?string, thumb:?string, error:?string, width:?int, height:?int}
     */
    public static function image(array $file, string $subdir, int $maxBytes = 6_000_000): array
    {
        $check = self::validate($file, self::IMAGE_TYPES, $maxBytes);
        if (!$check['ok']) {
            return $check + ['path' => null, 'thumb' => null, 'width' => null, 'height' => null];
        }

        $ext = $check['ext'];
        $name = self::randomName($ext);
        $dir = self::ensureDir($subdir);
        $dest = $dir . '/' . $name;

        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            // Fallback pour les contextes hors requête HTTP réelle (tests).
            if (!@rename($file['tmp_name'], $dest)) {
                return ['ok' => false, 'path' => null, 'thumb' => null, 'error' => 'Échec de l\'enregistrement.', 'width' => null, 'height' => null];
            }
        }
        @chmod($dest, 0644);

        [$w, $h] = @getimagesize($dest) ?: [null, null];
        $thumbRel = self::makeThumbnail($dest, $subdir, $name, $ext);

        return [
            'ok' => true,
            'path' => $subdir . '/' . $name,
            'thumb' => $thumbRel,
            'error' => null,
            'width' => $w,
            'height' => $h,
        ];
    }

    /** @return array{ok:bool, path:?string, error:?string} */
    public static function audio(array $file, int $maxBytes = 10_000_000): array
    {
        $check = self::validate($file, self::AUDIO_TYPES, $maxBytes);
        if (!$check['ok']) {
            return ['ok' => false, 'path' => null, 'error' => $check['error']];
        }
        $name = self::randomName($check['ext']);
        $dir = self::ensureDir('voice');
        $dest = $dir . '/' . $name;
        if (!move_uploaded_file($file['tmp_name'], $dest) && !@rename($file['tmp_name'], $dest)) {
            return ['ok' => false, 'path' => null, 'error' => 'Échec de l\'enregistrement.'];
        }
        @chmod($dest, 0644);
        return ['ok' => true, 'path' => 'voice/' . $name, 'error' => null];
    }

    /** @return array{ok:bool, ext:?string, error:?string} */
    private static function validate(array $file, array $allowed, int $maxBytes): array
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            return ['ok' => false, 'ext' => null, 'error' => 'Aucun fichier ou erreur de téléversement.'];
        }
        if (($file['size'] ?? 0) > $maxBytes) {
            return ['ok' => false, 'ext' => null, 'error' => 'Fichier trop volumineux.'];
        }
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->file($file['tmp_name']) ?: '';
        if (!isset($allowed[$mime])) {
            return ['ok' => false, 'ext' => null, 'error' => 'Type de fichier non autorisé.'];
        }
        return ['ok' => true, 'ext' => $allowed[$mime], 'error' => null];
    }

    private static function randomName(string $ext): string
    {
        return date('Ymd') . '_' . bin2hex(random_bytes(12)) . '.' . $ext;
    }

    private static function ensureDir(string $subdir): string
    {
        // Empêche la traversée de chemin : sous-dossier alphanumérique uniquement.
        $subdir = preg_replace('/[^a-z0-9_]/', '', $subdir) ?: 'misc';
        $dir = self::uploadRoot() . '/' . $subdir;
        if (!is_dir($dir)) {
            @mkdir($dir, 0755, true);
        }
        return $dir;
    }

    /** Génère une vignette carrée max 400px (compression) si GD est disponible. */
    private static function makeThumbnail(string $srcPath, string $subdir, string $name, string $ext): ?string
    {
        if (!function_exists('imagecreatetruecolor') || $ext === 'gif') {
            return null;
        }
        $img = match ($ext) {
            'jpg'  => @imagecreatefromjpeg($srcPath),
            'png'  => @imagecreatefrompng($srcPath),
            'webp' => @imagecreatefromwebp($srcPath),
            default => null,
        };
        if (!$img) {
            return null;
        }
        $w = imagesx($img);
        $h = imagesy($img);
        $size = 400;
        $scale = min($size / $w, $size / $h, 1);
        $nw = (int) ($w * $scale);
        $nh = (int) ($h * $scale);
        $thumb = imagecreatetruecolor($nw, $nh);
        imagealphablending($thumb, false);
        imagesavealpha($thumb, true);
        imagecopyresampled($thumb, $img, 0, 0, 0, 0, $nw, $nh, $w, $h);

        $thumbName = 'thumb_' . $name;
        $thumbPath = self::ensureDir($subdir) . '/' . $thumbName;
        imagejpeg($thumb, preg_replace('/\.\w+$/', '.jpg', $thumbPath), 82);
        imagedestroy($img);
        imagedestroy($thumb);
        return $subdir . '/' . preg_replace('/\.\w+$/', '.jpg', $thumbName);
    }
}

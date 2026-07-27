<?php
declare(strict_types=1);

namespace Amoura\Services\Verification;

/**
 * Pré-vérification heuristique d'un selfie (v1) — Phase 4, Sprint +10.
 *
 * NE remplace PAS une vraie détection de vivacité : c'est un pré-filtre qui
 * écarte les soumissions manifestement invalides (image illisible, trop petite,
 * format non portrait, capture d'écran) et priorise la file de revue humaine.
 * La décision finale reste humaine (admin). Remplaçable par un prestataire réel
 * via l'interface LivenessChecker.
 */
final class HeuristicLivenessChecker implements LivenessChecker
{
    /** Score minimal pour être considéré « exploitable » (sinon auto-rejet possible). */
    public const PASS_THRESHOLD = 40;

    private const MIN_DIMENSION = 240;      // px : un selfie exploitable
    private const MIN_BYTES = 15_000;       // ~15 Ko : écarte les vignettes
    private const MAX_ASPECT = 1.6;         // écarte les bannières / captures larges

    public function analyze(string $imagePath): array
    {
        $flags = [];

        if (!is_file($imagePath)) {
            return ['score' => 0, 'flags' => ['file_missing'], 'passed' => false];
        }

        $size = @getimagesize($imagePath);
        if ($size === false) {
            return ['score' => 0, 'flags' => ['not_an_image'], 'passed' => false];
        }
        [$w, $h] = $size;
        $bytes = (int) @filesize($imagePath);

        // On part d'un score neutre et on pénalise les signaux faibles.
        $score = 70;

        if ($w < self::MIN_DIMENSION || $h < self::MIN_DIMENSION) {
            $score -= 40;
            $flags[] = 'too_small';
        }
        if ($bytes < self::MIN_BYTES) {
            $score -= 20;
            $flags[] = 'low_quality';
        }

        // Un selfie est portrait ou carré ; un ratio très large trahit une capture.
        $aspect = $h > 0 ? $w / $h : 99;
        if ($aspect > self::MAX_ASPECT) {
            $score -= 25;
            $flags[] = 'not_portrait';
        }

        // Les vraies photos portent souvent des métadonnées EXIF (appareil) ;
        // leur absence est un signal faible de capture d'écran (bonus si présent).
        if (self::hasExif($imagePath)) {
            $score += 15;
            $flags[] = 'exif_present';
        }

        $score = max(0, min(100, $score));
        return [
            'score' => $score,
            'flags' => array_values(array_unique($flags)),
            'passed' => $score >= self::PASS_THRESHOLD,
        ];
    }

    /** Vrai si l'image expose des métadonnées EXIF exploitables (JPEG). */
    private static function hasExif(string $path): bool
    {
        if (!function_exists('exif_read_data')) {
            return false;
        }
        $type = (int) (@exif_imagetype($path) ?: 0);
        if ($type !== IMAGETYPE_JPEG && $type !== IMAGETYPE_TIFF_II && $type !== IMAGETYPE_TIFF_MM) {
            return false;
        }
        $exif = @exif_read_data($path);
        return is_array($exif) && (isset($exif['Make']) || isset($exif['Model']) || isset($exif['DateTimeOriginal']));
    }
}

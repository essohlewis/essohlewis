<?php
declare(strict_types=1);

namespace Amoura\Services\Verification;

/**
 * Contrat d'un vérificateur de selfie (Phase 4, Sprint +10).
 * Interface volontairement simple pour brancher un prestataire réel de
 * détection de vivacité (FaceTec, AWS Rekognition, Onfido…) en remplacement de
 * l'heuristique v1, sans toucher au reste du flux de vérification.
 */
interface LivenessChecker
{
    /**
     * Pré-analyse un selfie. Le score alimente la file de revue humaine :
     * un score très faible peut être auto-rejeté, un score élevé est priorisé.
     *
     * @return array{score:int, flags:array<string>, passed:bool}
     *         score 0–100 · flags explicatifs · passed = au-dessus du plancher
     */
    public function analyze(string $imagePath): array;
}

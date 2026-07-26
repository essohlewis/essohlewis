<?php
declare(strict_types=1);

namespace Amoura\Services\Moderation;

/**
 * Modération de contenu — v1 heuristique (règles pondérées).
 *
 * Cible les risques typiques d'une plateforme de rencontres :
 *  - fuite de coordonnées (numéro, email, réseaux) → sortie de plateforme / arnaque ;
 *  - arnaques financières (crypto, mandat, cadeaux) ;
 *  - harcèlement / propos haineux ;
 *  - sollicitation explicite ;
 *  - spam (majuscules, répétitions, liens).
 *
 * Verdict : score 0–100 + étiquettes + action (allow / review / block).
 */
final class ContentModerator implements Moderator
{
    // Seuils de décision.
    private const REVIEW_THRESHOLD = 40;
    private const BLOCK_THRESHOLD  = 75;

    /** @var array<string,int> motif => poids */
    private const SCAM_TERMS = [
        'bitcoin' => 25, 'crypto' => 20, 'investissement' => 20, 'investment' => 20,
        'western union' => 30, 'mandat' => 20, 'gift card' => 30, 'carte cadeau' => 30,
        'transfert' => 15, 'send money' => 30, 'envoyer de l\'argent' => 30,
        'héritage' => 25, 'inheritance' => 25, 'prince' => 10, 'loterie' => 25, 'lottery' => 25,
    ];

    private const HATE_TERMS = [
        'connard' => 40, 'salope' => 40, 'pute' => 40, 'bitch' => 40, 'whore' => 40,
        'fuck you' => 40, 'nique' => 30, 'faggot' => 50, 'retard' => 25,
    ];

    private const SOLICIT_TERMS = [
        'nude' => 35, 'nudes' => 35, 'sexe tarifé' => 45, 'escort' => 40,
        'onlyfans' => 30, 'sugar daddy' => 25, 'sugar baby' => 25,
    ];

    public function analyze(string $text): array
    {
        $normalized = mb_strtolower($text);
        $score = 0;
        $flags = [];

        // 1) Coordonnées personnelles (fuite hors plateforme).
        if ($this->hasPhoneNumber($normalized)) {
            $score += 40;
            $flags[] = 'contact_phone';
        }
        if (preg_match('/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i', $text)) {
            $score += 30;
            $flags[] = 'contact_email';
        }
        if (preg_match('/\b(whatsapp|telegram|snap(chat)?|insta(gram)?|signal)\b/i', $normalized)
            || preg_match('/(^|\s)@[a-z0-9_]{3,}/i', $text)) {
            $score += 20;
            $flags[] = 'contact_social';
        }

        // 2) Listes pondérées.
        $score += $this->matchWeighted($normalized, self::SCAM_TERMS, $flags, 'scam');
        $score += $this->matchWeighted($normalized, self::HATE_TERMS, $flags, 'harassment');
        $score += $this->matchWeighted($normalized, self::SOLICIT_TERMS, $flags, 'solicitation');

        // 3) Liens externes.
        if (preg_match('#https?://#i', $text)) {
            $score += 15;
            $flags[] = 'external_link';
        }

        // 4) Spam : majuscules excessives / caractères répétés.
        if ($this->isShouting($text)) {
            $score += 10;
            $flags[] = 'shouting';
        }
        if (preg_match('/(.)\1{6,}/u', $text)) {
            $score += 10;
            $flags[] = 'repetition';
        }

        $score = min(100, $score);
        $action = $score >= self::BLOCK_THRESHOLD ? 'block'
            : ($score >= self::REVIEW_THRESHOLD ? 'review' : 'allow');

        return ['score' => $score, 'flags' => array_values(array_unique($flags)), 'action' => $action];
    }

    private function matchWeighted(string $text, array $terms, array &$flags, string $flag): int
    {
        $added = 0;
        foreach ($terms as $term => $weight) {
            if (str_contains($text, $term)) {
                $added += $weight;
            }
        }
        if ($added > 0) {
            $flags[] = $flag;
        }
        return $added;
    }

    /** Détecte une suite de 8+ chiffres éventuellement espacés (numéro de téléphone). */
    private function hasPhoneNumber(string $text): bool
    {
        $digits = preg_replace('/[\s.\-()]/', '', $text) ?? '';
        return (bool) preg_match('/(\+?\d{8,15})/', $digits);
    }

    private function isShouting(string $text): bool
    {
        $letters = preg_replace('/[^a-zA-ZÀ-ÿ]/u', '', $text) ?? '';
        if (mb_strlen($letters) < 12) {
            return false;
        }
        $upper = preg_replace('/[^A-ZÀ-Þ]/u', '', $letters) ?? '';
        return mb_strlen($upper) / max(1, mb_strlen($letters)) > 0.7;
    }
}

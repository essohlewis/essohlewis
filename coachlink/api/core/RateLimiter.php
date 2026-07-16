<?php
/* ==========================================================================
   core/RateLimiter.php — Limitation de débit « fenêtre fixe » par IP + seau.
   Stockage fichier (aucune dépendance), verrou flock pour la concurrence.
   Répond 429 (avec Retry-After) au-delà du quota. Tolérant aux pannes d'E/S :
   en cas d'échec disque, on n'interrompt pas le service.
   ========================================================================== */

class RateLimiter
{
    /**
     * @param string $seau     nom logique (ex: "global", "auth")
     * @param int    $max      requêtes autorisées par fenêtre (<= 0 → désactivé)
     * @param int    $fenetre  durée de la fenêtre en secondes
     */
    public static function verifier(string $seau, int $max, int $fenetre = 60): void
    {
        if ($max <= 0) {
            return;
        }
        $dossier = rtrim(App::config('cache_dir', sys_get_temp_dir() . '/coachlink-cache'), '/') . '/ratelimit';
        if (!is_dir($dossier) && !@mkdir($dossier, 0775, true) && !is_dir($dossier)) {
            return; // impossible de créer le cache → on ne bloque pas
        }
        $fichier = $dossier . '/' . md5($seau . '|' . self::ip()) . '.json';

        $now = time();
        $fp = @fopen($fichier, 'c+');
        if (!$fp) {
            return;
        }
        flock($fp, LOCK_EX);
        $contenu = stream_get_contents($fp);
        $etat = json_decode($contenu ?: '[]', true);
        if (!is_array($etat) || !isset($etat['debut']) || ($now - (int) $etat['debut']) >= $fenetre) {
            $etat = ['debut' => $now, 'count' => 0];
        }
        $etat['count'] = (int) $etat['count'] + 1;
        ftruncate($fp, 0);
        rewind($fp);
        fwrite($fp, json_encode($etat));
        flock($fp, LOCK_UN);
        fclose($fp);

        if ($etat['count'] > $max) {
            $reste = max(1, $fenetre - ($now - (int) $etat['debut']));
            header('Retry-After: ' . $reste);
            Response::erreur('Trop de requêtes. Réessayez dans ' . $reste . ' s.', 429);
        }
    }

    /** Adresse IP du client (REMOTE_ADDR — fiable même derrière un proxy simple). */
    private static function ip(): string
    {
        return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    }
}

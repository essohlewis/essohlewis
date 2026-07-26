<?php
declare(strict_types=1);

namespace Amoura\Services\Security;

use Amoura\Core\Database;
use Amoura\Models\Notification;

/**
 * Détection d'appareils & alerte de connexion depuis un nouvel appareil (Sprint +6).
 * Empreinte = hash(user-agent + préfixe réseau de l'IP) — tolère les IP dynamiques.
 */
final class DeviceMonitor
{
    /**
     * Enregistre l'appareil de connexion ; notifie si c'est un NOUVEL appareil
     * (et que l'utilisateur en avait déjà d'autres).
     * @return bool true si nouvel appareil.
     */
    public static function track(int $userId, string $userAgent, string $ip): bool
    {
        $fingerprint = hash('sha256', $userAgent . '|' . self::networkPrefix($ip));
        $db = Database::connection();

        $exists = $db->prepare('SELECT id FROM login_devices WHERE user_id = ? AND fingerprint = ?');
        $exists->execute([$userId, $fingerprint]);
        if ($exists->fetchColumn()) {
            $db->prepare('UPDATE login_devices SET last_seen_at = NOW(), last_ip = ? WHERE user_id = ? AND fingerprint = ?')
               ->execute([@inet_pton($ip) ?: null, $userId, $fingerprint]);
            return false;
        }

        $priorCount = (int) (function () use ($db, $userId) {
            $s = $db->prepare('SELECT COUNT(*) FROM login_devices WHERE user_id = ?');
            $s->execute([$userId]);
            return $s->fetchColumn();
        })();

        $db->prepare('INSERT INTO login_devices (user_id, fingerprint, user_agent, last_ip) VALUES (?, ?, ?, ?)')
           ->execute([$userId, $fingerprint, mb_substr($userAgent, 0, 255), @inet_pton($ip) ?: null]);

        // Alerte seulement si ce n'est pas le tout premier appareil connu.
        if ($priorCount > 0) {
            (new Notification())->push($userId, 'system', null, [
                'message' => 'Nouvelle connexion détectée depuis un appareil inconnu. Si ce n\'était pas vous, changez votre mot de passe.',
            ]);
        }
        return true;
    }

    /** Préfixe réseau : /24 en IPv4, /48 en IPv6 (limite le bruit des IP changeantes). */
    private static function networkPrefix(string $ip): string
    {
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $parts = explode('.', $ip);
            return $parts[0] . '.' . ($parts[1] ?? '0') . '.' . ($parts[2] ?? '0');
        }
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
            return implode(':', array_slice(explode(':', $ip), 0, 3));
        }
        return $ip;
    }
}

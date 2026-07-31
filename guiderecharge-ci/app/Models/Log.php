<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Model;

/**
 * Journalisation : actions admin et compteur de générations de codes USSD.
 */
final class Log extends Model
{
    protected string $table = 'admin_logs';

    /**
     * Enregistre une action d'administration.
     */
    public function adminAction(int $adminId, string $action, string $details = ''): void
    {
        $stmt = $this->db->prepare(
            'INSERT INTO admin_logs (admin_id, action, details, ip, created_at) '
            . 'VALUES (:admin_id, :action, :details, :ip, :created_at)'
        );
        $stmt->execute([
            'admin_id'   => $adminId,
            'action'     => $action,
            'details'    => $details,
            'ip'         => $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0',
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /**
     * Derniers logs admin (dashboard).
     *
     * @return array<int, array<string, mixed>>
     */
    public function recent(int $limit = 15): array
    {
        $limit = max(1, min(100, $limit));
        $sql = 'SELECT l.*, a.nom AS admin_nom FROM admin_logs l '
            . 'LEFT JOIN admin_users a ON a.id = l.admin_id '
            . 'ORDER BY l.created_at DESC LIMIT ' . $limit;
        return $this->db->query($sql)->fetchAll();
    }

    /**
     * Incrémente le compteur global de générations USSD (statistiques).
     */
    public function logUssdGeneration(string $operateurSlug, string $action): void
    {
        $stmt = $this->db->prepare(
            'INSERT INTO ussd_generations (operateur_slug, action, created_at) '
            . 'VALUES (:slug, :action, :created_at)'
        );
        $stmt->execute([
            'slug'       => $operateurSlug,
            'action'     => $action,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }

    /** Nombre total de générations de codes USSD. */
    public function ussdGenerationCount(): int
    {
        return (int) $this->db->query('SELECT COUNT(*) FROM ussd_generations')->fetchColumn();
    }
}

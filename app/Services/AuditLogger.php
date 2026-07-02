<?php

declare(strict_types=1);

namespace Transouscris\Services;

use Transouscris\Core\Database;
use Transouscris\Core\Session;

/**
 * Journal d'audit persistant (table audit_logs) pour toutes les opérations
 * sensibles : écritures au grand livre, connexions, changements de statut de
 * paiement, actions admin. Immuable par convention (jamais d'UPDATE/DELETE).
 */
final class AuditLogger
{
    public function log(
        string $action,
        string $entityType,
        ?int $entityId = null,
        array $metadata = [],
        ?int $userId = null
    ): void {
        $userId ??= Session::userId();
        $ip = $_SERVER['REMOTE_ADDR'] ?? null;

        Database::connection()->prepare(
            'INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address, metadata, created_at)
             VALUES (:uid, :action, :etype, :eid, :ip, :meta, NOW())'
        )->execute([
            'uid'    => $userId,
            'action' => $action,
            'etype'  => $entityType,
            'eid'    => $entityId,
            'ip'     => $ip,
            'meta'   => json_encode($metadata, JSON_UNESCAPED_UNICODE),
        ]);
    }
}

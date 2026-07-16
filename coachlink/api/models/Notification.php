<?php
/* ==========================================================================
   models/Notification.php — Notifications in-app par destinataire.
   ========================================================================== */

class Notification extends Model
{
    protected string $table = 'notifications';

    public function ajouter(int $pour, string $type, string $texte, ?string $lien = null): void
    {
        if (!$pour) return;
        $this->inserer([
            'pour'  => $pour,
            'type'  => $type,
            'texte' => $texte,
            'lien'  => $lien,
            'lu'    => 0,
            'date'  => date('c'),
        ]);
    }

    public function parUtilisateur(int $userId): array
    {
        return $this->ou(['pour' => $userId], 'date DESC');
    }

    public function nbNonLues(int $userId): int
    {
        $r = $this->requete("SELECT COUNT(*) n FROM notifications WHERE pour = ? AND lu = 0", [$userId]);
        return (int) ($r[0]['n'] ?? 0);
    }

    public function marquerLue(int $id): void { $this->maj($id, ['lu' => 1]); }

    public function marquerToutesLues(int $userId): void
    {
        $stmt = $this->pdo()->prepare("UPDATE notifications SET lu = 1 WHERE pour = ?");
        $stmt->execute([$userId]);
    }
}

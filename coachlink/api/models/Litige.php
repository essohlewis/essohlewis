<?php
/* ==========================================================================
   models/Litige.php — File de litiges (réclamations client ⇄ coach).
   Statuts : ouvert → en_cours → resolu.
   ========================================================================== */

class Litige extends Model
{
    protected string $table = 'litiges';

    public function toutes(): array
    {
        return $this->tout('CASE statut WHEN \'ouvert\' THEN 0 WHEN \'en_cours\' THEN 1 ELSE 2 END, id DESC');
    }

    /** Ouvre un litige (déposé par un client). */
    public function ouvrir(array $d): array
    {
        $id = (int) $this->inserer([
            'client_id'  => $d['clientId'] ?? null,
            'client_nom' => $d['clientNom'] ?? 'Client',
            'coach_nom'  => $d['coachNom'] ?? '',
            'motif'      => $d['motif'] ?? '',
            'statut'     => 'ouvert',
            'date'       => date('c'),
        ]);
        return $this->trouver($id);
    }

    public function changerStatut(int $id, string $statut): void
    {
        $this->pdo()->prepare("UPDATE litiges SET statut = ? WHERE id = ?")->execute([$statut, $id]);
    }
}

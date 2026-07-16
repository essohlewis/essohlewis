<?php
/* ==========================================================================
   models/Review.php — Avis clients ; recalcule la note moyenne du coach.
   ========================================================================== */

class Review extends Model
{
    protected string $table = 'avis';

    public function ajouter(string $coachId, array $d): array
    {
        $id = $this->inserer([
            'coach_id' => $coachId,
            'auteur'   => $d['auteur'],
            'note'     => (int) $d['note'],
            'texte'    => $d['texte'],
            'reponse'  => null,
            'date'     => date('c'),
        ]);
        $this->recalculerNote($coachId);
        return $this->trouver($id);
    }

    public function repondre(int $avisId, string $reponse): void
    {
        $this->maj($avisId, ['reponse' => $reponse]);
    }

    /** Met à jour note moyenne + nombre d'avis du coach. */
    private function recalculerNote(string $coachId): void
    {
        $r = $this->requete("SELECT COUNT(*) n, AVG(note) m FROM avis WHERE coach_id = ?", [$coachId]);
        $n = (int) $r[0]['n'];
        $m = round((float) $r[0]['m'], 1);
        $stmt = $this->pdo()->prepare("UPDATE coachs SET nb_avis = ?, note = ? WHERE id = ?");
        $stmt->execute([$n, $m, $coachId]);
    }
}

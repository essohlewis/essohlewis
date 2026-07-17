<?php
/* ==========================================================================
   models/Portefeuille.php — Retraits du portefeuille coach (débits).
   ========================================================================== */

class Portefeuille extends Model
{
    protected string $table = 'portefeuille_retraits';

    public function parCoach(string $coachId): array
    {
        return $this->ou(['coach_id' => $coachId], 'id DESC');
    }

    public function enregistrerRetrait(string $coachId, int $montant, string $operateur, string $numero, string $reference): array
    {
        $id = $this->inserer([
            'coach_id'  => $coachId,
            'montant'   => $montant,
            'operateur' => $operateur,
            'numero'    => $numero,
            'statut'    => 'effectue',
            'reference' => $reference,
            'date'      => date('c'),
        ]);
        return $this->trouver($id);
    }
}

<?php
/* ==========================================================================
   models/Defi.php — Défis lancés par le coach au client.
   ========================================================================== */

class Defi extends Model
{
    protected string $table = 'defis';

    public function parClient(int $clientId): array { return $this->ou(['client_id' => $clientId], 'id DESC'); }
    public function parCoach(string $coachId): array { return $this->ou(['coach_id' => $coachId], 'id DESC'); }

    public function creer(array $d): array
    {
        $id = (int) $this->inserer([
            'coach_id'    => $d['coachId'],
            'coach_nom'   => $d['coachNom'] ?? '',
            'client_id'   => (int) $d['clientId'],
            'client_nom'  => $d['clientNom'] ?? '',
            'titre'       => $d['titre'] ?? '',
            'description' => $d['description'] ?? '',
            'echeance'    => $d['echeance'] ?? '',
            'statut'      => 'propose',
            'cree_le'     => date('c'),
        ]);
        return $this->trouver($id);
    }

    public function changerStatut(int $id, string $statut): array
    {
        $this->maj($id, ['statut' => $statut, 'valide_le' => date('c')]);
        return $this->trouver($id);
    }
}

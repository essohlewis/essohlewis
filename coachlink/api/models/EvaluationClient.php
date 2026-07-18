<?php
/* ==========================================================================
   models/EvaluationClient.php — Le coach évalue le sérieux du client.
   ========================================================================== */

class EvaluationClient extends Model
{
    protected string $table = 'evaluations_client';

    public function parClient(int $clientId): array { return $this->ou(['client_id' => $clientId], 'id DESC'); }

    public function ajouter(int $clientId, array $d): array
    {
        $id = (int) $this->inserer([
            'client_id' => $clientId,
            'coach_id'  => $d['coachId'] ?? '',
            'coach_nom' => $d['coachNom'] ?? '',
            'note'      => (int) ($d['note'] ?? 0),
            'texte'     => $d['texte'] ?? '',
            'date'      => date('c'),
        ]);
        return $this->trouver($id);
    }
}

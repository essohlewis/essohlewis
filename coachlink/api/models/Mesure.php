<?php
/* ==========================================================================
   models/Mesure.php — Suivi santé / progrès du client (mensurations + photo).
   ========================================================================== */

class Mesure extends Model
{
    protected string $table = 'mesures';

    public function parClient(int $clientId): array { return $this->ou(['client_id' => $clientId], 'date ASC'); }

    public function ajouter(int $clientId, array $d): array
    {
        $num = fn($v) => ($v === null || $v === '') ? null : $v;
        $id = (int) $this->inserer([
            'client_id'    => $clientId,
            'date'         => $d['date'] ?? date('c'),
            'poids'        => $num($d['poids'] ?? null),
            'tour_taille'  => $num($d['tourTaille'] ?? null),
            'tour_hanches' => $num($d['tourHanches'] ?? null),
            'tour_bras'    => $num($d['tourBras'] ?? null),
            'note'         => $d['note'] ?? '',
            'photo'        => $d['photo'] ?? null,
        ]);
        return $this->trouver($id);
    }
}

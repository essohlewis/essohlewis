<?php
/* ==========================================================================
   models/Reservation.php — Réservations + paiement Mobile Money simulé.
   ========================================================================== */

class Reservation extends Model
{
    protected string $table = 'reservations';

    public function parClient(int $clientId): array
    {
        return $this->ou(['client_id' => $clientId], 'cree_le DESC');
    }

    /** Toutes les réservations (administration). */
    public function toutes(): array
    {
        return $this->tout('cree_le DESC');
    }

    public function parCoach(string $coachId): array
    {
        return $this->ou(['coach_id' => $coachId], 'cree_le DESC');
    }

    public function creer(array $d): array
    {
        $id = $this->inserer([
            'coach_id'   => $d['coachId'],
            'client_id'  => $d['clientId'],
            'client_nom' => $d['clientNom'],
            'tarif_id'   => $d['tarifId'],
            'tarif_nom'  => $d['tarifNom'],
            'prix'       => $d['prix'],
            'duree'      => $d['duree'] ?? 60,
            'jour'       => $d['jour'],
            'heure'      => $d['heure'],
            'message'    => $d['message'] ?? '',
            'lieu_type'  => $d['lieuType'] ?? '',
            'lieu_nom'   => $d['lieuNom'] ?? '',
            'adresse'    => $d['adresse'] ?? '',
            'ville'      => $d['ville'] ?? '',
            'commune'    => $d['commune'] ?? '',
            'quartier'   => $d['quartier'] ?? '',
            'lat'        => $d['lat'] ?? '',
            'lng'        => $d['lng'] ?? '',
            'statut'     => 'en_attente',
            'cree_le'    => date('c'),
        ]);
        return $this->trouver($id);
    }

    /** Enregistre le paiement (avec remise promo éventuelle). */
    public function payer(int $id, array $p): array
    {
        $resa = $this->trouver($id);
        $remise = 0;
        if (!empty($p['promoTaux'])) {
            $remise = (int) round(($resa['prix'] * $p['promoTaux']) / 100);
        }
        $montant = $resa['prix'] - $remise;
        $this->maj($id, [
            'paye'             => 1,
            'paiement_op'      => $p['operateur'],
            'paiement_numero'  => $p['numero'],
            'paiement_montant' => $montant,
            'paiement_remise'  => $remise,
            'paiement_promo'   => $p['promoCode'] ?? null,
            'paiement_ref'     => $p['reference'] ?? ('MM' . substr((string) (time() . random_int(10, 99)), -8)),
            'paiement_date'    => date('c'),
        ]);
        return $this->trouver($id);
    }

    public function changerStatut(int $id, string $statut): void
    {
        $data = ['statut' => $statut];
        // À la confirmation, on génère le jeton de présence (matérialisé en QR
        // côté client) si absent : il servira de preuve de présence en fin de séance.
        if ($statut === 'confirmee') {
            $resa = $this->trouver($id);
            if ($resa && empty($resa['jeton'])) {
                $data['jeton'] = self::genererJeton($id);
            }
        }
        $this->maj($id, $data);
    }

    /** Jeton de présence unique et non devinable. */
    public static function genererJeton(int $id): string
    {
        return 'CLQR-' . $id . '-' . bin2hex(random_bytes(8));
    }

    /**
     * Le coach valide la présence via le code du QR : preuve que la séance a bien
     * eu lieu → la réservation passe « terminée » et les fonds sont libérés.
     * @return array{ok:bool, resa?:array, message?:string}
     */
    public function validerPresence(int $id, string $code): array
    {
        $resa = $this->trouver($id);
        if (!$resa) {
            return ['ok' => false, 'message' => 'Réservation introuvable.'];
        }
        if ($resa['statut'] === 'terminee' && (int) $resa['presence_validee'] === 1) {
            return ['ok' => false, 'message' => 'Présence déjà validée.'];
        }
        if (empty($resa['jeton']) || !hash_equals((string) $resa['jeton'], trim($code))) {
            return ['ok' => false, 'message' => 'Code QR invalide.'];
        }
        $this->maj($id, ['presence_validee' => 1, 'presence_le' => date('c'), 'statut' => 'terminee']);
        return ['ok' => true, 'resa' => $this->trouver($id)];
    }

    /** Met à jour le lieu du rendez-vous (ajusté par le coach). */
    public function majLieu(int $id, array $d): array
    {
        $this->maj($id, [
            'lieu_type' => $d['lieuType'] ?? '',
            'lieu_nom'  => $d['lieuNom'] ?? '',
            'adresse'   => $d['adresse'] ?? '',
            'ville'     => $d['ville'] ?? '',
            'commune'   => $d['commune'] ?? '',
            'quartier'  => $d['quartier'] ?? '',
            'lat'       => $d['lat'] ?? '',
            'lng'       => $d['lng'] ?? '',
        ]);
        return $this->trouver($id);
    }
}

<?php
/* ==========================================================================
   models/Abonnement.php — Abonnements mensuels (programme client ↔ coach).
   Cycle : demande (client) → propose (coach fixe programme + prix) →
   actif (client accepte + paie) → termine / annule.
   ========================================================================== */

class Abonnement extends Model
{
    protected string $table = 'abonnements';

    /** Décode le programme (grille hebdo JSON) et joint les paiements. */
    public function complet(int $id): ?array
    {
        $a = $this->trouver($id);
        return $a ? $this->assembler($a) : null;
    }

    private function assembler(array $a): array
    {
        $a['programme']    = $a['programme'] ? (json_decode($a['programme'], true) ?: []) : [];
        $a['inclut_salle'] = (int) $a['inclut_salle'];
        $a['paiements']    = $this->requete(
            "SELECT * FROM abonnement_paiements WHERE abonnement_id = ? ORDER BY id DESC", [$a['id']]
        );
        return $a;
    }

    public function parClient(int $clientId): array
    {
        return array_map([$this, 'assembler'], $this->ou(['client_id' => $clientId], 'id DESC'));
    }

    public function parCoach(string $coachId): array
    {
        return array_map([$this, 'assembler'], $this->ou(['coach_id' => $coachId], 'id DESC'));
    }

    /** Crée une demande d'abonnement (côté client). */
    public function creer(array $d): array
    {
        $prixSeance = (int) ($d['prixSeance'] ?? 0);
        $seances    = max(1, (int) ($d['seancesSemaine'] ?? 1));
        $id = (int) $this->inserer([
            'client_id'       => (int) $d['clientId'],
            'client_nom'      => $d['clientNom'] ?? '',
            'coach_id'        => $d['coachId'],
            'coach_nom'       => $d['coachNom'] ?? '',
            'objectif'        => $d['objectif'] ?? '',
            'seances_semaine' => $seances,
            'lieu_type'       => $d['lieuType'] ?? 'salle_coach',
            'lieu_nom'        => $d['lieuNom'] ?? '',
            'adresse'         => $d['adresse'] ?? '',
            'ville'           => $d['ville'] ?? '',
            'commune'         => $d['commune'] ?? '',
            'quartier'        => $d['quartier'] ?? '',
            'lat'             => $d['lat'] ?? '',
            'lng'             => $d['lng'] ?? '',
            'prix_seance'     => $prixSeance,
            'prix_mensuel'    => $prixSeance * $seances * 4, // 4 semaines, hors abonnement salle
            'inclut_salle'    => !empty($d['inclutSalle']) ? 1 : 0,
            'fixe_par'        => ($d['fixePar'] ?? 'client') === 'coach' ? 'coach' : 'client',
            'programme'       => null,
            'statut'          => 'demande',
            'cree_le'         => date('c'),
        ]);
        return $this->complet($id);
    }

    /** Le coach fixe le programme hebdomadaire + le prix, et propose. */
    public function definirProgramme(int $id, array $d): array
    {
        $a = $this->trouver($id);
        if (!$a) return [];
        $seances    = max(1, (int) ($d['seancesSemaine'] ?? $a['seances_semaine']));
        $prixSeance = (int) ($d['prixSeance'] ?? $a['prix_seance']);
        // Le coach fixe et signe les termes du contrat en proposant le programme.
        $this->maj($id, [
            'programme'        => json_encode($d['programme'] ?? []),
            'seances_semaine'  => $seances,
            'prix_seance'      => $prixSeance,
            'prix_mensuel'     => $prixSeance * $seances * 4,
            'lieu_nom'         => $d['lieuNom'] ?? $a['lieu_nom'],
            'statut'           => 'propose',
            'contrat_ref'      => $a['contrat_ref'] ?: ('CTR-' . $id . '-' . bin2hex(random_bytes(4))),
            'contrat_coach_le' => date('c'),
        ]);
        return $this->complet($id);
    }

    public function changerStatut(int $id, string $statut): void
    {
        $champs = ['statut' => $statut];
        if ($statut === 'actif') {
            $champs['date_debut'] = date('c');
            $champs['date_fin']   = date('c', strtotime('+1 month'));
            // Le client accepte et signe le contrat en activant l'abonnement.
            $a = $this->trouver($id);
            if ($a && empty($a['contrat_client_le'])) {
                $champs['contrat_client_le'] = date('c');
                if (empty($a['contrat_ref'])) {
                    $champs['contrat_ref'] = 'CTR-' . $id . '-' . bin2hex(random_bytes(4));
                }
            }
        }
        $this->maj($id, $champs);
    }

    /** Enregistre le règlement d'un mois. */
    public function enregistrerPaiement(int $id, array $p): array
    {
        $this->pdo()->prepare(
            "INSERT INTO abonnement_paiements (abonnement_id, mois, montant, operateur, reference, date)
             VALUES (?,?,?,?,?,?)"
        )->execute([
            $id, $p['mois'] ?? date('Y-m'), (int) ($p['montant'] ?? 0),
            $p['operateur'] ?? '', $p['reference'] ?? '', date('c'),
        ]);
        return $this->complet($id);
    }

    /** True si le mois donné (Y-m) est déjà réglé. */
    public function moisRegle(int $id, string $mois): bool
    {
        $r = $this->requete("SELECT 1 FROM abonnement_paiements WHERE abonnement_id = ? AND mois = ?", [$id, $mois]);
        return !empty($r);
    }

    /** Active/désactive le renouvellement automatique. */
    public function definirAutoRenouvellement(int $id, bool $actif): array
    {
        $this->maj($id, ['auto_renouvellement' => $actif ? 1 : 0]);
        return $this->complet($id);
    }
}

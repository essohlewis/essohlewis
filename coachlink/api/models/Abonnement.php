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
        $a['exercices']    = !empty($a['exercices']) ? (json_decode($a['exercices'], true) ?: []) : [];
        $a['inclut_salle'] = (int) $a['inclut_salle'];
        $a['paiements']    = $this->requete(
            "SELECT * FROM abonnement_paiements WHERE abonnement_id = ? ORDER BY id DESC", [$a['id']]
        );
        $a['seances']      = $this->requete(
            "SELECT mois, fenetre, date FROM abonnement_seances WHERE abonnement_id = ? ORDER BY id", [$a['id']]
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
        // À la résiliation, on solde les mois en séquestre au prorata des séances.
        if ($statut === 'termine' || $statut === 'annule') {
            $this->reglerAuProrata($id);
        }
    }

    /** Jeton secret (graine du QR de présence rotatif de l'abonnement). */
    public static function genererJeton(int $id): string
    {
        return 'CLQR-abo' . $id . '-' . bin2hex(random_bytes(8));
    }

    /**
     * Enregistre le règlement d'un mois — SOUS SÉQUESTRE : libere = 0.
     * Le montant n'ira au portefeuille du coach qu'après validation de toutes
     * les séances prévues du mois (seances_prevues = séances/semaine × 4).
     */
    public function enregistrerPaiement(int $id, array $p): array
    {
        $abo = $this->trouver($id);
        $prevues = (int) ($p['seancesPrevues'] ?? (max(1, (int) ($abo['seances_semaine'] ?? 1)) * 4));
        // Génère le jeton de présence de l'abonnement s'il n'existe pas encore.
        if ($abo && empty($abo['jeton'])) {
            $this->maj($id, ['jeton' => self::genererJeton($id)]);
        }
        $this->pdo()->prepare(
            "INSERT INTO abonnement_paiements (abonnement_id, mois, montant, operateur, reference, date, seances_prevues, seances_validees, libere)
             VALUES (?,?,?,?,?,?,?,0,0)"
        )->execute([
            $id, $p['mois'] ?? date('Y-m'), (int) ($p['montant'] ?? 0),
            $p['operateur'] ?? '', $p['reference'] ?? '', date('c'), $prevues,
        ]);
        return $this->complet($id);
    }

    /**
     * Le coach valide UNE séance d'abonnement via le QR rotatif du client.
     * Comptabilise la séance du mois courant ; libère la mensualité vers le
     * portefeuille dès que toutes les séances prévues ont été validées.
     * @return array{ok:bool, message?:string, validees?:int, prevues?:int, libere?:bool}
     */
    public function validerSeance(int $id, string $code, ?int $t = null): array
    {
        $abo = $this->trouver($id);
        if (!$abo) {
            return ['ok' => false, 'message' => 'Abonnement introuvable.'];
        }
        if (empty($abo['jeton'])) {
            return ['ok' => false, 'message' => 'Abonnement non actif (aucun règlement).'];
        }
        $fen = Otp::fenetreValide((string) $abo['jeton'], $code, $t);
        if ($fen === null) {
            return ['ok' => false, 'message' => 'Code de présence invalide ou expiré.'];
        }
        $mois = date('Y-m', $t ?? time());
        $paie = $this->requete("SELECT * FROM abonnement_paiements WHERE abonnement_id = ? AND mois = ?", [$id, $mois]);
        if (empty($paie)) {
            return ['ok' => false, 'message' => 'Le mois en cours n\'est pas encore réglé.'];
        }
        $p = $paie[0];
        // Anti-doublon : une même fenêtre OTP ne compte qu'une seule fois.
        $deja = $this->requete("SELECT 1 FROM abonnement_seances WHERE abonnement_id = ? AND fenetre = ?", [$id, $fen]);
        if (!empty($deja)) {
            return ['ok' => false, 'message' => 'Cette séance vient déjà d\'être validée.'];
        }
        $this->pdo()->prepare("INSERT INTO abonnement_seances (abonnement_id, mois, fenetre, date) VALUES (?,?,?,?)")
            ->execute([$id, $mois, $fen, date('c')]);

        $validees = (int) $p['seances_validees'] + 1;
        $prevues  = (int) $p['seances_prevues'];
        $libere   = $validees >= $prevues ? 1 : 0;
        // Toutes les séances validées → mensualité intégralement libérée.
        $montantLibere = $libere ? (int) $p['montant'] : (int) $p['montant_libere'];
        $this->pdo()->prepare("UPDATE abonnement_paiements SET seances_validees = ?, libere = ?, montant_libere = ? WHERE id = ?")
            ->execute([$validees, $libere, $montantLibere, (int) $p['id']]);

        return ['ok' => true, 'validees' => $validees, 'prevues' => $prevues, 'libere' => (bool) $libere];
    }

    /**
     * Règlement AU PRORATA à la résiliation : pour chaque mois réglé mais non
     * finalisé, le coach reçoit la part des séances validées, la cliente est
     * remboursée du reste. Renvoie [['mois','coach','rembourse'], …].
     */
    public function reglerAuProrata(int $id): array
    {
        $regles = [];
        $paie = $this->requete("SELECT * FROM abonnement_paiements WHERE abonnement_id = ? AND libere = 0", [$id]);
        foreach ($paie as $p) {
            $montant  = (int) $p['montant'];
            $prevues  = max(1, (int) $p['seances_prevues']);
            $validees = (int) $p['seances_validees'];
            $coach    = (int) round($montant * min($validees, $prevues) / $prevues);
            $rembours = $montant - $coach;
            $this->pdo()->prepare("UPDATE abonnement_paiements SET libere = 1, montant_libere = ?, rembourse = ? WHERE id = ?")
                ->execute([$coach, $rembours, (int) $p['id']]);
            $regles[] = ['mois' => $p['mois'], 'coach' => $coach, 'rembourse' => $rembours, 'validees' => $validees, 'prevues' => $prevues];
        }
        return $regles;
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

    /** Enregistre le programme d'entraînement détaillé (liste d'exercices). */
    public function definirExercices(int $id, array $exercices): array
    {
        $this->maj($id, ['exercices' => json_encode(array_values($exercices))]);
        return $this->complet($id);
    }
}

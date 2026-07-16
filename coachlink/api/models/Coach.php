<?php
/* ==========================================================================
   models/Coach.php — Coachs et données liées (tarifs, diplômes,
   disponibilités, avis, galerie, posts). Assemble un objet complet et
   calcule le TrustScore + les badges (même logique que le front).
   ========================================================================== */

class Coach extends Model
{
    protected string $table = 'coachs';

    /** Coach complet (avec relations) par identifiant. */
    public function complet(string $id): ?array
    {
        $c = $this->trouver($id);
        if (!$c) return null;
        return $this->assembler($c);
    }

    /** Coach lié à un utilisateur propriétaire. */
    public function parProprietaire(int $userId): ?array
    {
        $c = $this->parColonne('proprietaire', $userId);
        return $c ? $this->assembler($c) : null;
    }

    /**
     * Recherche filtrée. $f = { texte, specialite, commune, langue, noteMin,
     * prixMax, tri }.
     */
    public function rechercher(array $f): array
    {
        $sql = "SELECT DISTINCT c.* FROM coachs c";
        $where = [];
        $params = [];

        if (!empty($f['specialite'])) {
            $sql .= " JOIN coach_specialites cs ON cs.coach_id = c.id";
            $where[] = "cs.specialite = ?";
            $params[] = $f['specialite'];
        }
        if (!empty($f['texte'])) {
            $where[] = "(c.prenom LIKE ? OR c.nom LIKE ? OR c.titre LIKE ? OR c.bio LIKE ? OR c.commune LIKE ?)";
            $t = '%' . $f['texte'] . '%';
            array_push($params, $t, $t, $t, $t, $t);
        }
        if (!empty($f['commune'])) { $where[] = "c.commune = ?"; $params[] = $f['commune']; }
        if (!empty($f['noteMin'])) { $where[] = "c.note >= ?"; $params[] = (float) $f['noteMin']; }
        if ($where) $sql .= " WHERE " . implode(' AND ', $where);

        $lignes = $this->requete($sql, $params);
        $coachs = array_map([$this, 'assembler'], $lignes);

        // Filtres nécessitant les relations (langue, prix mini).
        if (!empty($f['langue'])) {
            $coachs = array_filter($coachs, fn($c) => in_array($f['langue'], $c['langues'], true));
        }
        if (!empty($f['prixMax'])) {
            $coachs = array_filter($coachs, fn($c) => $c['prixMin'] <= (float) $f['prixMax']);
        }
        $coachs = array_values($coachs);

        // Tri.
        usort($coachs, function ($a, $b) use ($f) {
            switch ($f['tri'] ?? 'trust') {
                case 'note':      return $b['note'] <=> $a['note'];
                case 'prix_asc':  return $a['prixMin'] <=> $b['prixMin'];
                case 'prix_desc': return $b['prixMin'] <=> $a['prixMin'];
                default:          return $b['trustScore'] <=> $a['trustScore'];
            }
        });
        return $coachs;
    }

    /** Assemble un coach avec ses relations + champs calculés. */
    public function assembler(array $c): array
    {
        $id = $c['id'];
        $c['specialites']     = array_column($this->requete("SELECT specialite FROM coach_specialites WHERE coach_id = ?", [$id]), 'specialite');
        $c['langues']         = array_column($this->requete("SELECT langue FROM coach_langues WHERE coach_id = ?", [$id]), 'langue');
        $c['tarifs']          = $this->requete("SELECT * FROM tarifs WHERE coach_id = ?", [$id]);
        $c['diplomes']        = $this->requete("SELECT * FROM diplomes WHERE coach_id = ?", [$id]);
        $c['avis']            = $this->requete("SELECT * FROM avis WHERE coach_id = ? ORDER BY date DESC", [$id]);
        $c['galerie']         = $this->requete("SELECT * FROM galerie WHERE coach_id = ? ORDER BY date DESC", [$id]);
        $c['posts']           = $this->requete("SELECT * FROM posts WHERE coach_id = ? ORDER BY date DESC", [$id]);

        // Disponibilités regroupées par jour.
        $dispo = ['Lun'=>[], 'Mar'=>[], 'Mer'=>[], 'Jeu'=>[], 'Ven'=>[], 'Sam'=>[], 'Dim'=>[]];
        foreach ($this->requete("SELECT jour, heure FROM disponibilites WHERE coach_id = ?", [$id]) as $d) {
            $dispo[$d['jour']][] = $d['heure'];
        }
        $c['disponibilites'] = $dispo;

        // Champs calculés.
        $c['prixMin']    = $c['tarifs'] ? min(array_column($c['tarifs'], 'prix')) : 0;
        $c['trustScore'] = self::trustScore($c);
        $c['badges']     = self::badges($c);
        return $c;
    }

    /** TrustScore sur 100 (diplômes vérifiés + note + expérience + réactivité). */
    public static function trustScore(array $c): int
    {
        $diplomes = $c['diplomes'] ?? [];
        $dv = count(array_filter($diplomes, fn($d) => $d['statut'] === 'verifie'));
        $total = max(1, count($diplomes));
        $scoreDiplomes = min(30, ($dv / $total) * 30);
        $scoreNote = (($c['note'] ?? 0) / 5) * 30;
        $scoreExp  = min(20, (($c['nb_avis'] ?? 0) / 40) * 12 + (($c['anciennete_mois'] ?? 0) / 48) * 8);
        $scoreRep  = (($c['taux_reponse'] ?? 0) / 100) * 20;
        return (int) round($scoreDiplomes + $scoreNote + $scoreExp + $scoreRep);
    }

    /** Badges mérités. */
    public static function badges(array $c): array
    {
        $badges = [];
        if (array_filter($c['diplomes'] ?? [], fn($d) => $d['statut'] === 'verifie')) $badges[] = 'verifie';
        if (($c['note'] ?? 0) >= 4.8 && ($c['nb_avis'] ?? 0) >= 20) $badges[] = 'top';
        if (($c['taux_reponse'] ?? 0) >= 95) $badges[] = 'reactif';
        if (($c['anciennete_mois'] ?? 0) <= 6) $badges[] = 'nouveau';
        return $badges;
    }
}

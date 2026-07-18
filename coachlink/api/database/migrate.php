<?php
/* ==========================================================================
   database/migrate.php — Crée le schéma (adapté au pilote actif) et importe
   les données de démonstration (admin + 12 coachs depuis /data/coachs.json).

   Usage (depuis api/) :
     php database/migrate.php          # crée + seed
     php database/migrate.php --fresh  # efface puis recrée

   Fonctionne avec SQLite (dev/test) ET MySQL (production).
   ========================================================================== */

require __DIR__ . '/../core/App.php';
App::boot();

$pdo   = Database::connexion();
$sqlite = Database::pilote() === 'sqlite';
$fresh = in_array('--fresh', $argv, true);

$tables = [
    'abonnement_paiements', 'abonnements', 'resets', 'litiges', 'post_likes',
    'favoris', 'notifications', 'messages', 'conversations', 'reservations',
    'posts', 'galerie', 'avis', 'disponibilites', 'diplomes', 'tarifs',
    'coach_langues', 'coach_specialites', 'coachs', 'users',
];
if ($fresh) {
    if (!$sqlite) $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    foreach ($tables as $t) $pdo->exec("DROP TABLE IF EXISTS $t");
    if (!$sqlite) $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
}

require __DIR__ . '/ddl.php';
coachlink_creer_tables($pdo, $sqlite);

echo "Schéma créé ($" . "pilote=" . Database::pilote() . ").\n";

/* ------------------------- Compte admin ---------------------------------- */
$admin = (new User())->parEmail('admin@coachlink.ci');
if (!$admin) {
    (new User())->creer([
        'role' => 'admin', 'prenom' => 'Admin', 'nom' => 'CoachLink',
        'email' => 'admin@coachlink.ci', 'telephone' => '0700000000', 'motDePasse' => 'admin123',
    ]);
    // Corrige le rôle (creer force "client" via colonne par défaut only if provided).
    $pdo->prepare("UPDATE users SET role='admin' WHERE email='admin@coachlink.ci'")->execute();
    echo "Compte admin créé (admin@coachlink.ci / admin123).\n";
}

/* ------------------- Import des 12 coachs de démo ------------------------ */
$jsonPath = __DIR__ . '/../../data/coachs.json';
if (is_file($jsonPath)) {
    $dejà = (int) $pdo->query("SELECT COUNT(*) n FROM coachs")->fetch()['n'];
    if ($dejà === 0) {
        $coachs = json_decode(file_get_contents($jsonPath), true) ?: [];
        $pdo->beginTransaction();
        foreach ($coachs as $c) {
            $pdo->prepare("INSERT INTO coachs (id, proprietaire, prenom, nom, titre, categorie, commune, ville, bio,
                note, nb_avis, nb_seances, anciennete_mois, taux_reponse, experience_annees, clients_accompagnes, interventions, couleur, email, telephone, photo, couverture)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")->execute([
                $c['id'], null, $c['prenom'], $c['nom'], $c['titre'], $c['categorie'], $c['commune'], $c['ville'] ?? 'Abidjan',
                $c['bio'] ?? '', $c['note'] ?? 0, $c['nbAvis'] ?? 0, $c['nbSeances'] ?? 0, $c['ancienneteMois'] ?? 0,
                $c['tauxReponse'] ?? 100, $c['experienceAnnees'] ?? 0, $c['clientsAccompagnes'] ?? 0,
                json_encode($c['interventions'] ?? []), $c['couleur'] ?? '#1b4dcc', $c['email'] ?? '', $c['telephone'] ?? '',
                $c['photo'] ?? null, $c['couverture'] ?? null,
            ]);
            foreach ($c['specialites'] ?? [] as $s) $pdo->prepare("INSERT INTO coach_specialites VALUES (?,?)")->execute([$c['id'], $s]);
            foreach ($c['langues'] ?? [] as $l) $pdo->prepare("INSERT INTO coach_langues VALUES (?,?)")->execute([$c['id'], $l]);
            foreach ($c['tarifs'] ?? [] as $t) $pdo->prepare("INSERT INTO tarifs (id, coach_id, nom, type, prix, duree, description) VALUES (?,?,?,?,?,?,?)")
                ->execute([$c['id'] . '_' . $t['id'], $c['id'], $t['nom'], $t['type'], $t['prix'], $t['duree'], $t['description'] ?? '']);
            foreach ($c['diplomes'] ?? [] as $d) $pdo->prepare("INSERT INTO diplomes (coach_id, titre, ecole, annee, statut) VALUES (?,?,?,?,?)")
                ->execute([$c['id'], $d['titre'], $d['ecole'], $d['annee'], $d['statut']]);
            foreach (($c['disponibilites'] ?? []) as $jour => $heures)
                foreach ($heures as $h) $pdo->prepare("INSERT INTO disponibilites (coach_id, jour, heure) VALUES (?,?,?)")->execute([$c['id'], $jour, $h]);
            foreach ($c['avis'] ?? [] as $a) $pdo->prepare("INSERT INTO avis (coach_id, auteur, note, texte, reponse, date) VALUES (?,?,?,?,?,?)")
                ->execute([$c['id'], $a['auteur'], $a['note'], $a['texte'], $a['reponse'] ?? null, $a['date']]);
            foreach ($c['galerie'] ?? [] as $g) $pdo->prepare("INSERT INTO galerie (coach_id, image, legende, date) VALUES (?,?,?,?)")
                ->execute([$c['id'], $g['image'], $g['legende'] ?? '', $g['date']]);
            foreach ($c['posts'] ?? [] as $p) $pdo->prepare("INSERT INTO posts (coach_id, texte, image, video, likes, date) VALUES (?,?,?,?,?,?)")
                ->execute([$c['id'], $p['texte'] ?? '', $p['image'] ?? null, $p['video'] ?? null, $p['likes'] ?? 0, $p['date']]);
        }
        $pdo->commit();
        echo "Import de " . count($coachs) . " coachs de démonstration terminé.\n";
    } else {
        echo "Coachs déjà présents ($dejà) — import ignoré.\n";
    }
}

/* ------------------- Litiges de démonstration ---------------------------- */
$nbLitiges = (int) $pdo->query("SELECT COUNT(*) n FROM litiges")->fetch()['n'];
if ($nbLitiges === 0) {
    $demo = [
        [null, 'Awa S.', 'Koffi Aka', 'Séance non honorée', 'ouvert', '2026-07-10'],
        [null, 'Marc B.', 'Didier Kouamé', 'Remboursement demandé', 'en_cours', '2026-07-12'],
    ];
    foreach ($demo as $l) {
        $pdo->prepare("INSERT INTO litiges (client_id, client_nom, coach_nom, motif, statut, date) VALUES (?,?,?,?,?,?)")->execute($l);
    }
    echo "Litiges de démonstration ajoutés.\n";
}
echo "Migration terminée ✔\n";

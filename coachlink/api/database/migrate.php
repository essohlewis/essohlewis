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

// Clause de clé primaire auto-incrémentée selon le pilote.
$PK = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';
$suffixe = $sqlite ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';

$tables = [
    'resets', 'litiges', 'post_likes', 'favoris', 'notifications', 'messages',
    'conversations', 'reservations', 'posts', 'galerie', 'avis', 'disponibilites',
    'diplomes', 'tarifs', 'coach_langues', 'coach_specialites', 'coachs', 'users',
];
if ($fresh) {
    if (!$sqlite) $pdo->exec('SET FOREIGN_KEY_CHECKS = 0');
    foreach ($tables as $t) $pdo->exec("DROP TABLE IF EXISTS $t");
    if (!$sqlite) $pdo->exec('SET FOREIGN_KEY_CHECKS = 1');
}

$pdo->exec("CREATE TABLE IF NOT EXISTS users (
  id $PK, role VARCHAR(10) NOT NULL DEFAULT 'client', prenom VARCHAR(80), nom VARCHAR(80),
  email VARCHAR(160) UNIQUE, telephone VARCHAR(30) DEFAULT '', mot_de_passe VARCHAR(255),
  source VARCHAR(30) DEFAULT 'email', cree_le VARCHAR(40))$suffixe");

$pdo->exec("CREATE TABLE IF NOT EXISTS coachs (
  id VARCHAR(40) PRIMARY KEY, proprietaire INT NULL, prenom VARCHAR(80), nom VARCHAR(80),
  titre VARCHAR(160) DEFAULT '', categorie VARCHAR(40) DEFAULT 'Bien-être', commune VARCHAR(60),
  ville VARCHAR(60) DEFAULT 'Abidjan', bio TEXT, note DECIMAL(2,1) DEFAULT 0, nb_avis INT DEFAULT 0,
  nb_seances INT DEFAULT 0, anciennete_mois INT DEFAULT 0, taux_reponse INT DEFAULT 100,
  couleur VARCHAR(20) DEFAULT '#1b4dcc', email VARCHAR(160), telephone VARCHAR(30),
  photo LONGTEXT, couverture LONGTEXT)$suffixe");

$pdo->exec("CREATE TABLE IF NOT EXISTS coach_specialites (coach_id VARCHAR(40), specialite VARCHAR(40))$suffixe");
$pdo->exec("CREATE TABLE IF NOT EXISTS coach_langues (coach_id VARCHAR(40), langue VARCHAR(40))$suffixe");
$pdo->exec("CREATE TABLE IF NOT EXISTS tarifs (id VARCHAR(50) PRIMARY KEY, coach_id VARCHAR(40), nom VARCHAR(120), type VARCHAR(20), prix INT, duree INT, description TEXT)$suffixe");
$pdo->exec("CREATE TABLE IF NOT EXISTS diplomes (id $PK, coach_id VARCHAR(40), titre VARCHAR(160), ecole VARCHAR(160), annee INT, statut VARCHAR(15) DEFAULT 'en_attente', fichier LONGTEXT)$suffixe");
$pdo->exec("CREATE TABLE IF NOT EXISTS disponibilites (id $PK, coach_id VARCHAR(40), jour VARCHAR(3), heure VARCHAR(5))$suffixe");
$pdo->exec("CREATE TABLE IF NOT EXISTS avis (id $PK, coach_id VARCHAR(40), auteur VARCHAR(120), note INT, texte TEXT, reponse TEXT, date VARCHAR(40))$suffixe");
$pdo->exec("CREATE TABLE IF NOT EXISTS galerie (id $PK, coach_id VARCHAR(40), image LONGTEXT, legende VARCHAR(160), date VARCHAR(40))$suffixe");
$pdo->exec("CREATE TABLE IF NOT EXISTS posts (id $PK, coach_id VARCHAR(40), texte TEXT, image LONGTEXT, video VARCHAR(255), likes INT DEFAULT 0, date VARCHAR(40))$suffixe");
$pdo->exec("CREATE TABLE IF NOT EXISTS reservations (id $PK, coach_id VARCHAR(40), client_id INT, client_nom VARCHAR(120),
  tarif_id VARCHAR(50), tarif_nom VARCHAR(120), prix INT, duree INT, jour VARCHAR(3), heure VARCHAR(5), message TEXT,
  statut VARCHAR(15) DEFAULT 'en_attente', avis_laisse INT DEFAULT 0, paye INT DEFAULT 0, paiement_op VARCHAR(40),
  paiement_numero VARCHAR(30), paiement_montant INT, paiement_remise INT, paiement_promo VARCHAR(40),
  paiement_ref VARCHAR(40), paiement_date VARCHAR(40), cree_le VARCHAR(40))$suffixe");
$pdo->exec("CREATE TABLE IF NOT EXISTS conversations (id $PK, user_a INT, user_b INT, nom_a VARCHAR(120), nom_b VARCHAR(120), maj_le VARCHAR(40))$suffixe");
$pdo->exec("CREATE TABLE IF NOT EXISTS messages (id $PK, conversation_id INT, de INT, texte TEXT, lu INT DEFAULT 0, date VARCHAR(40))$suffixe");
$pdo->exec("CREATE TABLE IF NOT EXISTS notifications (id $PK, pour INT, type VARCHAR(30), texte TEXT, lien VARCHAR(120), lu INT DEFAULT 0, date VARCHAR(40))$suffixe");
$pdo->exec("CREATE TABLE IF NOT EXISTS favoris (user_id INT, coach_id VARCHAR(40))$suffixe");
$pdo->exec("CREATE TABLE IF NOT EXISTS post_likes (post_id INT, user_id INT, PRIMARY KEY (post_id, user_id))$suffixe");
$pdo->exec("CREATE TABLE IF NOT EXISTS litiges (id $PK, client_id INT, client_nom VARCHAR(120), coach_nom VARCHAR(120), motif TEXT, statut VARCHAR(15) DEFAULT 'ouvert', date VARCHAR(40))$suffixe");
$pdo->exec("CREATE TABLE IF NOT EXISTS resets (email VARCHAR(160), token VARCHAR(64), expire_le VARCHAR(40))$suffixe");

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
                note, nb_avis, nb_seances, anciennete_mois, taux_reponse, couleur, email, telephone, photo, couverture)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)")->execute([
                $c['id'], null, $c['prenom'], $c['nom'], $c['titre'], $c['categorie'], $c['commune'], $c['ville'] ?? 'Abidjan',
                $c['bio'] ?? '', $c['note'] ?? 0, $c['nbAvis'] ?? 0, $c['nbSeances'] ?? 0, $c['ancienneteMois'] ?? 0,
                $c['tauxReponse'] ?? 100, $c['couleur'] ?? '#1b4dcc', $c['email'] ?? '', $c['telephone'] ?? '',
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
        [null, 'Marc B.', 'Ismaël Traoré', 'Remboursement demandé', 'en_cours', '2026-07-12'],
    ];
    foreach ($demo as $l) {
        $pdo->prepare("INSERT INTO litiges (client_id, client_nom, coach_nom, motif, statut, date) VALUES (?,?,?,?,?,?)")->execute($l);
    }
    echo "Litiges de démonstration ajoutés.\n";
}
echo "Migration terminée ✔\n";

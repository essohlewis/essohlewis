<?php
/* ==========================================================================
   database/ddl.php — Création des tables (idempotent, CREATE TABLE IF NOT
   EXISTS). Compatible SQLite (dev/test) et MySQL (production). Utilisé par
   migrate.php et par le bootstrap des tests.
   ========================================================================== */

/** Crée toutes les tables du schéma si elles n'existent pas. */
function coachlink_creer_tables(PDO $pdo, bool $sqlite): void
{
    $PK = $sqlite ? 'INTEGER PRIMARY KEY AUTOINCREMENT' : 'INT AUTO_INCREMENT PRIMARY KEY';
    $suffixe = $sqlite ? '' : ' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4';

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
      lieu_type VARCHAR(20), lieu_nom VARCHAR(160), adresse VARCHAR(200), ville VARCHAR(80), commune VARCHAR(80),
      quartier VARCHAR(120), lat VARCHAR(24), lng VARCHAR(24),
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

    // Abonnements mensuels (programme d'accompagnement client ↔ coach).
    $pdo->exec("CREATE TABLE IF NOT EXISTS abonnements (id $PK, client_id INT, client_nom VARCHAR(120),
      coach_id VARCHAR(40), coach_nom VARCHAR(120), objectif VARCHAR(160), seances_semaine INT DEFAULT 1,
      lieu_type VARCHAR(20) DEFAULT 'salle_coach', lieu_nom VARCHAR(160), adresse VARCHAR(200),
      ville VARCHAR(80), commune VARCHAR(80), quartier VARCHAR(80), lat VARCHAR(30), lng VARCHAR(30),
      prix_seance INT DEFAULT 0, prix_mensuel INT DEFAULT 0, inclut_salle INT DEFAULT 0,
      fixe_par VARCHAR(10) DEFAULT 'client', programme TEXT, statut VARCHAR(15) DEFAULT 'demande',
      date_debut VARCHAR(40), date_fin VARCHAR(40), cree_le VARCHAR(40))$suffixe");
    $pdo->exec("CREATE TABLE IF NOT EXISTS abonnement_paiements (id $PK, abonnement_id INT, mois VARCHAR(7),
      montant INT, operateur VARCHAR(40), reference VARCHAR(40), date VARCHAR(40))$suffixe");
}

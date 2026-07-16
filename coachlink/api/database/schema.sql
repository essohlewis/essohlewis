-- ==========================================================================
-- schema.sql — Schéma MySQL de CoachLink CI (backend PHP pur / PDO).
-- Encodage utf8mb4. Créez la base puis importez ce fichier :
--   mysql -u root -p -e "CREATE DATABASE coachlink CHARACTER SET utf8mb4;"
--   mysql -u root -p coachlink < schema.sql
-- ==========================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- --- Utilisateurs ---------------------------------------------------------
CREATE TABLE users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  role          ENUM('client','coach','admin') NOT NULL DEFAULT 'client',
  prenom        VARCHAR(80)  NOT NULL,
  nom           VARCHAR(80)  NOT NULL,
  email         VARCHAR(160) NOT NULL UNIQUE,
  telephone     VARCHAR(30)  DEFAULT '',
  mot_de_passe  VARCHAR(255) NOT NULL,
  source        VARCHAR(30)  DEFAULT 'email',
  cree_le       VARCHAR(40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --- Coachs ---------------------------------------------------------------
CREATE TABLE coachs (
  id              VARCHAR(40) PRIMARY KEY,
  proprietaire    INT NULL,
  prenom          VARCHAR(80) NOT NULL,
  nom             VARCHAR(80) NOT NULL,
  titre           VARCHAR(160) DEFAULT '',
  categorie       VARCHAR(40)  DEFAULT 'Bien-être',
  commune         VARCHAR(60)  DEFAULT 'Cocody',
  ville           VARCHAR(60)  DEFAULT 'Abidjan',
  bio             TEXT,
  note            DECIMAL(2,1) DEFAULT 0,
  nb_avis         INT DEFAULT 0,
  nb_seances      INT DEFAULT 0,
  anciennete_mois INT DEFAULT 0,
  taux_reponse    INT DEFAULT 100,
  couleur         VARCHAR(20) DEFAULT '#1b4dcc',
  email           VARCHAR(160),
  telephone       VARCHAR(30),
  photo           LONGTEXT,
  couverture      LONGTEXT,
  CONSTRAINT fk_coach_user FOREIGN KEY (proprietaire) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE coach_specialites (
  coach_id   VARCHAR(40) NOT NULL,
  specialite VARCHAR(40) NOT NULL,
  PRIMARY KEY (coach_id, specialite),
  FOREIGN KEY (coach_id) REFERENCES coachs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE coach_langues (
  coach_id VARCHAR(40) NOT NULL,
  langue   VARCHAR(40) NOT NULL,
  PRIMARY KEY (coach_id, langue),
  FOREIGN KEY (coach_id) REFERENCES coachs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE tarifs (
  id          VARCHAR(50) PRIMARY KEY,
  coach_id    VARCHAR(40) NOT NULL,
  nom         VARCHAR(120),
  type        VARCHAR(20),
  prix        INT,
  duree       INT,
  description TEXT,
  FOREIGN KEY (coach_id) REFERENCES coachs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE diplomes (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  coach_id  VARCHAR(40) NOT NULL,
  titre     VARCHAR(160),
  ecole     VARCHAR(160),
  annee     INT,
  statut    ENUM('en_attente','verifie','refuse') DEFAULT 'en_attente',
  fichier   LONGTEXT,
  FOREIGN KEY (coach_id) REFERENCES coachs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE disponibilites (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  coach_id VARCHAR(40) NOT NULL,
  jour     VARCHAR(3) NOT NULL,
  heure    VARCHAR(5) NOT NULL,
  FOREIGN KEY (coach_id) REFERENCES coachs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE avis (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  coach_id VARCHAR(40) NOT NULL,
  auteur   VARCHAR(120),
  note     INT,
  texte    TEXT,
  reponse  TEXT NULL,
  date     VARCHAR(40),
  FOREIGN KEY (coach_id) REFERENCES coachs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE galerie (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  coach_id VARCHAR(40) NOT NULL,
  image    LONGTEXT,
  legende  VARCHAR(160),
  date     VARCHAR(40),
  FOREIGN KEY (coach_id) REFERENCES coachs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE posts (
  id       INT AUTO_INCREMENT PRIMARY KEY,
  coach_id VARCHAR(40) NOT NULL,
  texte    TEXT,
  image    LONGTEXT NULL,
  video    VARCHAR(255) NULL,
  likes    INT DEFAULT 0,
  date     VARCHAR(40),
  FOREIGN KEY (coach_id) REFERENCES coachs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --- Réservations & paiement ---------------------------------------------
CREATE TABLE reservations (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  coach_id         VARCHAR(40) NOT NULL,
  client_id        INT NOT NULL,
  client_nom       VARCHAR(120),
  tarif_id         VARCHAR(50),
  tarif_nom        VARCHAR(120),
  prix             INT,
  duree            INT,
  jour             VARCHAR(3),
  heure            VARCHAR(5),
  message          TEXT,
  statut           ENUM('en_attente','confirmee','refusee','terminee','annulee') DEFAULT 'en_attente',
  avis_laisse      TINYINT DEFAULT 0,
  paye             TINYINT DEFAULT 0,
  paiement_op      VARCHAR(40),
  paiement_numero  VARCHAR(30),
  paiement_montant INT,
  paiement_remise  INT,
  paiement_promo   VARCHAR(40),
  paiement_ref     VARCHAR(40),
  paiement_date    VARCHAR(40),
  cree_le          VARCHAR(40),
  FOREIGN KEY (coach_id)  REFERENCES coachs(id) ON DELETE CASCADE,
  FOREIGN KEY (client_id) REFERENCES users(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --- Messagerie -----------------------------------------------------------
CREATE TABLE conversations (
  id     INT AUTO_INCREMENT PRIMARY KEY,
  user_a INT NOT NULL,
  user_b INT NOT NULL,
  nom_a  VARCHAR(120),
  nom_b  VARCHAR(120),
  maj_le VARCHAR(40),
  UNIQUE KEY uniq_paire (user_a, user_b)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE messages (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  de              INT NOT NULL,
  texte           TEXT,
  lu              TINYINT DEFAULT 0,
  date            VARCHAR(40),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --- Notifications --------------------------------------------------------
CREATE TABLE notifications (
  id    INT AUTO_INCREMENT PRIMARY KEY,
  pour  INT NOT NULL,
  type  VARCHAR(30),
  texte TEXT,
  lien  VARCHAR(120),
  lu    TINYINT DEFAULT 0,
  date  VARCHAR(40),
  FOREIGN KEY (pour) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --- Favoris --------------------------------------------------------------
CREATE TABLE favoris (
  user_id  INT NOT NULL,
  coach_id VARCHAR(40) NOT NULL,
  PRIMARY KEY (user_id, coach_id),
  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE,
  FOREIGN KEY (coach_id) REFERENCES coachs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --- « J'aime » sur les publications --------------------------------------
CREATE TABLE post_likes (
  post_id INT NOT NULL,
  user_id INT NOT NULL,
  PRIMARY KEY (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --- Litiges (modération admin) -------------------------------------------
CREATE TABLE litiges (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  client_id  INT NULL,
  client_nom VARCHAR(120),
  coach_nom  VARCHAR(120),
  motif      TEXT,
  statut     ENUM('ouvert','en_cours','resolu') DEFAULT 'ouvert',
  date       VARCHAR(40)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- --- Jetons de réinitialisation de mot de passe ---------------------------
CREATE TABLE resets (
  email     VARCHAR(160) NOT NULL,
  token     VARCHAR(64)  NOT NULL,
  expire_le VARCHAR(40),
  INDEX idx_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- Compte administrateur par défaut (mot de passe : admin123).
-- Le hash ci-dessous est un exemple ; régénérez-le avec password_hash() si besoin.
INSERT INTO users (role, prenom, nom, email, telephone, mot_de_passe, source, cree_le)
VALUES ('admin', 'Admin', 'CoachLink', 'admin@coachlink.ci', '0700000000',
        '$2y$10$e0MYzXyjpJS7Pd0RVvHwHexsamplesamplesampleHASHplaceholder', 'email', '2026-01-01T00:00:00+00:00');

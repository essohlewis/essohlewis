-- =====================================================================
--  MarchéFraîch CI — Schéma de base de données MySQL (MVP Phase 1)
-- ---------------------------------------------------------------------
--  Marché de quartier digitalisé : vendeuses, produits, clients,
--  commandes, coursiers, paiements Mobile Money (CinetPay).
--  Devise : Franc CFA (XOF). Interface : français.
--
--  Le schéma est normalisé et volontairement extensible : certains
--  champs (points de fidélité, notes, zone de livraison) préparent la
--  vision long terme sans que les fonctionnalités soient développées
--  au MVP.
--
--  Encodage utf8mb4 pour supporter les accents et emojis.
-- =====================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE DATABASE IF NOT EXISTS marchefraich
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE marchefraich;

-- Suppression dans l'ordre des dépendances (utile pour ré-installation)
DROP TABLE IF EXISTS paiements;
DROP TABLE IF EXISTS lignes_commande;
DROP TABLE IF EXISTS commandes;
DROP TABLE IF EXISTS produits;
DROP TABLE IF EXISTS coursiers;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS vendeuses;
DROP TABLE IF EXISTS marches;
DROP TABLE IF EXISTS admins;

-- ---------------------------------------------------------------------
--  MARCHÉS : un marché de quartier pilote (extensible en multi-marchés)
-- ---------------------------------------------------------------------
CREATE TABLE marches (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nom             VARCHAR(120)  NOT NULL,
    quartier        VARCHAR(120)  NOT NULL,
    ville           VARCHAR(120)  NOT NULL DEFAULT 'Abidjan',
    adresse         VARCHAR(255)  DEFAULT NULL,
    actif           TINYINT(1)    NOT NULL DEFAULT 1,
    cree_le         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_marches_actif (actif)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  ADMINISTRATEURS de la plateforme
-- ---------------------------------------------------------------------
CREATE TABLE admins (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nom             VARCHAR(120)  NOT NULL,
    email           VARCHAR(160)  NOT NULL,
    mot_de_passe    VARCHAR(255)  NOT NULL,          -- hash password_hash()
    cree_le         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  VENDEUSES : commerçantes rattachées à un marché
--  statut : en_attente | validee | suspendue
-- ---------------------------------------------------------------------
CREATE TABLE vendeuses (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    marche_id       INT UNSIGNED  NOT NULL,
    nom             VARCHAR(120)  NOT NULL,
    telephone       VARCHAR(20)   NOT NULL,          -- sert d'identifiant de connexion
    mot_de_passe    VARCHAR(255)  NOT NULL,
    photo_etal      VARCHAR(255)  DEFAULT NULL,
    description     VARCHAR(255)  DEFAULT NULL,
    statut          ENUM('en_attente','validee','suspendue') NOT NULL DEFAULT 'en_attente',
    cree_le         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_vendeuses_tel (telephone),
    KEY idx_vendeuses_marche (marche_id),
    KEY idx_vendeuses_statut (statut),
    CONSTRAINT fk_vendeuses_marche FOREIGN KEY (marche_id)
        REFERENCES marches (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  PRODUITS : catalogue basique par vendeuse
--  prix et quantités mis à jour manuellement par la vendeuse
-- ---------------------------------------------------------------------
CREATE TABLE produits (
    id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
    vendeuse_id           INT UNSIGNED  NOT NULL,
    nom                   VARCHAR(120)  NOT NULL,
    description           VARCHAR(255)  DEFAULT NULL,
    categorie             VARCHAR(80)   DEFAULT NULL,     -- ex : Légumes, Fruits, Tubercules...
    prix_xof              INT UNSIGNED  NOT NULL,         -- prix unitaire en Francs CFA (entier)
    unite                 VARCHAR(30)   NOT NULL DEFAULT 'unité', -- tas, kg, sac, botte...
    quantite_disponible   INT UNSIGNED  NOT NULL DEFAULT 0,
    photo                 VARCHAR(255)  DEFAULT NULL,
    actif                 TINYINT(1)    NOT NULL DEFAULT 1,
    cree_le               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_produits_vendeuse (vendeuse_id),
    KEY idx_produits_actif (actif),
    CONSTRAINT fk_produits_vendeuse FOREIGN KEY (vendeuse_id)
        REFERENCES vendeuses (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  CLIENTS : résidents du quartier
--  points_fidelite : prévu pour la vision (non utilisé au MVP)
-- ---------------------------------------------------------------------
CREATE TABLE clients (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nom             VARCHAR(120)  NOT NULL,
    telephone       VARCHAR(20)   NOT NULL,          -- identifiant de connexion
    mot_de_passe    VARCHAR(255)  NOT NULL,
    quartier        VARCHAR(120)  DEFAULT NULL,
    adresse         VARCHAR(255)  DEFAULT NULL,
    points_fidelite INT UNSIGNED  NOT NULL DEFAULT 0,
    cree_le         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_clients_tel (telephone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  COURSIERS : livreurs indépendants
--  disponible : le coursier se déclare dispo pour prendre des courses
--  note_moyenne / zone : prévus pour la vision (non exploités au MVP)
-- ---------------------------------------------------------------------
CREATE TABLE coursiers (
    id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
    nom             VARCHAR(120)  NOT NULL,
    telephone       VARCHAR(20)   NOT NULL,
    mot_de_passe    VARCHAR(255)  NOT NULL,
    zone            VARCHAR(120)  DEFAULT NULL,
    disponible      TINYINT(1)    NOT NULL DEFAULT 1,
    note_moyenne    DECIMAL(3,2)  NOT NULL DEFAULT 0.00,
    cree_le         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_coursiers_tel (telephone),
    KEY idx_coursiers_dispo (disponible)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  COMMANDES : une commande = un client + une vendeuse (MVP mono-vendeuse)
--  statut          : recue | en_preparation | en_livraison | livree | annulee
--  mode_paiement   : mobile_money | especes
--  statut_paiement : en_attente | paye | echoue
--  Les montants sont figés à la commande (commission, livraison, total).
-- ---------------------------------------------------------------------
CREATE TABLE commandes (
    id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
    reference             VARCHAR(20)   NOT NULL,          -- ex : MF-20260702-000012
    client_id             INT UNSIGNED  NOT NULL,
    vendeuse_id           INT UNSIGNED  NOT NULL,
    marche_id             INT UNSIGNED  NOT NULL,
    coursier_id           INT UNSIGNED  DEFAULT NULL,      -- NULL tant que non attribué
    statut                ENUM('recue','en_preparation','en_livraison','livree','annulee')
                                        NOT NULL DEFAULT 'recue',
    montant_produits_xof  INT UNSIGNED  NOT NULL DEFAULT 0,
    frais_livraison_xof   INT UNSIGNED  NOT NULL DEFAULT 0,
    commission_xof        INT UNSIGNED  NOT NULL DEFAULT 0, -- part plateforme
    montant_total_xof     INT UNSIGNED  NOT NULL DEFAULT 0, -- ce que paie le client
    mode_paiement         ENUM('mobile_money','especes') NOT NULL DEFAULT 'especes',
    statut_paiement       ENUM('en_attente','paye','echoue') NOT NULL DEFAULT 'en_attente',
    adresse_livraison     VARCHAR(255)  NOT NULL,
    quartier_livraison    VARCHAR(120)  DEFAULT NULL,
    notes                 VARCHAR(255)  DEFAULT NULL,
    cree_le               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uniq_commandes_ref (reference),
    KEY idx_commandes_client (client_id),
    KEY idx_commandes_vendeuse (vendeuse_id),
    KEY idx_commandes_coursier (coursier_id),
    KEY idx_commandes_statut (statut),
    CONSTRAINT fk_commandes_client FOREIGN KEY (client_id)
        REFERENCES clients (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_commandes_vendeuse FOREIGN KEY (vendeuse_id)
        REFERENCES vendeuses (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_commandes_marche FOREIGN KEY (marche_id)
        REFERENCES marches (id) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_commandes_coursier FOREIGN KEY (coursier_id)
        REFERENCES coursiers (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  LIGNES DE COMMANDE : détail des produits d'une commande
--  On copie le nom et le prix au moment de la commande (historisation),
--  pour que la commande reste juste même si le produit change ensuite.
-- ---------------------------------------------------------------------
CREATE TABLE lignes_commande (
    id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
    commande_id           INT UNSIGNED  NOT NULL,
    produit_id            INT UNSIGNED  DEFAULT NULL,      -- NULL si produit supprimé
    nom_produit           VARCHAR(120)  NOT NULL,
    prix_unitaire_xof     INT UNSIGNED  NOT NULL,
    quantite              INT UNSIGNED  NOT NULL,
    sous_total_xof        INT UNSIGNED  NOT NULL,
    PRIMARY KEY (id),
    KEY idx_lignes_commande (commande_id),
    KEY idx_lignes_produit (produit_id),
    CONSTRAINT fk_lignes_commande FOREIGN KEY (commande_id)
        REFERENCES commandes (id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_lignes_produit FOREIGN KEY (produit_id)
        REFERENCES produits (id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
--  PAIEMENTS : trace de chaque tentative de paiement (Mobile Money / espèces)
--  methode : orange_money | mtn_money | wave | especes
--  statut  : en_attente | reussi | echoue
--  reference_operateur : identifiant renvoyé par l'agrégateur (CinetPay)
-- ---------------------------------------------------------------------
CREATE TABLE paiements (
    id                    INT UNSIGNED NOT NULL AUTO_INCREMENT,
    commande_id           INT UNSIGNED  NOT NULL,
    montant_xof           INT UNSIGNED  NOT NULL,
    methode               ENUM('orange_money','mtn_money','wave','especes') NOT NULL,
    statut                ENUM('en_attente','reussi','echoue') NOT NULL DEFAULT 'en_attente',
    reference_operateur   VARCHAR(120)  DEFAULT NULL,      -- transaction id CinetPay
    cree_le               TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    modifie_le            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
                                        ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_paiements_commande (commande_id),
    KEY idx_paiements_statut (statut),
    CONSTRAINT fk_paiements_commande FOREIGN KEY (commande_id)
        REFERENCES commandes (id) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

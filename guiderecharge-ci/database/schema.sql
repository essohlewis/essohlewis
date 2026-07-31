-- =====================================================================
-- GuideRecharge CI — Schéma de base de données
-- MySQL 8+ · InnoDB · utf8mb4
-- =====================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS `guiderecharge_ci`
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `guiderecharge_ci`;

-- ---------------------------------------------------------------------
-- Opérateurs
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS `operateurs`;
CREATE TABLE `operateurs` (
    `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nom`         VARCHAR(50)  NOT NULL,
    `slug`        VARCHAR(50)  NOT NULL,
    `couleur_hex` VARCHAR(7)   NOT NULL DEFAULT '#000000',
    `logo`        VARCHAR(255) NOT NULL DEFAULT '',
    `prefixes`    VARCHAR(100) NOT NULL DEFAULT '',   -- CSV ou JSON des préfixes
    `ussd_base`   VARCHAR(20)  NOT NULL DEFAULT '',    -- code racine (ex : *144#)
    `actif`       TINYINT(1)   NOT NULL DEFAULT 1,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_operateurs_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Catégories de forfait
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS `categories_forfait`;
CREATE TABLE `categories_forfait` (
    `id`    INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nom`   VARCHAR(60)  NOT NULL,
    `slug`  VARCHAR(60)  NOT NULL,
    `icone` VARCHAR(16)  NOT NULL DEFAULT '',
    `ordre` INT          NOT NULL DEFAULT 0,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_categories_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Forfaits
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS `forfaits`;
CREATE TABLE `forfaits` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `operateur_id`  INT UNSIGNED NOT NULL,
    `categorie_id`  INT UNSIGNED NOT NULL,
    `nom`           VARCHAR(120) NOT NULL,
    `description`   TEXT         NULL,
    `prix`          INT          NOT NULL DEFAULT 0,       -- FCFA
    `volume_data`   VARCHAR(50)  NOT NULL DEFAULT '',      -- ex : "5 Go"
    `minutes_appel` VARCHAR(50)  NOT NULL DEFAULT '',
    `sms`           VARCHAR(50)  NOT NULL DEFAULT '',
    `validite`      VARCHAR(50)  NOT NULL DEFAULT '',      -- ex : "30 jours"
    `code_ussd`     VARCHAR(120) NOT NULL DEFAULT '',      -- code d'activation
    `populaire`     TINYINT(1)   NOT NULL DEFAULT 0,
    `actif`         TINYINT(1)   NOT NULL DEFAULT 1,
    `vues`          INT UNSIGNED NOT NULL DEFAULT 0,
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_forfaits_operateur` (`operateur_id`),
    KEY `idx_forfaits_categorie` (`categorie_id`),
    KEY `idx_forfaits_actif_pop` (`actif`, `populaire`),
    CONSTRAINT `fk_forfaits_operateur` FOREIGN KEY (`operateur_id`) REFERENCES `operateurs` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_forfaits_categorie` FOREIGN KEY (`categorie_id`) REFERENCES `categories_forfait` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Codes USSD génériques
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS `codes_ussd`;
CREATE TABLE `codes_ussd` (
    `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `operateur_id` INT UNSIGNED NOT NULL,
    `action`       VARCHAR(40)  NOT NULL,   -- achat_credit, transfert_credit, solde, activation, mobile_money
    `libelle`      VARCHAR(120) NOT NULL,
    `pattern`      VARCHAR(120) NOT NULL,   -- ex : *155*1*1*{numero}*{montant}#
    `description`  TEXT         NULL,
    PRIMARY KEY (`id`),
    KEY `idx_codes_operateur` (`operateur_id`),
    KEY `idx_codes_action` (`action`),
    CONSTRAINT `fk_codes_operateur` FOREIGN KEY (`operateur_id`) REFERENCES `operateurs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Guides
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS `guides`;
CREATE TABLE `guides` (
    `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `titre`        VARCHAR(160) NOT NULL,
    `slug`         VARCHAR(160) NOT NULL,
    `contenu`      MEDIUMTEXT   NOT NULL,   -- HTML riche (nettoyé à l'enregistrement)
    `categorie`    VARCHAR(60)  NOT NULL DEFAULT '',
    `operateur_id` INT UNSIGNED NULL,
    `image`        VARCHAR(255) NOT NULL DEFAULT '',
    `vues`         INT UNSIGNED NOT NULL DEFAULT 0,
    `actif`        TINYINT(1)   NOT NULL DEFAULT 1,
    `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_guides_slug` (`slug`),
    KEY `idx_guides_operateur` (`operateur_id`),
    KEY `idx_guides_categorie` (`categorie`),
    CONSTRAINT `fk_guides_operateur` FOREIGN KEY (`operateur_id`) REFERENCES `operateurs` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Administrateurs
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS `admin_users`;
CREATE TABLE `admin_users` (
    `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `nom`           VARCHAR(80)  NOT NULL,
    `email`         VARCHAR(160) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,   -- Argon2id
    `role`          VARCHAR(30)  NOT NULL DEFAULT 'admin',
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_admin_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Journal des actions admin
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS `admin_logs`;
CREATE TABLE `admin_logs` (
    `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `admin_id`   INT UNSIGNED NULL,
    `action`     VARCHAR(120) NOT NULL,
    `details`    VARCHAR(255) NOT NULL DEFAULT '',
    `ip`         VARCHAR(45)  NOT NULL DEFAULT '',
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_logs_admin` (`admin_id`),
    CONSTRAINT `fk_logs_admin` FOREIGN KEY (`admin_id`) REFERENCES `admin_users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Compteur des générations de codes USSD (statistiques)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS `ussd_generations`;
CREATE TABLE `ussd_generations` (
    `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `operateur_slug` VARCHAR(50)  NOT NULL DEFAULT '',
    `action`         VARCHAR(40)  NOT NULL DEFAULT '',
    `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    KEY `idx_gen_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

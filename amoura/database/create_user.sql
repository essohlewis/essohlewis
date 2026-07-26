-- =============================================================================
--  AMOURA — Crée la base et l'utilisateur applicatif (amoura / secret).
--  À importer dans phpMyAdmin en tant que root, PUIS importer schema.sql et
--  seed.sql (dans cet ordre) ; ou utilisez plutôt install.sql (tout-en-un).
-- =============================================================================
CREATE DATABASE IF NOT EXISTS `amoura` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'amoura'@'localhost' IDENTIFIED BY 'secret';
GRANT ALL PRIVILEGES ON `amoura`.* TO 'amoura'@'localhost';
FLUSH PRIVILEGES;

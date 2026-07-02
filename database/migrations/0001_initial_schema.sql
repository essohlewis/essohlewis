-- Migration initiale : voir database/schema.sql pour le schéma complet et
-- commenté. Cette migration applique le schéma de base.
--
-- Application : php bin/console.php migrate
-- (exécute schema.sql puis seeds.sql).
--
-- Les migrations suivantes seront numérotées 0002_*, 0003_*, etc., et devront
-- être idempotentes ou versionnées via une table `migrations`.
SOURCE ../schema.sql;

-- =====================================================================
--  MarchéFraîch CI — Données de démonstration (marché pilote)
-- ---------------------------------------------------------------------
--  À exécuter APRÈS schema.sql.
--  Tous les mots de passe de démonstration sont : "motdepasse"
--  (hash bcrypt généré avec password_hash('motdepasse', PASSWORD_DEFAULT)).
-- =====================================================================

USE marchefraich;

SET @hash := '$2y$12$AS7DCs4gfcF3485OyVzhqer7SucooFEAmwvRLPBR5.48v3tQ6ql3S';

-- Marché pilote
INSERT INTO marches (id, nom, quartier, ville, adresse, actif) VALUES
    (1, 'Marché de Cocody Angré', 'Angré', 'Abidjan', '7ème tranche, près de la pharmacie', 1);

-- Administrateur (email: admin@marchefraich.ci / mot de passe: motdepasse)
INSERT INTO admins (nom, email, mot_de_passe) VALUES
    ('Administrateur', 'admin@marchefraich.ci', @hash);

-- Vendeuses (téléphone / mot de passe: motdepasse)
INSERT INTO vendeuses (id, marche_id, nom, telephone, mot_de_passe, description, statut) VALUES
    (1, 1, 'Tante Adjoua', '0700000001', @hash, 'Légumes frais et condiments du jour', 'validee'),
    (2, 1, 'Mariam Vivriers', '0700000002', @hash, 'Tubercules, banane plantain, igname', 'validee'),
    (3, 1, 'Chez Aya', '0700000003', @hash, 'Fruits de saison', 'en_attente');

-- Produits de Tante Adjoua
INSERT INTO produits (vendeuse_id, nom, categorie, prix_xof, unite, quantite_disponible, description) VALUES
    (1, 'Tomate fraîche', 'Légumes', 500, 'tas', 30, 'Tas de tomates mûres'),
    (1, 'Piment frais', 'Condiments', 300, 'tas', 25, 'Petit tas de piment'),
    (1, 'Aubergine', 'Légumes', 400, 'tas', 20, 'Aubergines locales'),
    (1, 'Gombo frais', 'Légumes', 500, 'tas', 15, NULL);

-- Produits de Mariam Vivriers
INSERT INTO produits (vendeuse_id, nom, categorie, prix_xof, unite, quantite_disponible, description) VALUES
    (2, 'Igname', 'Tubercules', 2000, 'kg', 40, 'Igname de Bondoukou'),
    (2, 'Banane plantain', 'Tubercules', 1500, 'régime', 12, 'Régime de plantain mûr'),
    (2, 'Manioc', 'Tubercules', 1000, 'kg', 25, NULL),
    (2, 'Attiéké', 'Céréales', 500, 'sachet', 50, 'Attiéké frais du jour');

-- Client de démonstration (téléphone: 0500000001 / mot de passe: motdepasse)
INSERT INTO clients (nom, telephone, mot_de_passe, quartier, adresse) VALUES
    ('Koffi Client', '0500000001', @hash, 'Angré', 'Rue des Jardins, villa 12');

-- Coursier de démonstration (téléphone: 0100000001 / mot de passe: motdepasse)
INSERT INTO coursiers (nom, telephone, mot_de_passe, zone, disponible) VALUES
    ('Yao Livreur', '0100000001', @hash, 'Angré', 1);

-- ─────────────────────────────────────────────────────────────────────────
-- Transouscris — Données de départ (comptes système, opérateurs, forfaits).
-- À exécuter après schema.sql.
-- ─────────────────────────────────────────────────────────────────────────

SET NAMES utf8mb4;

-- ── Comptes système du grand livre ───────────────────────────────────────
-- allow_negative = 1 : ces comptes de compensation représentent des flux
-- externes (passerelles, opérateurs) et n'ont pas de contrainte de solde ≥ 0.
INSERT INTO ledger_accounts (owner_type, owner_id, code, type, currency, balance, allow_negative, status) VALUES
    ('system', NULL, 'GATEWAY_CLEARING',     'asset',     'XOF', 0, 1, 'active'),
    ('system', NULL, 'OPERATOR_SETTLEMENT',  'liability', 'XOF', 0, 1, 'active'),
    ('system', NULL, 'PLATFORM_REVENUE',     'revenue',   'XOF', 0, 1, 'active'),
    ('system', NULL, 'CASHBACK_RESERVE',     'expense',   'XOF', 0, 1, 'active');

-- ── Opérateurs ────────────────────────────────────────────────────────────
INSERT INTO operators (code, name, color, active) VALUES
    ('orange', 'Orange CI',    '#FF7900', 1),
    ('moov',   'Moov Africa',  '#004B9F', 1),
    ('mtn',    'MTN CI',       '#FFCC00', 1);

-- ── Forfaits (catalogue réaliste, basé sur les offres publiques 2024/2026) ─
-- Sources : sites officiels Orange CI (*144#), MTN CI (*105*2#), Moov CI (*303*2#).
-- Les tarifs sont donnés à titre indicatif et doivent être validés auprès des
-- opérateurs avant mise en production.
-- category    : internet | voice | sms | mixte
-- subcategory : illimite | social | jour | semaine | quinzaine | mois | nuit | special | mixte
INSERT INTO plans
    (operator_code, code, name, category, subcategory, price, validity, data_volume, minutes, sms_count, bonus, ussd_code, description, active)
VALUES
    -- ═══ ORANGE CI (*144#) ═══
    ('orange','OR-ILLIM-J','Internet Illimité Jour','internet','illimite',1500,'24 h','Illimité',NULL,NULL,NULL,'*144#','Navigation illimitée 24 h — usage raisonnable',1),
    ('orange','OR-WA-J','Pass WhatsApp Jour','internet','social',150,'24 h','WhatsApp',NULL,NULL,NULL,'*144#','WhatsApp illimité pendant 24 h',1),
    ('orange','OR-SOC-S','Pass Réseaux Sociaux','internet','social',500,'7 jours','WhatsApp + Facebook',NULL,NULL,NULL,'*144#','WhatsApp + Facebook 7 jours',1),
    ('orange','OR-YT-N','Pass YouTube Nuit','internet','social',300,'1 nuit','YouTube 2 Go',NULL,NULL,NULL,'*144#','YouTube de 00 h à 06 h',1),
    ('orange','OR-J-40','Pass 40 Mo','internet','jour',100,'24 h','40 Mo',NULL,NULL,NULL,'*144#','Petit pass journalier',1),
    ('orange','OR-J-150','Pass 150 Mo','internet','jour',200,'24 h','150 Mo',NULL,NULL,NULL,'*144#','Pass journalier',1),
    ('orange','OR-J-1G','Pass 1 Go','internet','jour',1000,'72 h','1 Go',NULL,NULL,NULL,'*144#','Pass 3 jours',1),
    ('orange','OR-S-15','Pass 1,5 Go','internet','semaine',1500,'7 jours','1,5 Go',NULL,NULL,NULL,'*144#','Pass hebdomadaire',1),
    ('orange','OR-S-3G','Pass 3 Go','internet','semaine',2500,'7 jours','3 Go',NULL,NULL,NULL,'*144#','Pass hebdomadaire',1),
    ('orange','OR-S-6G','Pass 6 Go','internet','semaine',3500,'7 jours','6 Go',NULL,NULL,NULL,'*144#','Pass hebdomadaire+',1),
    ('orange','OR-M-10G','Pass 10 Go','internet','mois',5000,'30 jours','10 Go',NULL,NULL,NULL,'*144#','Pass mensuel',1),
    ('orange','OR-M-20G','Pass 20 Go','internet','mois',10000,'30 jours','20 Go',NULL,NULL,NULL,'*144#','Pass mensuel',1),
    ('orange','OR-M-40G','Pass 40 Go','internet','mois',15000,'30 jours','40 Go',NULL,NULL,NULL,'*144#','Pass mensuel+',1),
    ('orange','OR-NUIT-3G','Pass Nuit 3 Go','internet','nuit',500,'1 nuit','3 Go',NULL,NULL,NULL,'*144#','Valable de 00 h à 06 h',1),
    ('orange','OR-V-30','Appels 30 min','voice',NULL,1000,'7 jours',NULL,30,NULL,NULL,'*144#','30 minutes tous réseaux',1),
    ('orange','OR-V-60','Appels 60 min','voice',NULL,1500,'15 jours',NULL,60,NULL,NULL,'*144#','60 minutes tous réseaux',1),
    ('orange','OR-V-ILL','Appels illimités Orange','voice',NULL,2000,'30 jours',NULL,NULL,NULL,'Illimité Orange↔Orange','*144#','Appels illimités vers Orange',1),
    ('orange','OR-SMS-50','50 SMS','sms',NULL,300,'7 jours',NULL,NULL,50,NULL,'*144#','50 SMS tous réseaux',1),
    ('orange','OR-SMS-200','200 SMS','sms',NULL,1000,'30 jours',NULL,NULL,200,NULL,'*144#','200 SMS tous réseaux',1),
    ('orange','OR-MIX-2000','Pass Mixte','mixte','mixte',2000,'30 jours','1 Go',60,30,'Bonus soir','*144#','1 Go + 60 min + 30 SMS',1),

    -- ═══ MTN CI (*105*2#) ═══
    ('mtn','MTN-ILLIM-J','Y''ello Illimité Jour','internet','illimite',2000,'24 h','Illimité',NULL,NULL,NULL,'*105*2#','Navigation illimitée 24 h — usage raisonnable',1),
    ('mtn','MTN-J-250','Pass 250 Mo','internet','jour',200,'3 jours','250 Mo',NULL,NULL,NULL,'*105*2#','Bon Plan 3 jours',1),
    ('mtn','MTN-J-750','Pass 750 Mo','internet','jour',500,'3 jours','750 Mo',NULL,NULL,NULL,'*105*2#','Bon Plan 3 jours',1),
    ('mtn','MTN-S-15','Pass 1,5 Go','internet','semaine',1000,'7 jours','1,5 Go',NULL,NULL,'+100% le mardi','*105*2#','Bon Plan hebdo',1),
    ('mtn','MTN-S-2G','Pass 2 Go','internet','semaine',1500,'7 jours','2 Go',NULL,NULL,NULL,'*105*2#','Pass hebdomadaire',1),
    ('mtn','MTN-S-4G','Pass 4 Go','internet','semaine',2500,'7 jours','4 Go',NULL,NULL,NULL,'*105*2#','Pass hebdomadaire+',1),
    ('mtn','MTN-M-12G','Pass 12 Go','internet','mois',5000,'30 jours','12 Go',NULL,NULL,NULL,'*105*2#','Pass mensuel',1),
    ('mtn','MTN-M-25G','Pass 25 Go','internet','mois',10000,'30 jours','25 Go',NULL,NULL,NULL,'*105*2#','Pass mensuel',1),
    ('mtn','MTN-M-40G','Pass 40 Go','internet','mois',15000,'30 jours','40 Go',NULL,NULL,NULL,'*105*2#','Pass mensuel+',1),
    ('mtn','MTN-NUIT-3G','Pass Nuit 3 Go','internet','nuit',500,'1 nuit','3 Go',NULL,NULL,NULL,'*105*2#','Valable de 00 h à 06 h',1),
    ('mtn','MTN-V-40','Appels 40 min','voice',NULL,1000,'7 jours',NULL,40,NULL,NULL,'*105#','40 minutes tous réseaux',1),
    ('mtn','MTN-V-90','Appels 90 min','voice',NULL,1500,'15 jours',NULL,90,NULL,NULL,'*105#','90 minutes tous réseaux',1),
    ('mtn','MTN-V-ILL','Appels illimités MTN','voice',NULL,2500,'30 jours',NULL,NULL,NULL,'Illimité MTN↔MTN','*105#','Appels illimités vers MTN',1),
    ('mtn','MTN-SMS-60','60 SMS','sms',NULL,300,'7 jours',NULL,NULL,60,NULL,'*105*3#','60 SMS tous réseaux',1),
    ('mtn','MTN-SMS-250','250 SMS','sms',NULL,1000,'30 jours',NULL,NULL,250,NULL,'*105*3#','250 SMS tous réseaux',1),
    ('mtn','MTN-FP-MINI','Free Pack Mini','mixte','mixte',500,'2 jours','500 Mo',20,20,'+100% le mardi','*105*1#','500 Mo + 20 min + 20 SMS',1),
    ('mtn','MTN-FP-MAXI','Free Pack Maxi','mixte','mixte',2000,'14 jours','3 Go',60,60,'+100% le mardi','*105*1#','3 Go + 60 min + 60 SMS',1),

    -- ═══ MOOV AFRICA CI (*303*2#) ═══
    ('moov','MO-ILLIM-J','Internet Illimité Jour','internet','illimite',1500,'24 h','Illimité',NULL,NULL,NULL,'*303*3*1#','Navigation illimitée 24 h — usage raisonnable',1),
    ('moov','MO-FOLIE-100','Moov Folie 100 Mo','internet','special',50,'24 h','100 Mo',NULL,NULL,'Doublé lundi & mardi','*303*2#','Offre Moov Folie',1),
    ('moov','MO-FOLIE-400','Moov Folie 400 Mo','internet','special',200,'48 h','400 Mo',NULL,NULL,'Doublé lundi & mardi','*303*2#','Offre Moov Folie',1),
    ('moov','MO-FOLIE-2G','Moov Folie 2 Go','internet','special',500,'7 jours','2 Go',NULL,NULL,'Doublé lundi & mardi','*303*2#','Offre Moov Folie',1),
    ('moov','MO-J-1G','Pass 1 Go','internet','jour',1000,'72 h','1 Go',NULL,NULL,NULL,'*303*3*1#','Pass 3 jours',1),
    ('moov','MO-S-3G','Pass 3 Go','internet','semaine',1500,'7 jours','3 Go',NULL,NULL,NULL,'*303*3*1#','Pass semaine',1),
    ('moov','MO-S-5G','Pass 5 Go','internet','semaine',2500,'7 jours','5 Go',NULL,NULL,NULL,'*303*3*1#','Pass semaine+',1),
    ('moov','MO-M-10G','Pass 10 Go','internet','mois',5000,'30 jours','10 Go',NULL,NULL,NULL,'*303*3*1#','Pass mensuel',1),
    ('moov','MO-M-20G','Pass 20 Go','internet','mois',10000,'30 jours','20 Go',NULL,NULL,NULL,'*303*3*1#','Pass mensuel',1),
    ('moov','MO-M-35G','Pass 35 Go','internet','mois',15000,'30 jours','35 Go',NULL,NULL,NULL,'*303*3*1#','Pass mensuel+',1),
    ('moov','MO-NUIT-2G','Moov Folie Nuit','internet','nuit',200,'1 nuit','2 Go',NULL,NULL,NULL,'*303*2*1*7#','Valable de 00 h à 05 h',1),
    ('moov','MO-V-30','Izy heures 30 min','voice',NULL,1000,'7 jours',NULL,30,NULL,NULL,'*303*1#','30 minutes tous réseaux',1),
    ('moov','MO-V-60','Izy heures 60 min','voice',NULL,1500,'15 jours',NULL,60,NULL,NULL,'*303*1#','60 minutes tous réseaux',1),
    ('moov','MO-SMS-100','100 SMS','sms',NULL,500,'7 jours',NULL,NULL,100,NULL,'*366#','100 SMS tous réseaux',1),
    ('moov','MO-MIX-2000','Pass Izy Mixte','mixte','mixte',2000,'15 jours','2 Go',30,50,'Doublé lundi & mardi','*303*1#','2 Go + 30 min + 50 SMS',1);

-- ── Administrateur de démonstration ───────────────────────────────────────
-- Numéro fictif ; en production l'admin se connecte aussi par OTP.
INSERT INTO users (phone, name, role, status, phone_verified)
VALUES ('2250700000001', 'Administrateur', 'admin', 'active', 1);

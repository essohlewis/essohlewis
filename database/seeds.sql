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

-- ── Forfaits (catalogue de démonstration) ────────────────────────────────
-- category    : internet | voice | sms  (correspond au type d'opération)
-- subcategory : illimite | jour | semaine | quinzaine | mois | nuit | special
INSERT INTO plans (operator_code, code, name, category, subcategory, price, validity, data_volume, description, active) VALUES
    -- ORANGE — Internet
    ('orange','OR-ILLIM-J', 'Internet Illimité Jour', 'internet','illimite',  1500, '24 h',   'Illimité', 'Navigation illimitée pendant 24 h (usage raisonnable)', 1),
    ('orange','OR-J-100',   'Pass 100 Mo',            'internet','jour',        200, '24 h',   '100 Mo',   'Petit pass journalier',                       1),
    ('orange','OR-J-350',   'Pass 350 Mo',            'internet','jour',        500, '48 h',   '350 Mo',   'Pass 2 jours',                                1),
    ('orange','OR-J-1G',    'Pass 1 Go',              'internet','jour',       1000, '72 h',   '1 Go',     'Pass 3 jours',                                1),
    ('orange','OR-S-1500',  'Pass 1,5 Go',            'internet','semaine',    1500, '7 jours','1,5 Go',   'Pass hebdomadaire',                           1),
    ('orange','OR-S-3G',    'Pass 3 Go',              'internet','semaine',    2500, '7 jours','3 Go',     'Pass hebdomadaire',                           1),
    ('orange','OR-S-5G',    'Pass 5 Go',              'internet','semaine',    3500, '7 jours','5 Go',     'Pass hebdomadaire+',                          1),
    ('orange','OR-Q-6G',    'Pass 6 Go',              'internet','quinzaine',  4000, '15 jours','6 Go',    'Pass 15 jours',                               1),
    ('orange','OR-M-10G',   'Pass 10 Go',             'internet','mois',       5000, '30 jours','10 Go',   'Pass mensuel',                                1),
    ('orange','OR-M-20G',   'Pass 20 Go',             'internet','mois',      10000, '30 jours','20 Go',   'Pass mensuel',                                1),
    ('orange','OR-M-30G',   'Pass 30 Go',             'internet','mois',      15000, '30 jours','30 Go',   'Pass mensuel+',                               1),
    ('orange','OR-NUIT-2G', 'Pass Nuit 2 Go',         'internet','nuit',        500, '1 nuit', '2 Go',     'Valable de 00 h à 06 h',                      1),
    -- ORANGE — Appels & SMS
    ('orange','OR-V-30',    'Appels 30 min',          'voice',   NULL,         1000, '7 jours', NULL,      '30 minutes tous réseaux',                     1),
    ('orange','OR-V-60',    'Appels 60 min',          'voice',   NULL,         1500, '15 jours',NULL,      '60 minutes tous réseaux',                     1),
    ('orange','OR-V-ILL',   'Appels illimités Orange','voice',   NULL,         2000, '30 jours',NULL,      'Illimité Orange vers Orange',                 1),
    ('orange','OR-SMS-50',  '50 SMS',                 'sms',     NULL,          300, '7 jours', NULL,      '50 SMS tous réseaux',                         1),
    ('orange','OR-SMS-200', '200 SMS',                'sms',     NULL,         1000, '30 jours',NULL,      '200 SMS tous réseaux',                        1),

    -- MTN — Internet
    ('mtn','MTN-ILLIM-J','Y''ello Illimité Jour',     'internet','illimite',   2000, '24 h',   'Illimité', 'Navigation illimitée 24 h (usage raisonnable)', 1),
    ('mtn','MTN-J-150',  'Pass 150 Mo',               'internet','jour',        200, '24 h',   '150 Mo',   'Pass journalier',                             1),
    ('mtn','MTN-J-500',  'Pass 500 Mo',               'internet','jour',        500, '48 h',   '500 Mo',   'Pass 2 jours',                                1),
    ('mtn','MTN-J-1200', 'Pass 1,2 Go',               'internet','jour',       1000, '72 h',   '1,2 Go',   'Pass 3 jours',                                1),
    ('mtn','MTN-S-2G',   'Pass 2 Go',                 'internet','semaine',    1500, '7 jours','2 Go',     'Pass hebdomadaire',                           1),
    ('mtn','MTN-S-4G',   'Pass 4 Go',                 'internet','semaine',    2500, '7 jours','4 Go',     'Pass hebdomadaire',                           1),
    ('mtn','MTN-S-6G',   'Pass 6 Go',                 'internet','semaine',    3500, '7 jours','6 Go',     'Pass hebdomadaire+',                          1),
    ('mtn','MTN-Q-8G',   'Pass 8 Go',                 'internet','quinzaine',  4500, '15 jours','8 Go',    'Pass 15 jours',                               1),
    ('mtn','MTN-M-12G',  'Pass 12 Go',                'internet','mois',       5000, '30 jours','12 Go',   'Pass mensuel',                                1),
    ('mtn','MTN-M-25G',  'Pass 25 Go',                'internet','mois',      10000, '30 jours','25 Go',   'Pass mensuel',                                1),
    ('mtn','MTN-M-40G',  'Pass 40 Go',                'internet','mois',      15000, '30 jours','40 Go',   'Pass mensuel+',                               1),
    ('mtn','MTN-NUIT-3G','Pass Nuit 3 Go',            'internet','nuit',        500, '1 nuit', '3 Go',     'Valable de 00 h à 06 h',                      1),
    -- MTN — Appels & SMS
    ('mtn','MTN-V-40',   'Appels 40 min',             'voice',   NULL,         1000, '7 jours', NULL,      '40 minutes tous réseaux',                     1),
    ('mtn','MTN-V-90',   'Appels 90 min',             'voice',   NULL,         1500, '15 jours',NULL,      '90 minutes tous réseaux',                     1),
    ('mtn','MTN-V-ILL',  'Appels illimités MTN',      'voice',   NULL,         2500, '30 jours',NULL,      'Illimité MTN vers MTN',                       1),
    ('mtn','MTN-SMS-60', '60 SMS',                    'sms',     NULL,          300, '7 jours', NULL,      '60 SMS tous réseaux',                         1),
    ('mtn','MTN-SMS-250','250 SMS',                   'sms',     NULL,         1000, '30 jours',NULL,      '250 SMS tous réseaux',                        1),

    -- MOOV — Internet
    ('moov','MO-ILLIM-J','Internet Illimité Jour',    'internet','illimite',   1500, '24 h',   'Illimité', 'Navigation illimitée 24 h (usage raisonnable)', 1),
    ('moov','MO-J-120',  'Pass 120 Mo',               'internet','jour',        200, '24 h',   '120 Mo',   'Pass journalier',                             1),
    ('moov','MO-J-400',  'Pass 400 Mo',               'internet','jour',        500, '48 h',   '400 Mo',   'Pass 2 jours',                                1),
    ('moov','MO-J-1G',   'Pass 1 Go',                 'internet','jour',       1000, '72 h',   '1 Go',     'Pass 3 jours',                                1),
    ('moov','MO-S-2G',   'Pass 2 Go',                 'internet','semaine',    1500, '7 jours','2 Go',     'Pass semaine',                                1),
    ('moov','MO-S-35',   'Pass 3,5 Go',               'internet','semaine',    2500, '7 jours','3,5 Go',   'Pass semaine',                                1),
    ('moov','MO-S-5G',   'Pass 5 Go',                 'internet','semaine',    3500, '7 jours','5 Go',     'Pass semaine+',                               1),
    ('moov','MO-Q-7G',   'Pass 7 Go',                 'internet','quinzaine',  4000, '15 jours','7 Go',    'Pass 15 jours',                               1),
    ('moov','MO-M-10G',  'Pass 10 Go',                'internet','mois',       5000, '30 jours','10 Go',   'Pass mensuel',                                1),
    ('moov','MO-M-20G',  'Pass 20 Go',                'internet','mois',      10000, '30 jours','20 Go',   'Pass mensuel',                                1),
    ('moov','MO-M-35G',  'Pass 35 Go',                'internet','mois',      15000, '30 jours','35 Go',   'Pass mensuel+',                               1),
    ('moov','MO-FOLIE-5','Moov Folie 5 Go',           'internet','special',    2000, '7 jours','5 Go',     'Offre Moov Folie',                            1),
    ('moov','MO-FOLIE-15','Moov Folie 15 Go',         'internet','special',    5000, '30 jours','15 Go',   'Offre Moov Folie',                            1),
    ('moov','MO-NUIT-25','Pass Nuit 2,5 Go',          'internet','nuit',        500, '1 nuit', '2,5 Go',   'Valable de 00 h à 06 h',                      1),
    -- MOOV — Appels & SMS
    ('moov','MO-V-30',   'Appels 30 min',             'voice',   NULL,         1000, '7 jours', NULL,      '30 minutes tous réseaux',                     1),
    ('moov','MO-V-60',   'Appels 60 min',             'voice',   NULL,         1500, '15 jours',NULL,      '60 minutes tous réseaux',                     1),
    ('moov','MO-SMS-100','100 SMS',                   'sms',     NULL,          500, '7 jours', NULL,      '100 SMS tous réseaux',                        1);

-- ── Administrateur de démonstration ───────────────────────────────────────
-- Numéro fictif ; en production l'admin se connecte aussi par OTP.
INSERT INTO users (phone, name, role, status, phone_verified)
VALUES ('2250700000001', 'Administrateur', 'admin', 'active', 1);

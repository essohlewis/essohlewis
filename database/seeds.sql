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

-- ── Forfaits (exemples) ───────────────────────────────────────────────────
INSERT INTO plans (operator_code, code, name, category, price, validity, description, active) VALUES
    ('orange', 'OR-NET-1G',  'Internet 1 Go',   'internet', 1000, '7 jours',  'Pass internet 1 Go',        1),
    ('orange', 'OR-NET-5G',  'Internet 5 Go',   'internet', 3000, '30 jours', 'Pass internet 5 Go',        1),
    ('orange', 'OR-VOIX-60', 'Appels 60 min',   'voice',    1500, '15 jours', 'Forfait 60 minutes',        1),
    ('mtn',    'MTN-NET-2G', 'Internet 2 Go',   'internet', 1500, '15 jours', 'Pass internet 2 Go',        1),
    ('mtn',    'MTN-MIX-XL', 'Pass Mixte XL',   'mixte',    5000, '30 jours', 'Internet + appels + SMS',   1),
    ('moov',   'MO-NET-1G',  'Internet 1 Go',   'internet',  900, '7 jours',  'Pass internet 1 Go',        1),
    ('moov',   'MO-SMS-100', '100 SMS',         'sms',       500, '7 jours',  'Forfait 100 SMS',           1);

-- ── Administrateur de démonstration ───────────────────────────────────────
-- Numéro fictif ; en production l'admin se connecte aussi par OTP.
INSERT INTO users (phone, name, role, status, phone_verified)
VALUES ('2250700000001', 'Administrateur', 'admin', 'active', 1);

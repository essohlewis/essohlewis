-- =============================================================================
--  Migration 010 — Multi-devises (Phase 5)
--  Table de conversion (base = XOF) : affichage indicatif des prix selon la
--  région. Le paiement reste effectué dans la devise de l'offre.
-- =============================================================================

CREATE TABLE IF NOT EXISTS currency_rates (
    code          CHAR(3)        NOT NULL,               -- ISO 4217
    name          VARCHAR(50)    NOT NULL,
    symbol        VARCHAR(8)     NOT NULL,
    rate_to_base  DECIMAL(18,8)  NOT NULL,               -- unités de `code` pour 1 XOF
    decimals      TINYINT UNSIGNED NOT NULL DEFAULT 2,
    symbol_before TINYINT(1)     NOT NULL DEFAULT 0,      -- position du symbole
    is_active     TINYINT(1)     NOT NULL DEFAULT 1,
    position      INT            NOT NULL DEFAULT 0,
    updated_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Taux indicatifs (à réviser via une source de change en production).
INSERT INTO currency_rates (code, name, symbol, rate_to_base, decimals, symbol_before, position) VALUES
  ('XOF', 'Franc CFA (UEMOA)', 'FCFA', 1.00000000, 0, 0, 0),
  ('XAF', 'Franc CFA (CEMAC)', 'FCFA', 1.00000000, 0, 0, 1),
  ('EUR', 'Euro',             '€',    0.00152450, 2, 1, 2),
  ('USD', 'Dollar américain', '$',    0.00165000, 2, 1, 3),
  ('GHS', 'Cedi ghanéen',     'GH₵',  0.02500000, 2, 1, 4),
  ('NGN', 'Naira nigérian',   '₦',    2.63000000, 0, 1, 5)
ON DUPLICATE KEY UPDATE rate_to_base = VALUES(rate_to_base);

-- =============================================================================
--  Migration 014 — Passerelle M-Pesa (Safaricom Daraja, Phase 5)
--  Ajoute les réglages M-Pesa (éditables depuis l'admin/CMS) et la devise KES
--  nécessaire à la conversion XOF → KES du STK Push « Lipa Na M-Pesa Online ».
-- =============================================================================

INSERT IGNORE INTO settings (`key`, value, type, `group`) VALUES
  ('mpesa_consumer_key',    '',        'secret', 'payments'),
  ('mpesa_consumer_secret', '',        'secret', 'payments'),
  ('mpesa_shortcode',       '',        'string', 'payments'),
  ('mpesa_passkey',         '',        'secret', 'payments'),
  ('mpesa_env',             'sandbox', 'string', 'payments');

-- Devise kényane (base XOF) — taux indicatif, à réviser en production.
INSERT IGNORE INTO currency_rates (code, name, symbol, rate_to_base, decimals, symbol_before, position) VALUES
  ('KES', 'Shilling kényan', 'KSh', 0.22000000, 2, 1, 6);

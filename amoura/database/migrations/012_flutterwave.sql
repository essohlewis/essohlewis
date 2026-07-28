-- =============================================================================
--  Migration 012 — Passerelle Flutterwave (Phase 5)
--  Ajoute les réglages de la passerelle (éditables depuis l'admin/CMS).
-- =============================================================================

INSERT IGNORE INTO settings (`key`, value, type, `group`) VALUES
  ('flutterwave_secret_key',  '', 'secret', 'payments'),
  ('flutterwave_secret_hash', '', 'secret', 'payments');

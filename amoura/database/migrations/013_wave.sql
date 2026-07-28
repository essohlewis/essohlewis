-- =============================================================================
--  Migration 013 — Passerelle Wave (Phase 5)
--  Ajoute les réglages Wave (éditables depuis l'admin/CMS).
-- =============================================================================

INSERT IGNORE INTO settings (`key`, value, type, `group`) VALUES
  ('wave_api_key',        '', 'secret', 'payments'),
  ('wave_webhook_secret', '', 'secret', 'payments');

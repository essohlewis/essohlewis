-- =============================================================================
--  Migration 016 — Réglages WhatsApp (OTP d'inscription)
--  Ajoute les réglages de la passerelle WhatsApp Cloud API (éditables depuis
--  l'admin). Le .env reste prioritaire ; ces valeurs servent de repli CMS.
-- =============================================================================

INSERT IGNORE INTO settings (`key`, value, type, `group`) VALUES
  ('whatsapp_driver',     'log', 'string', 'messaging'),
  ('whatsapp_token',      '',    'secret', 'messaging'),
  ('whatsapp_phone_id',   '',    'string', 'messaging'),
  ('whatsapp_template',   '',    'string', 'messaging'),
  ('whatsapp_lang',       'fr',  'string', 'messaging'),
  ('whatsapp_default_cc', '',    'string', 'messaging');

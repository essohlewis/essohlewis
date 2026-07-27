-- =============================================================================
--  Migration 008 — Mode incognito (navigation privée VIP) — Phase 3
--  Un membre VIP peut consulter des profils sans laisser de trace de visite.
-- =============================================================================

ALTER TABLE privacy_settings
    ADD COLUMN incognito TINYINT(1) NOT NULL DEFAULT 0 AFTER discoverable;

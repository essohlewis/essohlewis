-- =============================================================================
--  Migration 003 — Sprint +4 (sécurité des comptes)
--  2FA (TOTP) + révocation de sessions (« déconnecter partout »).
-- =============================================================================

ALTER TABLE users
    ADD COLUMN totp_secret VARCHAR(64) NULL AFTER is_verified,
    ADD COLUMN totp_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER totp_secret,
    ADD COLUMN sessions_valid_after TIMESTAMP NULL AFTER totp_enabled;

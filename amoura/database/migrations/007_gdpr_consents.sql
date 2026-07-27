-- =============================================================================
--  Migration 007 — Consentements RGPD granulaires (Phase 4, Sprint +9)
--  Journal append-only : chaque octroi/retrait insère une ligne horodatée +
--  version du document + IP → preuve de consentement (registre RGPD).
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_consents (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED NOT NULL,
    purpose     VARCHAR(40)    NOT NULL,     -- privacy_policy | terms | marketing | analytics
    granted     TINYINT(1)     NOT NULL DEFAULT 1,
    version     VARCHAR(20)    NULL,         -- version du document consenti
    ip          VARBINARY(16)  NULL,         -- IP au moment du consentement
    created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_consent_user (user_id, purpose, id),
    CONSTRAINT fk_consent_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

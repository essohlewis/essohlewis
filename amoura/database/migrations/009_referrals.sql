-- =============================================================================
--  Migration 009 — Programme de parrainage (Phase 5)
--  Chaque membre dispose d'un code ; un filleul vérifié récompense le parrain
--  (et le filleul) en crédits.
-- =============================================================================

ALTER TABLE users
    ADD COLUMN referral_code VARCHAR(16) NULL AFTER display_name,
    ADD UNIQUE KEY uq_referral_code (referral_code);

CREATE TABLE IF NOT EXISTS referrals (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    referrer_id    BIGINT UNSIGNED NOT NULL,
    referred_id    BIGINT UNSIGNED NOT NULL,
    code           VARCHAR(16)    NOT NULL,
    status         ENUM('pending','rewarded') NOT NULL DEFAULT 'pending',
    reward_credits INT UNSIGNED   NOT NULL DEFAULT 0,
    created_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    rewarded_at    TIMESTAMP      NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_referred (referred_id),          -- un filleul n'est parrainé qu'une fois
    KEY idx_referrer (referrer_id, status),
    CONSTRAINT fk_ref_referrer FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_ref_referred FOREIGN KEY (referred_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

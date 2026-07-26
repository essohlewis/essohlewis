-- =============================================================================
--  Migration 005 — Sprint +6 (durcissement plateforme)
--  Réponses citées & messages éphémères · filtres enrichis · coupons ·
--  appareils de connexion · file de vérification (liveness v1).
-- =============================================================================

-- Chat : réponses citées + messages éphémères.
ALTER TABLE messages
    ADD COLUMN reply_to_id BIGINT UNSIGNED NULL AFTER conversation_id,
    ADD COLUMN expires_at TIMESTAMP NULL AFTER read_at,
    ADD KEY idx_msg_expires (expires_at),
    ADD CONSTRAINT fk_msg_reply FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL;

-- Découverte : critères de style de vie / valeurs.
ALTER TABLE profiles
    ADD COLUMN smoking ENUM('no','sometimes','yes') NULL AFTER education,
    ADD COLUMN drinking ENUM('no','sometimes','yes') NULL AFTER smoking,
    ADD COLUMN children ENUM('no','someday','have','have_more') NULL AFTER drinking,
    ADD COLUMN religion VARCHAR(40) NULL AFTER children,
    ADD COLUMN relationship_goal ENUM('casual','serious','friends','unsure') NULL AFTER religion;

-- Coupons de réduction (abonnements & achats).
CREATE TABLE IF NOT EXISTS coupons (
    id           INT UNSIGNED   NOT NULL AUTO_INCREMENT,
    code         VARCHAR(40)    NOT NULL,
    percent_off  TINYINT UNSIGNED NULL,               -- réduction en %
    amount_off   INT UNSIGNED   NULL,                 -- ou réduction fixe (centimes)
    max_redemptions INT UNSIGNED NULL,
    redeemed     INT UNSIGNED   NOT NULL DEFAULT 0,
    expires_at   TIMESTAMP      NULL,
    is_active    TINYINT(1)     NOT NULL DEFAULT 1,
    created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_coupon_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Appareils de connaissance (détection de connexion suspecte).
CREATE TABLE IF NOT EXISTS login_devices (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id      BIGINT UNSIGNED NOT NULL,
    fingerprint  CHAR(64)       NOT NULL,              -- hash(user_agent + ip réseau)
    user_agent   VARCHAR(255)   NULL,
    last_ip      VARBINARY(16)  NULL,
    first_seen_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_device (user_id, fingerprint),
    CONSTRAINT fk_device_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- File de demandes de vérification (badge « vérifié » via selfie).
CREATE TABLE IF NOT EXISTS verification_requests (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id      BIGINT UNSIGNED NOT NULL,
    selfie_path  VARCHAR(255)   NOT NULL,
    auto_score   TINYINT        NULL,                  -- score heuristique (liveness v1)
    status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    handled_by   BIGINT UNSIGNED NULL,
    handled_at   TIMESTAMP      NULL,
    created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_verif_status (status, created_at),
    CONSTRAINT fk_verif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

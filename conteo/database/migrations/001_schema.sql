-- ═══════════════════════════════════════════════════════════════
--  CONTEO — Schéma MySQL 8 complet
--  Contes africains illustrés & narrés (2–7 ans)
--  Charset : utf8mb4 / Collation : utf8mb4_unicode_ci
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ─────────────────────────────────────────────
-- Utilisateurs (parents)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    phone           VARCHAR(20) UNIQUE NOT NULL,     -- format E.164 : +225XXXXXXXXXX
    email           VARCHAR(190) UNIQUE NULL,
    password_hash   VARCHAR(255) NOT NULL,
    display_name    VARCHAR(100) NOT NULL,
    phone_verified  TINYINT(1) NOT NULL DEFAULT 0,
    otp_code        CHAR(6) NULL,                    -- OTP courant (haché ou clair court TTL)
    otp_expires_at  DATETIME NULL,
    is_admin        TINYINT(1) NOT NULL DEFAULT 0,
    status          ENUM('active','suspended','deleted') NOT NULL DEFAULT 'active',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- Profils enfants
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS child_profiles (
    id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id             BIGINT UNSIGNED NOT NULL,
    first_name          VARCHAR(50) NOT NULL,
    birth_year          SMALLINT UNSIGNED NOT NULL,
    birth_month         TINYINT UNSIGNED NOT NULL,
    avatar_key          VARCHAR(50) NOT NULL DEFAULT 'avatar_01',
    reading_level       ENUM('N1','N2','N3') NOT NULL,   -- calculé, surchargeable
    level_locked        TINYINT(1) NOT NULL DEFAULT 0,   -- 1 = forcé par le parent
    narration_lang      VARCHAR(10) NOT NULL DEFAULT 'fr',
    daily_limit_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 30,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- Packs de contes (unité d'achat) — déclaré avant `tales` (FK)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packs (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    slug            VARCHAR(100) UNIQUE NOT NULL,
    title           VARCHAR(150) NOT NULL,
    description     TEXT NULL,
    cover_url       VARCHAR(255) NOT NULL,
    price_fcfa      INT UNSIGNED NOT NULL,
    tale_count      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    total_size_mb   SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    is_active       TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- Contes (métadonnées)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tales (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    slug            VARCHAR(120) UNIQUE NOT NULL,
    title           VARCHAR(200) NOT NULL,
    origin          VARCHAR(100) NOT NULL,           -- 'Akan', 'Mandingue', 'Peul'...
    moral           TEXT NULL,
    cover_url       VARCHAR(255) NOT NULL,
    is_free         TINYINT(1) NOT NULL DEFAULT 0,
    pack_id         BIGINT UNSIGNED NULL,
    sort_order      INT NOT NULL DEFAULT 0,
    published_at    DATETIME NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pack_id) REFERENCES packs(id) ON DELETE SET NULL,
    INDEX idx_pack (pack_id),
    INDEX idx_free (is_free)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- Versions d'un conte (N1 / N2 / N3)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tale_versions (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    tale_id         BIGINT UNSIGNED NOT NULL,
    level           ENUM('N1','N2','N3') NOT NULL,
    duration_sec    SMALLINT UNSIGNED NOT NULL,
    page_count      TINYINT UNSIGNED NOT NULL,
    manifest_url    VARCHAR(255) NOT NULL,  -- JSON : pages, hotspots, timings, jeux
    FOREIGN KEY (tale_id) REFERENCES tales(id) ON DELETE CASCADE,
    UNIQUE KEY uq_tale_level (tale_id, level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- Pistes audio (une par version × langue)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tale_audio (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    version_id      BIGINT UNSIGNED NOT NULL,
    lang            VARCHAR(10) NOT NULL,        -- fr, bci (baoulé), dyu (dioula), bet, wol, bam
    audio_url       VARCHAR(255) NOT NULL,       -- .opus
    audio_url_fb    VARCHAR(255) NOT NULL,       -- .m4a (fallback iOS)
    timings_url     VARCHAR(255) NOT NULL,       -- JSON word-level timings
    file_size_kb    INT UNSIGNED NOT NULL,
    FOREIGN KEY (version_id) REFERENCES tale_versions(id) ON DELETE CASCADE,
    UNIQUE KEY uq_version_lang (version_id, lang)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- Abonnements
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS subscriptions (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NOT NULL,
    plan            ENUM('monthly','yearly') NOT NULL,
    status          ENUM('pending','active','expired','cancelled') NOT NULL DEFAULT 'pending',
    starts_at       DATETIME NULL,
    ends_at         DATETIME NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_status (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- Achats de packs à l'unité (accès à vie)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pack_purchases (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NOT NULL,
    pack_id         BIGINT UNSIGNED NOT NULL,
    amount_fcfa     INT UNSIGNED NOT NULL,
    status          ENUM('pending','paid','failed','refunded') NOT NULL DEFAULT 'pending',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (pack_id) REFERENCES packs(id),
    UNIQUE KEY uq_user_pack (user_id, pack_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- Transactions de paiement
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS payments (
    id                  BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id             BIGINT UNSIGNED NOT NULL,
    reference           VARCHAR(64) UNIQUE NOT NULL,     -- généré côté serveur
    provider            ENUM('cinetpay','paydunya') NOT NULL,
    provider_tx_id      VARCHAR(128) NULL,
    channel             VARCHAR(30) NULL,                -- wave, orange_money, mtn_momo, moov_money
    amount_fcfa         INT UNSIGNED NOT NULL,
    purpose             ENUM('subscription','pack') NOT NULL,
    purpose_id          BIGINT UNSIGNED NULL,            -- subscription_id ou pack_id
    status              ENUM('pending','success','failed','cancelled') NOT NULL DEFAULT 'pending',
    verified_at         DATETIME NULL,                   -- horodatage de la RE-VÉRIFICATION serveur
    raw_callback        JSON NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_reference (reference),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- Progression de lecture
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reading_progress (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    child_id        BIGINT UNSIGNED NOT NULL,
    tale_id         BIGINT UNSIGNED NOT NULL,
    level           ENUM('N1','N2','N3') NOT NULL,
    last_page       TINYINT UNSIGNED NOT NULL DEFAULT 0,
    completed       TINYINT(1) NOT NULL DEFAULT 0,
    completed_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    quiz_score      TINYINT UNSIGNED NULL,
    last_read_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (child_id) REFERENCES child_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (tale_id) REFERENCES tales(id) ON DELETE CASCADE,
    UNIQUE KEY uq_child_tale (child_id, tale_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- Sessions d'écran (contrôle parental)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS screen_sessions (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    child_id        BIGINT UNSIGNED NOT NULL,
    session_date    DATE NOT NULL,
    seconds_spent   INT UNSIGNED NOT NULL DEFAULT 0,
    FOREIGN KEY (child_id) REFERENCES child_profiles(id) ON DELETE CASCADE,
    UNIQUE KEY uq_child_date (child_id, session_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- Tokens API (auth stateless)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS api_tokens (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    user_id         BIGINT UNSIGNED NOT NULL,
    token_hash      CHAR(64) UNIQUE NOT NULL,        -- SHA-256 du token
    device_label    VARCHAR(100) NULL,
    expires_at      DATETIME NOT NULL,
    revoked_at      DATETIME NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- Compteur de rate limiting (persistant, sans dépendance externe)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    bucket_key      VARCHAR(160) NOT NULL,           -- ex : auth:203.0.113.5
    hits            INT UNSIGNED NOT NULL DEFAULT 0,
    window_start    INT UNSIGNED NOT NULL,           -- timestamp unix du début de fenêtre
    UNIQUE KEY uq_bucket (bucket_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ─────────────────────────────────────────────
-- B2B — licences crèches / écoles (prévu au schéma, hors périmètre V1)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_licenses (
    id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
    org_name        VARCHAR(150) NOT NULL,
    contact_phone   VARCHAR(20) NOT NULL,
    seats           SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    plan            ENUM('creche','maternelle','ecole') NOT NULL DEFAULT 'creche',
    status          ENUM('pending','active','expired') NOT NULL DEFAULT 'pending',
    starts_at       DATETIME NULL,
    ends_at         DATETIME NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;

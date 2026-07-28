-- =============================================================================
--  AMOURA — Installation « tout-en-un » (XAMPP / WAMP / phpMyAdmin)
--  Importez CE fichier dans phpMyAdmin (connecté en root). Il crée la base,
--  l'utilisateur applicatif, le schéma et les données en une seule opération.
--     php scripts/make_admin.php admin@amoura.example "Admin@1234"
-- =============================================================================
CREATE DATABASE IF NOT EXISTS `amoura` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'amoura'@'localhost' IDENTIFIED BY 'secret';
GRANT ALL PRIVILEGES ON `amoura`.* TO 'amoura'@'localhost';
FLUSH PRIVILEGES;
USE `amoura`;

-- =============================================================================
--  AMOURA — Plateforme de rencontres en ligne (SaaS)
--  Schéma de base de données MySQL 8.0+ / MariaDB 10.6+
--  Encodage : utf8mb4 (support complet Unicode + emojis)
--  Toutes les tables InnoDB (transactions, clés étrangères, verrouillage de ligne)
-- =============================================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';
SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
--  RÔLES & PERMISSIONS (RBAC)
-- -----------------------------------------------------------------------------
CREATE TABLE roles (
    id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug          VARCHAR(50)  NOT NULL,              -- super_admin, manager, moderator, member
    name          VARCHAR(100) NOT NULL,
    permissions   JSON         NULL,                  -- ["members.ban","moderation.review",...]
    is_staff      TINYINT(1)   NOT NULL DEFAULT 0,    -- accès à l'espace admin
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  UTILISATEURS
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    role_id            INT UNSIGNED    NOT NULL DEFAULT 4,   -- 4 = member par défaut
    email              VARCHAR(190)    NULL,
    phone              VARCHAR(30)     NULL,                 -- format E.164 ou local (07..., 05..., 01...)
    password_hash      VARCHAR(255)    NOT NULL,             -- Argon2id
    display_name       VARCHAR(100)    NOT NULL,
    referral_code      VARCHAR(16)     NULL,                 -- code de parrainage unique
    birthdate          DATE            NULL,                 -- pour vérification 18+
    gender             ENUM('male','female','nonbinary','other') NULL,
    status             ENUM('pending','active','suspended','banned','deleted') NOT NULL DEFAULT 'pending',
    email_verified_at  TIMESTAMP       NULL,
    phone_verified_at  TIMESTAMP       NULL,
    is_verified        TINYINT(1)      NOT NULL DEFAULT 0,   -- badge "vérifié" (selfie)
    totp_secret        VARCHAR(64)     NULL,                 -- secret Base32 (2FA TOTP)
    totp_enabled       TINYINT(1)      NOT NULL DEFAULT 0,
    sessions_valid_after TIMESTAMP     NULL,                 -- « déconnecter partout » : révoque les sessions antérieures
    boosted_until      TIMESTAMP       NULL,                 -- boost de profil actif jusqu'à
    reveal_until       TIMESTAMP       NULL,                 -- accès « qui m'a liké » débloqué jusqu'à
    last_active_at     TIMESTAMP       NULL,
    is_online          TINYINT(1)      NOT NULL DEFAULT 0,
    gdpr_consent_at    TIMESTAMP       NULL,
    suspended_until    TIMESTAMP       NULL,
    ban_reason         VARCHAR(255)    NULL,
    created_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at         TIMESTAMP       NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_phone (phone),
    UNIQUE KEY uq_referral_code (referral_code),
    KEY idx_users_status (status),
    KEY idx_users_online (is_online, last_active_at),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  PROFILS (1-1 avec users)
-- -----------------------------------------------------------------------------
CREATE TABLE profiles (
    user_id        BIGINT UNSIGNED NOT NULL,
    bio            TEXT            NULL,
    orientation    ENUM('straight','gay','lesbian','bisexual','pansexual','asexual','other') NULL,
    looking_for    ENUM('male','female','everyone') NOT NULL DEFAULT 'everyone',
    country        VARCHAR(2)      NULL,                 -- ISO 3166-1 alpha-2
    city           VARCHAR(120)    NULL,
    latitude       DECIMAL(10,7)   NULL,
    longitude      DECIMAL(10,7)   NULL,
    height_cm      SMALLINT        NULL,
    languages      JSON            NULL,                 -- ["fr","en"]
    interests      JSON            NULL,                 -- ["voyage","musique",...]
    job_title      VARCHAR(120)    NULL,
    education      VARCHAR(120)    NULL,
    smoking        ENUM('no','sometimes','yes') NULL,
    drinking       ENUM('no','sometimes','yes') NULL,
    children       ENUM('no','someday','have','have_more') NULL,
    religion       VARCHAR(40)     NULL,
    relationship_goal ENUM('casual','serious','friends','unsure') NULL,
    cover_photo_id BIGINT UNSIGNED NULL,
    avatar_photo_id BIGINT UNSIGNED NULL,
    completion     TINYINT UNSIGNED NOT NULL DEFAULT 0,  -- % complétude
    updated_at     TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    KEY idx_profiles_geo (country, city),
    KEY idx_profiles_latlng (latitude, longitude),
    CONSTRAINT fk_profiles_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  PARAMÈTRES DE CONFIDENTIALITÉ (1-1)
-- -----------------------------------------------------------------------------
CREATE TABLE privacy_settings (
    user_id             BIGINT UNSIGNED NOT NULL,
    show_online         TINYINT(1) NOT NULL DEFAULT 1,
    show_distance       TINYINT(1) NOT NULL DEFAULT 1,
    show_age            TINYINT(1) NOT NULL DEFAULT 1,
    show_last_active    TINYINT(1) NOT NULL DEFAULT 1,
    discoverable        TINYINT(1) NOT NULL DEFAULT 1,
    incognito           TINYINT(1) NOT NULL DEFAULT 0,   -- navigation privée (VIP)
    read_receipts       TINYINT(1) NOT NULL DEFAULT 1,
    allow_messages_from ENUM('matches','verified','everyone') NOT NULL DEFAULT 'matches',
    PRIMARY KEY (user_id),
    CONSTRAINT fk_privacy_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  PHOTOS
-- -----------------------------------------------------------------------------
CREATE TABLE photos (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED NOT NULL,
    path          VARCHAR(255)    NOT NULL,             -- chemin relatif dans /uploads
    thumb_path    VARCHAR(255)    NULL,
    width         SMALLINT        NULL,
    height        SMALLINT        NULL,
    position      TINYINT         NOT NULL DEFAULT 0,   -- ordre d'affichage
    is_primary    TINYINT(1)      NOT NULL DEFAULT 0,
    moderation    ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_photos_user (user_id, position),
    CONSTRAINT fk_photos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  OTP / TOKENS (vérification email/téléphone, reset mot de passe)
-- -----------------------------------------------------------------------------
CREATE TABLE auth_tokens (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED NULL,
    channel       ENUM('email','phone') NOT NULL,
    purpose       ENUM('verify','login','reset','2fa') NOT NULL,
    destination   VARCHAR(190)    NOT NULL,             -- email ou téléphone ciblé
    code_hash     VARCHAR(255)    NOT NULL,             -- hash du code OTP / token
    attempts      TINYINT         NOT NULL DEFAULT 0,
    expires_at    TIMESTAMP       NOT NULL,
    consumed_at   TIMESTAMP       NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tokens_lookup (destination, purpose, expires_at),
    CONSTRAINT fk_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  SESSIONS (persistées en BDD pour révocation / "déconnecter partout")
-- -----------------------------------------------------------------------------
CREATE TABLE sessions (
    id            CHAR(64)        NOT NULL,             -- token de session
    user_id       BIGINT UNSIGNED NULL,
    ip_address    VARBINARY(16)   NULL,
    user_agent    VARCHAR(255)    NULL,
    payload       MEDIUMTEXT      NULL,
    last_activity INT UNSIGNED    NOT NULL,
    PRIMARY KEY (id),
    KEY idx_sessions_user (user_id),
    KEY idx_sessions_activity (last_activity)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  LIKES / PASS  &  MATCHS
-- -----------------------------------------------------------------------------
CREATE TABLE swipes (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    actor_id      BIGINT UNSIGNED NOT NULL,             -- qui like/pass
    target_id     BIGINT UNSIGNED NOT NULL,             -- profil ciblé
    action        ENUM('like','pass','superlike') NOT NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_swipe (actor_id, target_id),
    KEY idx_swipe_target (target_id, action),
    KEY idx_swipe_actor_date (actor_id, created_at),
    CONSTRAINT fk_swipe_actor  FOREIGN KEY (actor_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_swipe_target FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE matches (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_lo       BIGINT UNSIGNED NOT NULL,             -- min(user_a, user_b) — garantit l'unicité de la paire
    user_hi       BIGINT UNSIGNED NOT NULL,             -- max(user_a, user_b)
    status        ENUM('active','unmatched','blocked') NOT NULL DEFAULT 'active',
    matched_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_match_pair (user_lo, user_hi),
    KEY idx_match_lo_status (user_lo, status),
    KEY idx_match_hi_status (user_hi, status),
    CONSTRAINT fk_match_lo FOREIGN KEY (user_lo) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_match_hi FOREIGN KEY (user_hi) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  BLOCAGES
-- -----------------------------------------------------------------------------
CREATE TABLE blocks (
    blocker_id  BIGINT UNSIGNED NOT NULL,
    blocked_id  BIGINT UNSIGNED NOT NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT fk_block_a FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_block_b FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  VISITES DE PROFIL (« qui a vu mon profil »)
-- -----------------------------------------------------------------------------
CREATE TABLE profile_views (
    profile_id      BIGINT UNSIGNED NOT NULL,             -- profil consulté
    viewer_id       BIGINT UNSIGNED NOT NULL,             -- qui l'a consulté
    views           INT UNSIGNED    NOT NULL DEFAULT 1,
    first_viewed_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_viewed_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (profile_id, viewer_id),
    KEY idx_pview_profile (profile_id, last_viewed_at),
    CONSTRAINT fk_pview_profile FOREIGN KEY (profile_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_pview_viewer  FOREIGN KEY (viewer_id)  REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  ABONNEMENTS AUX NOTIFICATIONS PUSH (Web Push / PWA)
-- -----------------------------------------------------------------------------
CREATE TABLE push_subscriptions (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED NOT NULL,
    endpoint    VARCHAR(512)    NOT NULL,
    p256dh      VARCHAR(255)    NOT NULL,             -- clé publique du client
    auth        VARCHAR(255)    NOT NULL,             -- secret d'authentification
    user_agent  VARCHAR(255)    NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_push_endpoint (endpoint(191)),
    KEY idx_push_user (user_id),
    CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  CONVERSATIONS & MESSAGES
-- -----------------------------------------------------------------------------
CREATE TABLE conversations (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    match_id      BIGINT UNSIGNED NULL,
    last_message_at TIMESTAMP     NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_conv_match (match_id),
    CONSTRAINT fk_conv_match FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE conversation_members (
    conversation_id BIGINT UNSIGNED NOT NULL,
    user_id         BIGINT UNSIGNED NOT NULL,
    last_read_message_id BIGINT UNSIGNED NULL,
    muted           TINYINT(1)  NOT NULL DEFAULT 0,
    PRIMARY KEY (conversation_id, user_id),
    KEY idx_convmem_user (user_id),
    CONSTRAINT fk_convmem_conv FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_convmem_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE messages (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    conversation_id BIGINT UNSIGNED NOT NULL,
    reply_to_id   BIGINT UNSIGNED NULL,                 -- réponse citée
    sender_id     BIGINT UNSIGNED NOT NULL,
    type          ENUM('text','image','voice','call_event','system') NOT NULL DEFAULT 'text',
    body          TEXT            NULL,                 -- texte (chiffré au repos, cf. Core\Security\Crypto)
    media_path    VARCHAR(255)    NULL,                 -- image ou audio
    media_meta    JSON            NULL,                 -- {duration, waveform[], width, height}
    delivered_at  TIMESTAMP       NULL,
    read_at       TIMESTAMP       NULL,
    expires_at    TIMESTAMP       NULL,                 -- message éphémère
    edited_at     TIMESTAMP       NULL,
    deleted_at    TIMESTAMP       NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_msg_conv (conversation_id, id),
    KEY idx_msg_sender (sender_id),
    KEY idx_msg_expires (expires_at),
    CONSTRAINT fk_msg_conv   FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    CONSTRAINT fk_msg_reply  FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL,
    CONSTRAINT fk_msg_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE message_reactions (
    message_id  BIGINT UNSIGNED NOT NULL,
    user_id     BIGINT UNSIGNED NOT NULL,
    emoji       VARCHAR(16)     NOT NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id),
    CONSTRAINT fk_react_msg  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    CONSTRAINT fk_react_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  APPELS (audio/vidéo WebRTC)
-- -----------------------------------------------------------------------------
CREATE TABLE calls (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    conversation_id BIGINT UNSIGNED NULL,
    caller_id     BIGINT UNSIGNED NOT NULL,
    callee_id     BIGINT UNSIGNED NOT NULL,
    kind          ENUM('audio','video') NOT NULL,
    status        ENUM('ringing','ongoing','ended','missed','declined','failed') NOT NULL DEFAULT 'ringing',
    started_at    TIMESTAMP       NULL,
    ended_at      TIMESTAMP       NULL,
    duration_sec  INT UNSIGNED    NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_call_caller (caller_id),
    KEY idx_call_callee (callee_id),
    CONSTRAINT fk_call_caller FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_call_callee FOREIGN KEY (callee_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  STATUTS ÉPHÉMÈRES (stories 24h)
-- -----------------------------------------------------------------------------
CREATE TABLE stories (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED NOT NULL,
    type          ENUM('image','text','video') NOT NULL DEFAULT 'image',
    media_path    VARCHAR(255)    NULL,
    caption       VARCHAR(500)    NULL,
    background    VARCHAR(30)     NULL,                 -- couleur/dégradé pour statut texte
    expires_at    TIMESTAMP       NOT NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_story_user (user_id, expires_at),
    KEY idx_story_expires (expires_at),
    CONSTRAINT fk_story_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE story_views (
    story_id    BIGINT UNSIGNED NOT NULL,
    viewer_id   BIGINT UNSIGNED NOT NULL,
    viewed_at   TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (story_id, viewer_id),
    CONSTRAINT fk_sview_story  FOREIGN KEY (story_id) REFERENCES stories(id) ON DELETE CASCADE,
    CONSTRAINT fk_sview_viewer FOREIGN KEY (viewer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  MUR / PUBLICATIONS (fil d'actualité)
-- -----------------------------------------------------------------------------
CREATE TABLE posts (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED NOT NULL,
    body          TEXT            NULL,
    visibility    ENUM('public','matches','private') NOT NULL DEFAULT 'public',
    like_count    INT UNSIGNED    NOT NULL DEFAULT 0,
    comment_count INT UNSIGNED    NOT NULL DEFAULT 0,
    moderation    ENUM('pending','approved','rejected') NOT NULL DEFAULT 'approved',
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at    TIMESTAMP       NULL,
    PRIMARY KEY (id),
    KEY idx_post_user (user_id, created_at),
    KEY idx_post_feed (visibility, created_at),
    KEY idx_post_mod_id (moderation, deleted_at, id),
    CONSTRAINT fk_post_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE post_media (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    post_id     BIGINT UNSIGNED NOT NULL,
    path        VARCHAR(255)    NOT NULL,
    thumb_path  VARCHAR(255)    NULL,
    position    TINYINT         NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_pmedia_post (post_id),
    CONSTRAINT fk_pmedia_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE post_likes (
    post_id     BIGINT UNSIGNED NOT NULL,
    user_id     BIGINT UNSIGNED NOT NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (post_id, user_id),
    CONSTRAINT fk_plike_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_plike_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE comments (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    post_id       BIGINT UNSIGNED NOT NULL,
    user_id       BIGINT UNSIGNED NOT NULL,
    parent_id     BIGINT UNSIGNED NULL,                 -- réponses imbriquées
    body          TEXT            NOT NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at    TIMESTAMP       NULL,
    PRIMARY KEY (id),
    KEY idx_comment_post (post_id, created_at),
    CONSTRAINT fk_comment_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_comment_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  NOTIFICATIONS
-- -----------------------------------------------------------------------------
CREATE TABLE notifications (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED NOT NULL,             -- destinataire
    actor_id      BIGINT UNSIGNED NULL,                 -- auteur de l'action
    type          ENUM('match','message','like','superlike','comment','post_like','call','system','payment') NOT NULL,
    entity_type   VARCHAR(40)     NULL,
    entity_id     BIGINT UNSIGNED NULL,
    data          JSON            NULL,
    read_at       TIMESTAMP       NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notif_user (user_id, read_at, created_at),
    CONSTRAINT fk_notif_user  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_notif_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  ABONNEMENTS / MONÉTISATION
-- -----------------------------------------------------------------------------
CREATE TABLE plans (
    id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    slug          VARCHAR(50)     NOT NULL,             -- free, premium, vip
    name          VARCHAR(100)    NOT NULL,
    description   VARCHAR(255)    NULL,
    price_cents   INT UNSIGNED    NOT NULL DEFAULT 0,   -- prix en centimes (devise base)
    currency      CHAR(3)         NOT NULL DEFAULT 'XOF',
    `interval`    ENUM('month','year','lifetime') NOT NULL DEFAULT 'month',
    features      JSON            NULL,                 -- {"unlimited_likes":true,"boost":2,...}
    is_active     TINYINT(1)      NOT NULL DEFAULT 1,
    position      TINYINT         NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_plan_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE subscriptions (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED NOT NULL,
    plan_id       INT UNSIGNED    NOT NULL,
    status        ENUM('pending','active','past_due','canceled','expired') NOT NULL DEFAULT 'pending',
    gateway       ENUM('stripe','paypal','cinetpay','paydunya','manual') NULL,
    gateway_ref   VARCHAR(190)    NULL,                 -- subscription id chez le prestataire
    started_at    TIMESTAMP       NULL,
    current_period_end TIMESTAMP  NULL,
    canceled_at   TIMESTAMP       NULL,
    reminder_sent_at TIMESTAMP    NULL,                 -- dunning : dernière relance envoyée
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_sub_user (user_id, status),
    KEY idx_sub_period (status, current_period_end),
    CONSTRAINT fk_sub_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE transactions (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED NOT NULL,
    subscription_id BIGINT UNSIGNED NULL,
    plan_id       INT UNSIGNED    NULL,
    product_id    INT UNSIGNED    NULL,                 -- achat à l'unité (consommable) le cas échéant
    gateway       ENUM('stripe','paypal','cinetpay','paydunya','manual') NOT NULL,
    gateway_ref   VARCHAR(190)    NULL,                 -- transaction id / token prestataire
    amount_cents  INT UNSIGNED    NOT NULL,
    currency      CHAR(3)         NOT NULL DEFAULT 'XOF',
    status        ENUM('initiated','pending','paid','failed','refunded') NOT NULL DEFAULT 'initiated',
    payment_method VARCHAR(50)    NULL,                 -- card, orange_money, mtn_money, moov_money, paypal
    phone         VARCHAR(30)     NULL,                 -- mobile money
    metadata      JSON            NULL,
    paid_at       TIMESTAMP       NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_tx_gateway_ref (gateway, gateway_ref),
    KEY idx_tx_user (user_id, status),
    CONSTRAINT fk_tx_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tx_sub  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  ACHATS À L'UNITÉ (consommables) & PORTEFEUILLE DE CRÉDITS
-- -----------------------------------------------------------------------------
CREATE TABLE products (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    slug        VARCHAR(50)     NOT NULL,
    name        VARCHAR(100)    NOT NULL,
    description VARCHAR(255)    NULL,
    item        ENUM('boost','superlike','reveal') NOT NULL,   -- type de crédit accordé
    quantity    INT UNSIGNED    NOT NULL DEFAULT 1,             -- unités accordées à l'achat
    price_cents INT UNSIGNED    NOT NULL,
    currency    CHAR(3)         NOT NULL DEFAULT 'XOF',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    position    TINYINT         NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_product_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_credits (
    user_id     BIGINT UNSIGNED NOT NULL,
    item        ENUM('boost','superlike','reveal') NOT NULL,
    balance     INT UNSIGNED    NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, item),
    CONSTRAINT fk_credits_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE transactions
    ADD CONSTRAINT fk_tx_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
--  MODÉRATION / SIGNALEMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE reports (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reporter_id   BIGINT UNSIGNED NOT NULL,
    target_type   ENUM('user','photo','post','comment','message','story') NOT NULL,
    target_id     BIGINT UNSIGNED NOT NULL,
    reason        ENUM('fake','harassment','nudity','scam','underage','spam','other') NOT NULL,
    details       VARCHAR(1000)   NULL,
    status        ENUM('open','reviewing','actioned','dismissed') NOT NULL DEFAULT 'open',
    handled_by    BIGINT UNSIGNED NULL,
    handled_at    TIMESTAMP       NULL,
    created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_report_status (status, created_at),
    KEY idx_report_target (target_type, target_id),
    CONSTRAINT fk_report_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_report_handler  FOREIGN KEY (handled_by)  REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  PARAMÈTRES DU SITE (CMS) — clé/valeur typée
-- -----------------------------------------------------------------------------
CREATE TABLE settings (
    `key`       VARCHAR(100)    NOT NULL,
    value       TEXT            NULL,
    type        ENUM('string','int','bool','json','secret') NOT NULL DEFAULT 'string',
    `group`     VARCHAR(50)     NOT NULL DEFAULT 'general',
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Pages statiques éditables (CGU, confidentialité, à propos, FAQ)
CREATE TABLE pages (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    slug        VARCHAR(100)    NOT NULL,
    title       VARCHAR(190)    NOT NULL,
    content     MEDIUMTEXT      NULL,                   -- HTML/Markdown
    is_published TINYINT(1)     NOT NULL DEFAULT 1,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_page_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  JOURNAL D'AUDIT (actions staff/système)
-- -----------------------------------------------------------------------------
CREATE TABLE activity_logs (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED NULL,                   -- acteur (staff ou membre)
    action      VARCHAR(100)    NOT NULL,               -- ex: user.ban, settings.update
    entity_type VARCHAR(50)     NULL,
    entity_id   BIGINT UNSIGNED NULL,
    ip_address  VARBINARY(16)   NULL,
    context     JSON            NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_log_user (user_id, created_at),
    KEY idx_log_action (action, created_at),
    CONSTRAINT fk_log_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  COUPONS · APPAREILS · VÉRIFICATION (Sprint +6)
-- -----------------------------------------------------------------------------
CREATE TABLE coupons (
    id           INT UNSIGNED   NOT NULL AUTO_INCREMENT,
    code         VARCHAR(40)    NOT NULL,
    percent_off  TINYINT UNSIGNED NULL,
    amount_off   INT UNSIGNED   NULL,
    max_redemptions INT UNSIGNED NULL,
    redeemed     INT UNSIGNED   NOT NULL DEFAULT 0,
    expires_at   TIMESTAMP      NULL,
    is_active    TINYINT(1)     NOT NULL DEFAULT 1,
    created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_coupon_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE login_devices (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id      BIGINT UNSIGNED NOT NULL,
    fingerprint  CHAR(64)       NOT NULL,
    user_agent   VARCHAR(255)   NULL,
    last_ip      VARBINARY(16)  NULL,
    first_seen_at TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_device (user_id, fingerprint),
    CONSTRAINT fk_device_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Jetons d'accès API (clients mobiles / tiers) — porteurs opaques hachés.
CREATE TABLE api_tokens (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id      BIGINT UNSIGNED NOT NULL,
    name         VARCHAR(100)   NOT NULL DEFAULT 'mobile',
    token_hash   CHAR(64)       NOT NULL,                    -- SHA-256 hex du jeton en clair
    abilities    JSON           NULL,                        -- portées, ex. ["*"]
    last_used_at DATETIME       NULL,
    expires_at   DATETIME       NULL,                        -- NULL = sans expiration
    created_at   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_api_tokens_hash (token_hash),
    KEY idx_api_tokens_user (user_id),
    CONSTRAINT fk_api_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE verification_requests (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id      BIGINT UNSIGNED NOT NULL,
    selfie_path  VARCHAR(255)   NOT NULL,
    auto_score   TINYINT        NULL,
    status       ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    handled_by   BIGINT UNSIGNED NULL,
    handled_at   TIMESTAMP      NULL,
    created_at   TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_verif_status (status, created_at),
    CONSTRAINT fk_verif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  RATE LIMITING (persistance légère)
-- -----------------------------------------------------------------------------
CREATE TABLE rate_limits (
    bucket      VARCHAR(190)    NOT NULL,               -- ex: login:203.0.113.4
    hits        INT UNSIGNED    NOT NULL DEFAULT 0,
    reset_at    INT UNSIGNED    NOT NULL,               -- timestamp de reset
    PRIMARY KEY (bucket)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  FILE D'ATTENTE E-MAIL / SMS (envoi asynchrone — Phase 1)
-- -----------------------------------------------------------------------------
CREATE TABLE message_outbox (
    id              BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    channel         ENUM('email','sms') NOT NULL,
    recipient       VARCHAR(190)    NOT NULL,           -- e-mail ou numéro E.164
    subject         VARCHAR(255)    NULL,               -- e-mail uniquement
    body            TEXT            NOT NULL,
    meta            JSON            NULL,                -- {from, template, user_id…}
    status          ENUM('pending','sending','sent','failed') NOT NULL DEFAULT 'pending',
    attempts        TINYINT UNSIGNED NOT NULL DEFAULT 0,
    max_attempts    TINYINT UNSIGNED NOT NULL DEFAULT 5,
    next_attempt_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,  -- planif. backoff
    last_error      VARCHAR(500)    NULL,
    provider_ref    VARCHAR(190)    NULL,               -- id de message prestataire
    created_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    sent_at         TIMESTAMP       NULL,
    PRIMARY KEY (id),
    KEY idx_outbox_due (status, next_attempt_at)         -- sélection des messages « dus »
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  CONSENTEMENTS RGPD (journal append-only — preuve de consentement)
-- -----------------------------------------------------------------------------
CREATE TABLE user_consents (
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

-- -----------------------------------------------------------------------------
--  ÉVÉNEMENTS & COMMUNAUTÉS (Phase 5) — inscription + liste d'attente
-- -----------------------------------------------------------------------------
CREATE TABLE events (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    host_id     BIGINT UNSIGNED NULL,
    title       VARCHAR(150)   NOT NULL,
    slug        VARCHAR(160)   NOT NULL,
    description TEXT           NULL,
    type        ENUM('speed_dating','salon','meetup','online') NOT NULL DEFAULT 'meetup',
    is_online   TINYINT(1)     NOT NULL DEFAULT 0,
    location    VARCHAR(200)   NULL,
    cover_path  VARCHAR(255)   NULL,
    capacity    INT UNSIGNED   NULL,                   -- NULL = illimité
    starts_at   DATETIME       NOT NULL,
    ends_at     DATETIME       NULL,
    status      ENUM('draft','published','canceled') NOT NULL DEFAULT 'draft',
    created_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_event_slug (slug),
    KEY idx_event_agenda (status, starts_at),
    CONSTRAINT fk_event_host FOREIGN KEY (host_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE event_attendees (
    event_id   BIGINT UNSIGNED NOT NULL,
    user_id    BIGINT UNSIGNED NOT NULL,
    status     ENUM('going','waitlist','canceled') NOT NULL DEFAULT 'going',
    joined_at  TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_id, user_id),
    KEY idx_att_user (user_id),
    KEY idx_att_event_status (event_id, status, joined_at),
    CONSTRAINT fk_att_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    CONSTRAINT fk_att_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  MULTI-DEVISES (Phase 5) — table de conversion, base XOF
-- -----------------------------------------------------------------------------
CREATE TABLE currency_rates (
    code          CHAR(3)        NOT NULL,               -- ISO 4217
    name          VARCHAR(50)    NOT NULL,
    symbol        VARCHAR(8)     NOT NULL,
    rate_to_base  DECIMAL(18,8)  NOT NULL,               -- unités de `code` pour 1 XOF
    decimals      TINYINT UNSIGNED NOT NULL DEFAULT 2,
    symbol_before TINYINT(1)     NOT NULL DEFAULT 0,
    is_active     TINYINT(1)     NOT NULL DEFAULT 1,
    position      INT            NOT NULL DEFAULT 0,
    updated_at    TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
--  PARRAINAGE (Phase 5)
-- -----------------------------------------------------------------------------
CREATE TABLE referrals (
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

-- -----------------------------------------------------------------------------
--  Clés étrangères différées (photos <-> profiles)
-- -----------------------------------------------------------------------------
ALTER TABLE profiles
    ADD CONSTRAINT fk_profile_cover  FOREIGN KEY (cover_photo_id)  REFERENCES photos(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_profile_avatar FOREIGN KEY (avatar_photo_id) REFERENCES photos(id) ON DELETE SET NULL;

SET FOREIGN_KEY_CHECKS = 1;

-- =============================================================================
--  AMOURA — Données de démarrage (rôles, plans, paramètres, pages CMS, admin)
--  Le mot de passe de l'admin de démo est "Admin@1234" (à changer en prod).
-- =============================================================================

-- Rôles RBAC ----------------------------------------------------------------
INSERT INTO roles (id, slug, name, permissions, is_staff) VALUES
  (1,'super_admin','Super administrateur', JSON_ARRAY('*'), 1),
  (2,'manager','Gestionnaire',
     JSON_ARRAY('dashboard.view','members.view','members.suspend','members.verify',
                'subscriptions.manage','settings.view','settings.update','cms.manage'), 1),
  (3,'moderator','Modérateur',
     JSON_ARRAY('dashboard.view','members.view','moderation.review','moderation.action','reports.view'), 1),
  (4,'member','Membre', JSON_ARRAY(), 0);

-- Plans d'abonnement --------------------------------------------------------
INSERT INTO plans (slug, name, description, price_cents, currency, `interval`, features, position) VALUES
  ('free','Gratuit','Pour commencer', 0,'XOF','month',
     JSON_OBJECT('daily_likes',20,'unlimited_likes',false,'boost',0,'advanced_filters',false,'see_who_liked',false,'badge',false), 0),
  ('premium','Premium','Rencontrez plus vite', 350000,'XOF','month',
     JSON_OBJECT('daily_likes',-1,'unlimited_likes',true,'boost',1,'advanced_filters',true,'see_who_liked',true,'badge',true), 1),
  ('vip','VIP','L''expérience complète', 900000,'XOF','month',
     JSON_OBJECT('daily_likes',-1,'unlimited_likes',true,'boost',5,'advanced_filters',true,'see_who_liked',true,'badge',true,'priority_support',true,'incognito',true), 2);

-- Paramètres du site (CMS) --------------------------------------------------
INSERT INTO settings (`key`, value, type, `group`) VALUES
  ('site_name','Amoura','string','general'),
  ('site_tagline','Rencontrez la bonne personne','string','general'),
  ('site_logo','/assets/img/logo.svg','string','general'),
  ('primary_color','#ff5a7e','string','theme'),
  ('secondary_color','#8b5cf6','string','theme'),
  ('default_theme','light','string','theme'),
  ('min_age','18','int','compliance'),
  ('registration_open','1','bool','general'),
  ('require_email_verification','1','bool','auth'),
  ('base_currency','XOF','string','payments'),
  ('stripe_public_key','','secret','payments'),
  ('stripe_secret_key','','secret','payments'),
  ('paypal_client_id','','secret','payments'),
  ('paypal_secret','','secret','payments'),
  ('paypal_webhook_id','','secret','payments'),
  ('cinetpay_api_key','','secret','payments'),
  ('cinetpay_site_id','','secret','payments'),
  ('paydunya_master_key','','secret','payments'),
  ('flutterwave_secret_key','','secret','payments'),
  ('flutterwave_secret_hash','','secret','payments'),
  ('wave_api_key','','secret','payments'),
  ('wave_webhook_secret','','secret','payments'),
  ('mpesa_consumer_key','','secret','payments'),
  ('mpesa_consumer_secret','','secret','payments'),
  ('mpesa_shortcode','','string','payments'),
  ('mpesa_passkey','','secret','payments'),
  ('mpesa_env','sandbox','string','payments'),
  ('mail_from','no-reply@amoura.example','string','mail'),
  ('welcome_message','Bienvenue sur Amoura ! Complétez votre profil pour commencer.','string','content'),
  ('vapid_public_key','','string','push'),
  ('vapid_private_key','','secret','push'),
  ('vapid_subject','mailto:no-reply@amoura.example','string','push'),
  ('default_locale','fr','string','general');

-- Catalogue de consommables (achats à l'unité) ------------------------------
INSERT INTO products (slug, name, description, item, quantity, price_cents, currency, position) VALUES
  ('boost-1',      'Boost x1',            'Mettez votre profil en avant pendant 30 min', 'boost',     1, 100000, 'XOF', 0),
  ('boost-5',      'Pack 5 Boosts',       'Cinq boosts à utiliser quand vous voulez',    'boost',     5, 400000, 'XOF', 1),
  ('superlike-5',  'Pack 5 Super Likes',  'Sortez du lot avec le Super Like',            'superlike', 5, 150000, 'XOF', 2),
  ('superlike-15', 'Pack 15 Super Likes', 'Le pack malin',                               'superlike', 15, 350000, 'XOF', 3),
  ('reveal-1',     'Révéler mes admirateurs', 'Voir qui vous a liké pendant 24 h',       'reveal',    1, 200000, 'XOF', 4);

-- Pages statiques éditables -------------------------------------------------
INSERT INTO pages (slug, title, content) VALUES
  ('terms','Conditions générales d''utilisation','<h1>CGU</h1><p>Contenu à éditer depuis l''admin.</p>'),
  ('privacy','Politique de confidentialité','<h1>Confidentialité</h1><p>Contenu à éditer depuis l''admin.</p>'),
  ('about','À propos','<h1>À propos d''Amoura</h1><p>Contenu à éditer depuis l''admin.</p>'),
  ('faq','FAQ','<h1>Foire aux questions</h1><p>Contenu à éditer depuis l''admin.</p>');

-- Compte administrateur de démonstration ------------------------------------
-- Hash Argon2id du mot de passe "Admin@1234"
INSERT INTO users (role_id, email, password_hash, display_name, birthdate, gender, status, email_verified_at, is_verified, gdpr_consent_at)
VALUES (1, 'admin@amoura.example',
        'CHANGE_ME_RUN_MAKE_ADMIN',
        'Administrateur', '1990-01-01', 'other', 'active', NOW(), 1, NOW());
-- IMPORTANT : le hash ci-dessus est un espace réservé invalide. Générez un vrai
-- mot de passe Argon2id puis mettez-le à jour, par exemple :
--   php scripts/make_admin.php admin@amoura.example 'Admin@1234'

-- Devises de conversion (base XOF) — taux indicatifs, à réviser en production.
INSERT INTO currency_rates (code, name, symbol, rate_to_base, decimals, symbol_before, position) VALUES
  ('XOF', 'Franc CFA (UEMOA)', 'FCFA', 1.00000000, 0, 0, 0),
  ('XAF', 'Franc CFA (CEMAC)', 'FCFA', 1.00000000, 0, 0, 1),
  ('EUR', 'Euro',             '€',    0.00152450, 2, 1, 2),
  ('USD', 'Dollar américain', '$',    0.00165000, 2, 1, 3),
  ('GHS', 'Cedi ghanéen',     'GH₵',  0.02500000, 2, 1, 4),
  ('NGN', 'Naira nigérian',   '₦',    2.63000000, 0, 1, 5),
  ('KES', 'Shilling kényan',  'KSh',  0.22000000, 2, 1, 6);

-- Événements de démonstration (publiés, à venir).
INSERT INTO events (title, slug, description, type, is_online, location, capacity, starts_at, ends_at, status) VALUES
  ('Speed-dating vidéo — Édition découverte', 'speed-dating-video-decouverte',
   'Enchaînez des tête-à-tête vidéo de 5 minutes et laissez le courant passer.',
   'speed_dating', 1, NULL, 20, DATE_ADD(NOW(), INTERVAL 7 DAY), DATE_ADD(NOW(), INTERVAL 7 DAY) + INTERVAL 90 MINUTE, 'published'),
  ('Salon « Cuisine & rencontres » à Abidjan', 'salon-cuisine-abidjan',
   'Un atelier culinaire convivial pour cuisiner… et faire des rencontres.',
   'salon', 0, 'Abidjan, Cocody', 30, DATE_ADD(NOW(), INTERVAL 14 DAY), NULL, 'published');

-- ─────────────────────────────────────────────────────────────────────────
-- Transouscris — Schéma de base de données (MySQL 8+)
-- Encodage utf8mb4, moteur InnoDB (transactions + verrous de ligne requis
-- pour SELECT ... FOR UPDATE sur le grand livre).
--
-- Montants : stockés en ENTIERS (unités mineures XOF). Le XOF n'ayant pas de
-- centime, 1 unité = 1 F CFA ; on garde des entiers pour bannir tout flottant.
-- ─────────────────────────────────────────────────────────────────────────

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ── Utilisateurs ──────────────────────────────────────────────────────────
CREATE TABLE users (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    phone          VARCHAR(20)  NOT NULL,               -- E.164 sans '+', ex: 2250700000000
    name           VARCHAR(120) NULL,
    email          VARCHAR(190) NULL,
    password_hash  VARCHAR(255) NULL,                   -- optionnel (back-office)
    role           ENUM('customer','agent','admin') NOT NULL DEFAULT 'customer',
    status         ENUM('active','suspended')       NOT NULL DEFAULT 'active',
    phone_verified TINYINT(1)   NOT NULL DEFAULT 0,
    created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_phone (phone),
    UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── GRAND LIVRE : comptes ────────────────────────────────────────────────
-- Un compte par portefeuille utilisateur/agent + comptes système (code unique).
CREATE TABLE ledger_accounts (
    id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner_type     ENUM('user','agent','system') NOT NULL,
    owner_id       BIGINT UNSIGNED NULL,               -- NULL pour les comptes système
    code           VARCHAR(64) NULL,                   -- renseigné pour les comptes système
    type           ENUM('asset','liability','revenue','expense') NOT NULL DEFAULT 'liability',
    currency       CHAR(3) NOT NULL DEFAULT 'XOF',
    balance        BIGINT NOT NULL DEFAULT 0,          -- solde en cache (signé)
    allow_negative TINYINT(1) NOT NULL DEFAULT 0,      -- comptes système de compensation
    status         ENUM('active','frozen') NOT NULL DEFAULT 'active',
    created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ledger_owner (owner_type, owner_id),
    UNIQUE KEY uq_ledger_code (code),
    KEY idx_ledger_owner_id (owner_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── GRAND LIVRE : transactions (entêtes équilibrées) ─────────────────────
CREATE TABLE ledger_transactions (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reference   VARCHAR(80) NOT NULL,                  -- clé d'idempotence métier
    type        VARCHAR(40) NOT NULL,                  -- wallet_topup, recharge, refund...
    status      ENUM('posted','reversed') NOT NULL DEFAULT 'posted',
    metadata    JSON NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ledger_txn_reference (reference),    -- garantit l'idempotence
    KEY idx_ledger_txn_type (type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── GRAND LIVRE : écritures (au moins 2 par transaction, Σ débits = Σ crédits)
CREATE TABLE ledger_entries (
    id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ledger_transaction_id  BIGINT UNSIGNED NOT NULL,
    account_id             BIGINT UNSIGNED NOT NULL,
    direction              ENUM('debit','credit') NOT NULL,
    amount                 BIGINT NOT NULL,            -- positif (unités mineures)
    balance_after          BIGINT NOT NULL,            -- solde du compte après cette écriture
    created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_entries_txn (ledger_transaction_id),
    KEY idx_entries_account (account_id),
    CONSTRAINT fk_entries_txn     FOREIGN KEY (ledger_transaction_id) REFERENCES ledger_transactions(id),
    CONSTRAINT fk_entries_account FOREIGN KEY (account_id)            REFERENCES ledger_accounts(id),
    CONSTRAINT chk_entries_amount CHECK (amount > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Opérateurs (référentiel) ─────────────────────────────────────────────
CREATE TABLE operators (
    code       VARCHAR(20) NOT NULL,                   -- orange | moov | mtn
    name       VARCHAR(60) NOT NULL,
    color      VARCHAR(10) NULL,
    active     TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Forfaits ─────────────────────────────────────────────────────────────
CREATE TABLE plans (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    operator_code VARCHAR(20) NOT NULL,
    code          VARCHAR(40) NOT NULL,
    name          VARCHAR(120) NOT NULL,
    category      ENUM('internet','voice','sms','mixte') NOT NULL DEFAULT 'internet',
    -- Sous-catégorie fine (pour le filtrage) : illimite | jour | semaine |
    -- quinzaine | mois | nuit | special. NULL pour appels/SMS simples.
    subcategory   VARCHAR(40) NULL,
    price         BIGINT NOT NULL,                      -- unités mineures
    validity      VARCHAR(40) NULL,
    data_volume   VARCHAR(40) NULL,                     -- ex: "1 Go", "Illimité"
    description   VARCHAR(255) NULL,
    active        TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    UNIQUE KEY uq_plan_code (operator_code, code),
    KEY idx_plan_operator (operator_code, active),
    CONSTRAINT fk_plan_operator FOREIGN KEY (operator_code) REFERENCES operators(code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Intentions de paiement (pivot fournisseur ↔ crédit wallet) ───────────
CREATE TABLE payment_intents (
    id                       BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id                  BIGINT UNSIGNED NOT NULL,
    reference                VARCHAR(80) NOT NULL,
    gateway                  VARCHAR(30) NOT NULL,       -- cinetpay | paydunya | wave | stripe
    purpose                  ENUM('wallet_topup','direct_recharge','pot_contribution') NOT NULL,
    amount                   BIGINT NOT NULL,
    currency                 CHAR(3) NOT NULL DEFAULT 'XOF',
    status                   ENUM('pending','paid','failed','expired','cancelled') NOT NULL DEFAULT 'pending',
    provider_transaction_id  VARCHAR(120) NULL,
    ledger_transaction_id    BIGINT UNSIGNED NULL,
    metadata                 JSON NULL,
    created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at                  DATETIME NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_intent_reference (reference),
    KEY idx_intent_user (user_id),
    KEY idx_intent_status (status),
    CONSTRAINT fk_intent_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Recharges (ordres crédit/forfait) ────────────────────────────────────
CREATE TABLE recharges (
    id                     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id                BIGINT UNSIGNED NOT NULL,
    agent_id               BIGINT UNSIGNED NULL,
    plan_id                BIGINT UNSIGNED NULL,
    operator_code          VARCHAR(20) NOT NULL,
    msisdn                 VARCHAR(20) NOT NULL,
    type                   ENUM('credit','internet','voice','sms','transfer') NOT NULL DEFAULT 'credit',
    amount                 BIGINT NOT NULL,
    status                 ENUM('pending','dispatched','success','failed','refunded') NOT NULL DEFAULT 'pending',
    ledger_transaction_id  BIGINT UNSIGNED NULL,
    operator_ref           VARCHAR(120) NULL,
    guarantee_deadline     DATETIME NULL,               -- échéance de la garantie de remboursement
    created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at           DATETIME NULL,
    PRIMARY KEY (id),
    KEY idx_recharge_user (user_id),
    KEY idx_recharge_status (status),
    KEY idx_recharge_guarantee (status, guarantee_deadline),
    CONSTRAINT fk_recharge_user FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_recharge_plan FOREIGN KEY (plan_id) REFERENCES plans(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Agents ───────────────────────────────────────────────────────────────
CREATE TABLE agents (
    id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id           BIGINT UNSIGNED NOT NULL,
    code              VARCHAR(30) NOT NULL,
    display_name      VARCHAR(120) NOT NULL,
    zone              VARCHAR(80) NULL,
    is_available      TINYINT(1) NOT NULL DEFAULT 0,
    rating_avg        DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    rating_count      INT UNSIGNED NOT NULL DEFAULT 0,
    reliability_score DECIMAL(5,2) NOT NULL DEFAULT 100.00,
    float_account_id  BIGINT UNSIGNED NULL,
    status            ENUM('active','suspended') NOT NULL DEFAULT 'active',
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_agent_code (code),
    UNIQUE KEY uq_agent_user (user_id),
    KEY idx_agent_available (status, is_available),
    CONSTRAINT fk_agent_user  FOREIGN KEY (user_id)          REFERENCES users(id),
    CONSTRAINT fk_agent_float FOREIGN KEY (float_account_id) REFERENCES ledger_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Codes OTP (hash uniquement) ──────────────────────────────────────────
CREATE TABLE otp_codes (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    phone       VARCHAR(20) NOT NULL,
    code_hash   CHAR(64) NOT NULL,                      -- SHA-256(phone:code:APP_KEY)
    purpose     VARCHAR(30) NOT NULL DEFAULT 'login',
    attempts    TINYINT UNSIGNED NOT NULL DEFAULT 0,
    expires_at  DATETIME NOT NULL,
    consumed_at DATETIME NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_otp_lookup (phone, purpose, consumed_at, expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Favoris (numéros enregistrés) ────────────────────────────────────────
CREATE TABLE favorites (
    id            BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id       BIGINT UNSIGNED NOT NULL,
    label         VARCHAR(80) NOT NULL,                   -- ex: "Maman", "Moi"
    relation      ENUM('moi','famille','parents','conjoint','enfants','amis','entreprise','autre') NOT NULL DEFAULT 'autre',
    msisdn        VARCHAR(20) NOT NULL,
    operator_code VARCHAR(20) NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_favorite (user_id, msisdn),
    KEY idx_favorite_user (user_id),
    CONSTRAINT fk_favorite_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Notifications ────────────────────────────────────────────────────────
CREATE TABLE notifications (
    id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id    BIGINT UNSIGNED NOT NULL,
    type       ENUM('transaction','promo','expiration','nouveaute','echec','systeme') NOT NULL DEFAULT 'systeme',
    title      VARCHAR(140) NOT NULL,
    body       VARCHAR(255) NULL,
    link       VARCHAR(190) NULL,
    is_read    TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notif_user (user_id, is_read, created_at),
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Cagnottes (recharge collective) ──────────────────────────────────────
CREATE TABLE pots (
    id                 BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner_user_id      BIGINT UNSIGNED NOT NULL,
    slug               VARCHAR(16) NOT NULL,            -- segment public du lien
    title              VARCHAR(120) NOT NULL,
    beneficiary_msisdn VARCHAR(20) NOT NULL,
    operator_code      VARCHAR(20) NULL,
    target_amount      BIGINT NOT NULL,
    collected_amount   BIGINT NOT NULL DEFAULT 0,
    status             ENUM('open','funded','disbursed','closed') NOT NULL DEFAULT 'open',
    expires_at         DATETIME NULL,
    created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_pot_slug (slug),
    KEY idx_pot_owner (owner_user_id),
    CONSTRAINT fk_pot_owner FOREIGN KEY (owner_user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pot_contributions (
    id                BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    pot_id            BIGINT UNSIGNED NOT NULL,
    contributor_name  VARCHAR(120) NULL,
    amount            BIGINT NOT NULL,
    payment_intent_id BIGINT UNSIGNED NULL,
    status            ENUM('pending','confirmed','failed') NOT NULL DEFAULT 'pending',
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_contrib_pot (pot_id),
    CONSTRAINT fk_contrib_pot    FOREIGN KEY (pot_id)            REFERENCES pots(id),
    CONSTRAINT fk_contrib_intent FOREIGN KEY (payment_intent_id) REFERENCES payment_intents(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Recharges programmées (seuil bas + auto) ─────────────────────────────
CREATE TABLE scheduled_recharges (
    id               BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id          BIGINT UNSIGNED NOT NULL,
    msisdn           VARCHAR(20) NOT NULL,
    operator_code    VARCHAR(20) NOT NULL,
    recharge_amount  BIGINT NOT NULL,
    threshold_amount BIGINT NULL,                       -- déclenchement sur seuil bas
    frequency        ENUM('monthly','weekly','threshold') NOT NULL DEFAULT 'monthly',
    next_run_at      DATETIME NULL,
    is_active        TINYINT(1) NOT NULL DEFAULT 1,
    created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_sched_run (is_active, next_run_at),
    CONSTRAINT fk_sched_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Fidélité / gamification ──────────────────────────────────────────────
CREATE TABLE loyalty_accounts (
    user_id     BIGINT UNSIGNED NOT NULL,
    points      BIGINT NOT NULL DEFAULT 0,
    tier        ENUM('bronze','argent','or','platine') NOT NULL DEFAULT 'bronze',
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_loyalty_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE loyalty_ledger (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED NOT NULL,
    delta       BIGINT NOT NULL,                        -- + gain / - dépense
    reason      VARCHAR(60) NOT NULL,                   -- recharge, defi, cashback, echange...
    reference   VARCHAR(80) NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_loyalty_user (user_id),
    CONSTRAINT fk_loyalty_ledger_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Journal d'audit (immuable par convention) ────────────────────────────
CREATE TABLE audit_logs (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED NULL,
    action      VARCHAR(60) NOT NULL,
    entity_type VARCHAR(60) NOT NULL,
    entity_id   BIGINT UNSIGNED NULL,
    ip_address  VARCHAR(45) NULL,
    metadata    JSON NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_audit_user (user_id),
    KEY idx_audit_entity (entity_type, entity_id),
    KEY idx_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Rate limiting (fenêtre glissante) ────────────────────────────────────
CREATE TABLE rate_limits (
    id           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    rate_key     VARCHAR(190) NOT NULL,
    hits         INT UNSIGNED NOT NULL DEFAULT 0,
    window_start INT UNSIGNED NOT NULL,                 -- timestamp Unix
    PRIMARY KEY (id),
    UNIQUE KEY uq_rate_key (rate_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

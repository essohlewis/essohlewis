-- =============================================================================
--  Migration 006 — File d'attente e-mail/SMS asynchrone (Phase 1, Sprint +7)
--  Découple l'envoi (OTP, notifications) de la latence prestataire : la requête
--  HTTP enfile un message, un worker le délivre avec relances à backoff.
-- =============================================================================

CREATE TABLE IF NOT EXISTS message_outbox (
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
    -- Sélection efficace des messages « dus » par le worker.
    KEY idx_outbox_due (status, next_attempt_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

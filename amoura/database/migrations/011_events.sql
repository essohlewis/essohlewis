-- =============================================================================
--  Migration 011 — Événements & communautés (Phase 5)
--  Speed-dating vidéo, salons thématiques, rencontres : inscription avec
--  capacité et liste d'attente.
-- =============================================================================

CREATE TABLE IF NOT EXISTS events (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    host_id     BIGINT UNSIGNED NULL,                  -- membre du staff créateur
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

CREATE TABLE IF NOT EXISTS event_attendees (
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

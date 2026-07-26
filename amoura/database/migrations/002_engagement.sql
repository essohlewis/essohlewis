-- =============================================================================
--  Migration 002 — Sprint +2 (engagement)
--  Tables : visites de profil (« qui a vu mon profil ») + abonnements Web Push.
-- =============================================================================

CREATE TABLE IF NOT EXISTS profile_views (
    profile_id      BIGINT UNSIGNED NOT NULL,
    viewer_id       BIGINT UNSIGNED NOT NULL,
    views           INT UNSIGNED    NOT NULL DEFAULT 1,
    first_viewed_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_viewed_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (profile_id, viewer_id),
    KEY idx_pview_profile (profile_id, last_viewed_at),
    CONSTRAINT fk_pview_profile FOREIGN KEY (profile_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_pview_viewer  FOREIGN KEY (viewer_id)  REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id     BIGINT UNSIGNED NOT NULL,
    endpoint    VARCHAR(512)    NOT NULL,
    p256dh      VARCHAR(255)    NOT NULL,
    auth        VARCHAR(255)    NOT NULL,
    user_agent  VARCHAR(255)    NULL,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_push_endpoint (endpoint(191)),
    KEY idx_push_user (user_id),
    CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Réglages Web Push (clés VAPID) éditables depuis l'admin.
INSERT IGNORE INTO settings (`key`, value, type, `group`) VALUES
  ('vapid_public_key','','string','push'),
  ('vapid_private_key','','secret','push'),
  ('vapid_subject','mailto:no-reply@amoura.example','string','push');

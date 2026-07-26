-- =============================================================================
--  Migration 004 — Sprint +5 (monétisation)
--  Achats à l'unité (consommables) + portefeuille de crédits + dunning.
-- =============================================================================

ALTER TABLE users
    ADD COLUMN boosted_until TIMESTAMP NULL AFTER sessions_valid_after,
    ADD COLUMN reveal_until TIMESTAMP NULL AFTER boosted_until;

ALTER TABLE transactions
    ADD COLUMN product_id INT UNSIGNED NULL AFTER plan_id;

ALTER TABLE subscriptions
    ADD COLUMN reminder_sent_at TIMESTAMP NULL AFTER canceled_at,
    ADD INDEX idx_sub_period (status, current_period_end);

CREATE TABLE IF NOT EXISTS products (
    id          INT UNSIGNED    NOT NULL AUTO_INCREMENT,
    slug        VARCHAR(50)     NOT NULL,
    name        VARCHAR(100)    NOT NULL,
    description VARCHAR(255)    NULL,
    item        ENUM('boost','superlike','reveal') NOT NULL,
    quantity    INT UNSIGNED    NOT NULL DEFAULT 1,
    price_cents INT UNSIGNED    NOT NULL,
    currency    CHAR(3)         NOT NULL DEFAULT 'XOF',
    is_active   TINYINT(1)      NOT NULL DEFAULT 1,
    position    TINYINT         NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_product_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_credits (
    user_id     BIGINT UNSIGNED NOT NULL,
    item        ENUM('boost','superlike','reveal') NOT NULL,
    balance     INT UNSIGNED    NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, item),
    CONSTRAINT fk_credits_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE transactions
    ADD CONSTRAINT fk_tx_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- Catalogue de consommables par défaut.
INSERT IGNORE INTO products (slug, name, description, item, quantity, price_cents, currency, position) VALUES
  ('boost-1',      'Boost x1',        'Mettez votre profil en avant pendant 30 min', 'boost',     1, 100000, 'XOF', 0),
  ('boost-5',      'Pack 5 Boosts',   'Cinq boosts à utiliser quand vous voulez',    'boost',     5, 400000, 'XOF', 1),
  ('superlike-5',  'Pack 5 Super Likes', 'Sortez du lot avec le Super Like',         'superlike', 5, 150000, 'XOF', 2),
  ('superlike-15', 'Pack 15 Super Likes', 'Le pack malin',                           'superlike', 15, 350000, 'XOF', 3),
  ('reveal-1',     'Révéler mes admirateurs', 'Voir qui vous a liké pendant 24 h',   'reveal',    1, 200000, 'XOF', 4);

-- =============================================================================
--  Migration 001 — Index d'optimisation des requêtes chaudes (Sprint +1).
--  Sûre à rejouer une seule fois (suivi via la table schema_migrations).
--  Les installations neuves ont déjà ces index (schema.sql) et sont « baselinées ».
-- =============================================================================

-- Matchs : remplace l'index simple par des composites (colonne + statut) pour
-- accélérer la liste des matchs actifs d'un utilisateur (forUser).
ALTER TABLE matches
    DROP INDEX idx_match_hi,
    ADD INDEX idx_match_lo_status (user_lo, status),
    ADD INDEX idx_match_hi_status (user_hi, status);

-- Swipes : likes du jour & admirateurs (filtre par acteur + date).
ALTER TABLE swipes
    ADD INDEX idx_swipe_actor_date (actor_id, created_at);

-- Statuts : fil des stories actives (balayage global sur l'expiration).
ALTER TABLE stories
    ADD INDEX idx_story_expires (expires_at);

-- Publications : fil d'actualité (modération + suppression logique + tri par id).
ALTER TABLE posts
    ADD INDEX idx_post_mod_id (moderation, deleted_at, id);

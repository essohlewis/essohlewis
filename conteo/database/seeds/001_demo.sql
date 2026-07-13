-- ═══════════════════════════════════════════════════════════════
--  CONTEO — Données de démonstration
--  À exécuter APRÈS database/migrations/001_schema.sql
-- ═══════════════════════════════════════════════════════════════

SET NAMES utf8mb4;

-- ── Administrateur de démonstration ──
-- Téléphone : +2250700000000   Mot de passe : conteo-admin
INSERT INTO users (phone, email, password_hash, display_name, phone_verified, is_admin, status)
VALUES (
    '+2250700000000', 'admin@conteo.ci',
    '$argon2id$v=19$m=65536,t=4,p=1$dzJveGZpVllqbzJFNjdSTg$5VHvgct3b1ndmOc8+wLu093oBJ7M6z2JUwQbBHltTbE',
    'Administrateur CONTEO', 1, 1, 'active'
);

-- ── Pack de démonstration ──
INSERT INTO packs (slug, title, description, cover_url, price_fcfa, tale_count, total_size_mb, is_active)
VALUES ('contes-akan', 'Contes Akan', 'Une sélection de contes du patrimoine akan.',
        '/media/tales/kacou-baobab/cover.svg', 2000, 10, 48, 1);

-- ── Conte de démonstration (gratuit) ──
INSERT INTO tales (slug, title, origin, moral, cover_url, is_free, pack_id, sort_order, published_at)
VALUES (
    'kacou-ananze-et-le-baobab', 'Kacou Ananzè et le baobab', 'Akan',
    'La ruse ne remplace jamais le travail.',
    '/media/tales/kacou-baobab/cover.svg', 1, NULL, 1, NOW()
);

SET @tale_id = LAST_INSERT_ID();

-- ── Versions N1 / N2 / N3 ──
INSERT INTO tale_versions (tale_id, level, duration_sec, page_count, manifest_url) VALUES
    (@tale_id, 'N1', 150, 3, '/media/tales/kacou-baobab/n1/manifest.json'),
    (@tale_id, 'N2', 380, 4, '/media/tales/kacou-baobab/n2/manifest.json'),
    (@tale_id, 'N3', 720, 4, '/media/tales/kacou-baobab/n3/manifest.json');

-- ── Pistes audio (français) ──
-- Les .opus / .m4a réels sont fournis par le studio ; les timings existent déjà.
INSERT INTO tale_audio (version_id, lang, audio_url, audio_url_fb, timings_url, file_size_kb)
SELECT v.id, 'fr',
       CONCAT('/media/tales/kacou-baobab/', LOWER(v.level), '/fr.opus'),
       CONCAT('/media/tales/kacou-baobab/', LOWER(v.level), '/fr.m4a'),
       CONCAT('/media/tales/kacou-baobab/', LOWER(v.level), '/timings.fr.json'),
       1200
FROM tale_versions v WHERE v.tale_id = @tale_id;

-- ── Piste audio N2 en baoulé (illustration du multilangue) ──
INSERT INTO tale_audio (version_id, lang, audio_url, audio_url_fb, timings_url, file_size_kb)
SELECT v.id, 'bci',
       '/media/tales/kacou-baobab/n2/bci.opus',
       '/media/tales/kacou-baobab/n2/bci.m4a',
       '/media/tales/kacou-baobab/n2/timings.fr.json',
       1200
FROM tale_versions v WHERE v.tale_id = @tale_id AND v.level = 'N2';

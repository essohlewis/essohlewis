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
  ('mail_from','no-reply@amoura.example','string','mail'),
  ('welcome_message','Bienvenue sur Amoura ! Complétez votre profil pour commencer.','string','content'),
  ('vapid_public_key','','string','push'),
  ('vapid_private_key','','secret','push'),
  ('vapid_subject','mailto:no-reply@amoura.example','string','push'),
  ('default_locale','fr','string','general');

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

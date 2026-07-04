-- Création de la base de données
CREATE DATABASE IF NOT EXISTS taskflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE taskflow;

-- Table des utilisateurs (avec profil social : bio + avatar + role)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  bio VARCHAR(500) NULL,
  avatar VARCHAR(255) NULL,
  role ENUM('user', 'admin') DEFAULT 'user',
  active_modules JSON NULL,
  profile_type VARCHAR(50) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des organisations (tenants)
CREATE TABLE IF NOT EXISTS tenants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  plan ENUM('free', 'pro', 'enterprise') DEFAULT 'free',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Membres des organisations (tenant_members)
CREATE TABLE IF NOT EXISTS tenant_members (
  tenant_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner', 'admin', 'member') DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, user_id),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ===== Fonctionnalités sociales =====

-- Suivi entre utilisateurs (follower -> following)
CREATE TABLE IF NOT EXISTS follows (
  follower_id INT NOT NULL,
  following_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (follower_id, following_id),
  FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Journal d'activité (alimente le fil d'actualité)
CREATE TABLE IF NOT EXISTS activities (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(30) NOT NULL,
  task_id INT NULL,
  task_title VARCHAR(200) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- NB : les tables comments et reactions référencent `tasks` ; elles sont donc
-- créées plus bas, APRÈS la table des tâches.

-- Table des tâches
-- Table des espaces de travail
CREATE TABLE IF NOT EXISTS workspaces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  owner_id INT NOT NULL,
  tenant_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Table des membres d'un espace de travail
CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id INT NOT NULL,
  user_id INT NOT NULL,
  role ENUM('owner', 'admin', 'member') DEFAULT 'member',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (workspace_id, user_id),
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status ENUM('a_faire', 'en_cours', 'terminee') DEFAULT 'a_faire',
  priority ENUM('basse', 'moyenne', 'haute') DEFAULT 'moyenne',
  tag VARCHAR(40) NULL,
  due_date DATE NULL,
  recurrence VARCHAR(10) NULL,
  workspace_id INT NULL,
  tenant_id INT NULL,
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at DATETIME NULL,
  time_spent INT NOT NULL DEFAULT 0,
  timer_start DATETIME NULL,
  due_reminded_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Commentaires sur les tâches (référence `tasks`, donc déclaré après)
CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  body VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Réactions (emoji) sur les tâches (référence `tasks`, donc déclaré après)
CREATE TABLE IF NOT EXISTS reactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  emoji VARCHAR(8) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_reaction (task_id, user_id, emoji),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des refresh tokens : on ne stocke qu'un hash SHA-256 du jeton (jamais
-- le jeton en clair), avec une date d'expiration. Permet la révocation
-- (déconnexion) et la rotation à chaque rafraîchissement.
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_refresh_token_hash (token_hash),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des partages : une tâche peut être partagée (en lecture) avec d'autres
-- utilisateurs, identifiés par leur compte. Unicité (tâche, destinataire).
CREATE TABLE IF NOT EXISTS task_shares (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_task_share (task_id, user_id),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des pièces jointes : on stocke les métadonnées en base et le fichier
-- physique sur disque (dossier uploads/, servi uniquement via une route authentifiée).
CREATE TABLE IF NOT EXISTS attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime VARCHAR(120),
  size INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Étiquettes multiples : une tâche peut porter plusieurs étiquettes (en plus du
-- champ `tag` unique historique, conservé). Unicité (tâche, étiquette).
CREATE TABLE IF NOT EXISTS task_labels (
  task_id INT NOT NULL,
  label VARCHAR(40) NOT NULL,
  PRIMARY KEY (task_id, label),
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

CREATE INDEX idx_task_labels_label ON task_labels(label);

-- Vues enregistrées : combinaisons de filtres/tri sauvegardées par l'utilisateur.
CREATE TABLE IF NOT EXISTS saved_views (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(80) NOT NULL,
  filters JSON NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_saved_views_user ON saved_views(user_id);

-- Table des sous-tâches (checklist rattachée à une tâche)
CREATE TABLE IF NOT EXISTS subtasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  done TINYINT(1) NOT NULL DEFAULT 0,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Table des audits des tâches
CREATE TABLE IF NOT EXISTS task_audit (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  details TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  message VARCHAR(500) NOT NULL,
  type VARCHAR(30) NOT NULL,
  read_status TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_tasks_user ON tasks(user_id);
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status, is_archived);
CREATE INDEX idx_tasks_user_archived ON tasks(user_id, is_archived);
CREATE INDEX idx_tasks_title ON tasks(title);
CREATE INDEX idx_subtasks_task ON subtasks(task_id);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX idx_attachments_task ON attachments(task_id);
CREATE INDEX idx_task_shares_user ON task_shares(user_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_activities_user ON activities(user_id, created_at);
CREATE INDEX idx_comments_task ON comments(task_id);
CREATE INDEX idx_reactions_task ON reactions(task_id);
CREATE INDEX idx_task_audit_task ON task_audit(task_id);
CREATE INDEX idx_task_audit_user ON task_audit(user_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);

-- Index FULLTEXT : recherche plein texte réellement indexée (MATCH ... AGAINST),
-- bien plus rapide que LIKE '%mot%' qui force un balayage complet de la table.
CREATE FULLTEXT INDEX idx_tasks_fulltext ON tasks(title, description);

CREATE INDEX idx_tasks_workspace ON tasks(workspace_id);
CREATE INDEX idx_workspace_members_user ON workspace_members(user_id);

-- Migration pour une base déjà existante :
-- ALTER TABLE tasks ADD COLUMN tag VARCHAR(40) NULL AFTER priority;
-- ALTER TABLE tasks ADD COLUMN workspace_id INT NULL AFTER due_date;
-- ALTER TABLE tasks ADD CONSTRAINT fk_tasks_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
-- CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
-- CREATE FULLTEXT INDEX idx_tasks_fulltext ON tasks(title, description);
-- CREATE TABLE subtasks ( ... voir ci-dessus ... );
-- CREATE INDEX idx_subtasks_task ON subtasks(task_id);

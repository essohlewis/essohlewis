-- Création de la base de données
CREATE DATABASE IF NOT EXISTS taskflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE taskflow;

-- Table des utilisateurs (avec profil social : bio + avatar)
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  bio VARCHAR(500) NULL,
  avatar VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

-- Commentaires sur les tâches
CREATE TABLE IF NOT EXISTS comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  user_id INT NOT NULL,
  body VARCHAR(1000) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Réactions (emoji) sur les tâches
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

-- Table des tâches
CREATE TABLE IF NOT EXISTS tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status ENUM('a_faire', 'en_cours', 'terminee') DEFAULT 'a_faire',
  priority ENUM('basse', 'moyenne', 'haute') DEFAULT 'moyenne',
  tag VARCHAR(40) NULL,
  due_date DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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

CREATE INDEX idx_tasks_user ON tasks(user_id);
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_title ON tasks(title);
CREATE INDEX idx_subtasks_task ON subtasks(task_id);
CREATE INDEX idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX idx_attachments_task ON attachments(task_id);
CREATE INDEX idx_task_shares_user ON task_shares(user_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_activities_user ON activities(user_id, created_at);
CREATE INDEX idx_comments_task ON comments(task_id);
CREATE INDEX idx_reactions_task ON reactions(task_id);

-- Index FULLTEXT : recherche plein texte réellement indexée (MATCH ... AGAINST),
-- bien plus rapide que LIKE '%mot%' qui force un balayage complet de la table.
CREATE FULLTEXT INDEX idx_tasks_fulltext ON tasks(title, description);

-- Migration pour une base déjà existante :
-- ALTER TABLE tasks ADD COLUMN tag VARCHAR(40) NULL AFTER priority;
-- CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
-- CREATE FULLTEXT INDEX idx_tasks_fulltext ON tasks(title, description);
-- CREATE TABLE subtasks ( ... voir ci-dessus ... );
-- CREATE INDEX idx_subtasks_task ON subtasks(task_id);

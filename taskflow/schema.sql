-- Création de la base de données
CREATE DATABASE IF NOT EXISTS taskflow CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE taskflow;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

CREATE INDEX idx_tasks_user ON tasks(user_id);
CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
CREATE INDEX idx_tasks_title ON tasks(title);

-- Index FULLTEXT : recherche plein texte réellement indexée (MATCH ... AGAINST),
-- bien plus rapide que LIKE '%mot%' qui force un balayage complet de la table.
CREATE FULLTEXT INDEX idx_tasks_fulltext ON tasks(title, description);

-- Migration pour une base déjà existante :
-- ALTER TABLE tasks ADD COLUMN tag VARCHAR(40) NULL AFTER priority;
-- CREATE INDEX idx_tasks_user_status ON tasks(user_id, status);
-- CREATE FULLTEXT INDEX idx_tasks_fulltext ON tasks(title, description);

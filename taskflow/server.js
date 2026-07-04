const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const workspaceRoutes = require('./routes/workspaceRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const tenantRoutes = require('./routes/tenantRoutes');
const aiRoutes = require('./routes/aiRoutes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const { identifyTenant } = require('./middleware/tenant');

const app = express();

// Sécurité : en-têtes HTTP protecteurs (CSP désactivée ici pour ne pas
// bloquer les polices Google Fonts et le JS inline du frontend statique).
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());

// Compression gzip des réponses : réduit fortement la taille des payloads JSON
// et des fichiers statiques envoyés au navigateur (moins de bande passante,
// chargement plus rapide), pour un coût CPU négligeable.
app.use(compression());

app.use(express.json({ limit: '100kb' }));

// Limite générale de requêtes par IP, pour absorber les abus
app.use('/api', apiLimiter);
app.use('/api', identifyTenant);

// Sert les fichiers du frontend (HTML/CSS/JS) depuis /public
app.use(express.static(path.join(__dirname, 'public')));

// Routes API
// Avatar servi publiquement (image peu sensible, permet <img src=...>),
// déclaré avant le routeur /api/users qui exige une authentification.
const { getAvatar } = require('./controllers/userController');
app.get('/api/users/:id/avatar', getAvatar);

app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/ai', aiRoutes);

// Route de vérification rapide
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 pour toute route API inconnue
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Route inconnue.' });
});

// Doit être déclaré en dernier : capte toutes les erreurs transmises par next(err)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// N'écoute pas automatiquement pendant les tests (supertest gère ça lui-même)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
  });
}

// Migration auto-exécutée au démarrage
(async () => {
  try {
    const pool = require('./config/db');
    const [bioColumns] = await pool.query("SHOW COLUMNS FROM users LIKE 'bio'");
    if (bioColumns.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN bio VARCHAR(500) NULL");
    }

    const [avatarColumns] = await pool.query("SHOW COLUMNS FROM users LIKE 'avatar'");
    if (avatarColumns.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN avatar VARCHAR(255) NULL");
    }

    const [activeModulesColumns] = await pool.query("SHOW COLUMNS FROM users LIKE 'active_modules'");
    if (activeModulesColumns.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN active_modules JSON NULL");
    }

    const [profileTypeColumns] = await pool.query("SHOW COLUMNS FROM users LIKE 'profile_type'");
    if (profileTypeColumns.length === 0) {
      await pool.query("ALTER TABLE users ADD COLUMN profile_type VARCHAR(50) NULL");
    }

    const [tagColumns] = await pool.query("SHOW COLUMNS FROM tasks LIKE 'tag'");
    if (tagColumns.length > 0 && tagColumns[0].Null === 'NO') {
      await pool.query("ALTER TABLE tasks MODIFY COLUMN tag VARCHAR(40) NULL");
    }

    // Migration pour soft-delete / archivage
    const [isArchivedColumns] = await pool.query("SHOW COLUMNS FROM tasks LIKE 'is_archived'");
    if (isArchivedColumns.length === 0) {
      console.log("ℹ️ La colonne 'is_archived' est manquante dans 'tasks'. Ajout en cours...");
      await pool.query("ALTER TABLE tasks ADD COLUMN is_archived BOOLEAN DEFAULT FALSE");
    }

    const [archivedAtColumns] = await pool.query("SHOW COLUMNS FROM tasks LIKE 'archived_at'");
    if (archivedAtColumns.length === 0) {
      console.log("ℹ️ La colonne 'archived_at' est manquante dans 'tasks'. Ajout en cours...");
      await pool.query("ALTER TABLE tasks ADD COLUMN archived_at DATETIME NULL");
    }

    try {
      await pool.query("CREATE INDEX idx_tasks_user_status_active ON tasks(user_id, status, is_archived)");
    } catch (e) { /* index existant */ }

    try {
      await pool.query("CREATE INDEX idx_tasks_user_archived ON tasks(user_id, is_archived)");
    } catch (e) { /* index existant */ }

    console.log('⏳ Exécution automatique des migrations de base de données...');

    // 0. Créer la table tenants et tenant_members
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        plan ENUM('free', 'pro', 'enterprise') DEFAULT 'free',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS tenant_members (
        tenant_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('owner', 'admin', 'member') DEFAULT 'member',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (tenant_id, user_id),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 1. Créer la table workspaces
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        owner_id INT NOT NULL,
        tenant_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
      )
    `);

    // 1.1 Ajouter la colonne tenant_id dans workspaces si manquante
    const [wsTenantColumns] = await pool.query("SHOW COLUMNS FROM workspaces LIKE 'tenant_id'");
    if (wsTenantColumns.length === 0) {
      console.log("ℹ️ La colonne 'tenant_id' est manquante dans 'workspaces'. Ajout en cours...");
      await pool.query("ALTER TABLE workspaces ADD COLUMN tenant_id INT NULL");
      await pool.query("ALTER TABLE workspaces ADD CONSTRAINT fk_workspaces_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE");
      console.log("✅ Migration réussie : colonne 'tenant_id' ajoutée à 'workspaces'.");
    }

    // 2. Créer la table workspace_members
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workspace_members (
        workspace_id INT NOT NULL,
        user_id INT NOT NULL,
        role ENUM('owner', 'admin', 'member') DEFAULT 'member',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (workspace_id, user_id),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 3. Ajouter les index
    try {
      await pool.query("CREATE INDEX idx_workspace_members_user ON workspace_members(user_id)");
    } catch (e) { /* index existant */ }

    // 4. Ajouter la colonne workspace_id dans tasks
    const [columns] = await pool.query("SHOW COLUMNS FROM tasks LIKE 'workspace_id'");
    if (columns.length === 0) {
      console.log("ℹ️ La colonne 'workspace_id' est manquante dans 'tasks'. Ajout en cours...");
      await pool.query("ALTER TABLE tasks ADD COLUMN workspace_id INT NULL");
      await pool.query("ALTER TABLE tasks ADD CONSTRAINT fk_tasks_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE");
      console.log("✅ Migration réussie : colonne 'workspace_id' ajoutée.");
    } else {
      console.log("✅ La structure de base de données est à jour (workspaces).");
    }

    // 4.1 Ajouter la colonne tenant_id dans tasks si manquante
    const [tasksTenantColumns] = await pool.query("SHOW COLUMNS FROM tasks LIKE 'tenant_id'");
    if (tasksTenantColumns.length === 0) {
      console.log("ℹ️ La colonne 'tenant_id' est manquante dans 'tasks'. Ajout en cours...");
      await pool.query("ALTER TABLE tasks ADD COLUMN tenant_id INT NULL");
      await pool.query("ALTER TABLE tasks ADD CONSTRAINT fk_tasks_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE");
      console.log("✅ Migration réussie : colonne 'tenant_id' ajoutée à 'tasks'.");
    }

    try {
      await pool.query("CREATE INDEX idx_tasks_workspace ON tasks(workspace_id)");
    } catch (e) { /* index existant */ }

    try {
      await pool.query("CREATE INDEX idx_tasks_tenant ON tasks(tenant_id)");
    } catch (e) { /* index existant */ }

    try {
      await pool.query("CREATE INDEX idx_workspaces_tenant ON workspaces(tenant_id)");
    } catch (e) { /* index existant */ }
  } catch (err) {
    console.error('❌ Échec des migrations automatiques :', err.message);
  }
})();

module.exports = app;

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./swagger.config');
const logger = require('./utils/logger');
const { initCache } = require('./utils/cache');

const authRoutes = require('./routes/authRoutes');
const taskRoutes = require('./routes/taskRoutes');
const userRoutes = require('./routes/userRoutes');
const workspaceRoutes = require('./routes/workspaceRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

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

// Route de vérification rapide
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Documentation Swagger/OpenAPI
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'TaskFlow API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
    filter: true,
    docExpansion: 'list'
  }
}));

logger.info('Swagger documentation available at http://localhost:3000/api/docs');

// 404 pour toute route API inconnue
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Route inconnue.' });
});

// Doit être déclaré en dernier : capte toutes les erreurs transmises par next(err)
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

// N'écoute pas automatiquement pendant les tests (supertest gère ça lui-même)
if (require.main === module) {
  initCache().catch(err => logger.error('Cache initialization failed: %s', err.message));

  app.listen(PORT, () => {
    logger.info(`Serveur lancé sur http://localhost:${PORT}`);
  });
}

// Migration auto-exécutée au démarrage
(async () => {
  try {
    const pool = require('./config/db');
    logger.info('Exécution des migrations de base de données...');

    // 1. Créer la table workspaces
    await pool.query(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        owner_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

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
      await pool.query("CREATE INDEX idx_tasks_workspace ON tasks(workspace_id)");
    } catch (e) { /* index existant */ }

    try {
      await pool.query("CREATE INDEX idx_workspace_members_user ON workspace_members(user_id)");
    } catch (e) { /* index existant */ }

    // 4. Ajouter la colonne workspace_id dans tasks
    const [columns] = await pool.query("SHOW COLUMNS FROM tasks LIKE 'workspace_id'");
    if (columns.length === 0) {
      logger.info('Migration: colonne workspace_id manquante, ajout en cours...');
      await pool.query("ALTER TABLE tasks ADD COLUMN workspace_id INT NULL");
      await pool.query("ALTER TABLE tasks ADD CONSTRAINT fk_tasks_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE");
      logger.info('Migration réussie: colonne workspace_id ajoutée');
    } else {
      logger.info('Structure de base de données à jour (workspaces)');
    }
  } catch (err) {
    logger.error('Migrations automatiques échouées: %s', err.message);
  }
})();

module.exports = app;

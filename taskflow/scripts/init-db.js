// Initialise la base de données à partir de schema.sql, en utilisant les
// identifiants du fichier .env — sans dépendre du client en ligne de commande
// `mysql` (souvent absent ou mal configuré selon les machines).
//
// Usage : npm run db:init
//
// Le script se connecte SANS sélectionner de base (pour pouvoir exécuter le
// CREATE DATABASE), puis rejoue l'intégralité de schema.sql. Les instructions
// sont idempotentes (IF NOT EXISTS) : on peut le relancer sans risque.

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER;

function hint(err) {
  switch (err.code) {
    case 'ER_ACCESS_DENIED_ERROR':
      return `Identifiants refusés : vérifie DB_USER / DB_PASSWORD dans .env (teste : mysql -u ${DB_USER || '<user>'} -p).`;
    case 'ECONNREFUSED':
      return `Aucun serveur MySQL sur ${DB_HOST}:${DB_PORT} : MySQL est-il démarré ? DB_HOST / DB_PORT corrects ?`;
    case 'ENOTFOUND':
      return `Hôte introuvable : "${DB_HOST}" (DB_HOST) est-il correct ?`;
    default:
      return 'Vérifie la configuration DB_* de ton fichier .env.';
  }
}

async function main() {
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  if (!fs.existsSync(schemaPath)) {
    console.error(`❌ Fichier introuvable : ${schemaPath}`);
    process.exit(1);
  }
  const schema = fs.readFileSync(schemaPath, 'utf8');

  console.log(`⏳ Initialisation de la base sur ${DB_USER}@${DB_HOST}:${DB_PORT} …`);

  let connection;
  try {
    // Pas de `database` ici : schema.sql contient le CREATE DATABASE / USE.
    // multipleStatements permet d'exécuter tout le fichier d'un coup.
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true
    });

    // Découpage du schéma en requêtes individuelles pour pouvoir attraper
    // les erreurs de doublons d'index ou de colonnes sans bloquer le reste.
    const queries = schema
      .split(/;[ \t]*[\r\n]+/g)
      .map((q) => q.trim())
      .filter((q) => q.length > 0 && !q.startsWith('--'));

    for (const query of queries) {
      try {
        await connection.query(query);
      } catch (qErr) {
        // Ignorer l'erreur d'index déjà existant (ER_DUP_KEYNAME)
        // ou de colonne déjà existante (ER_DUP_FIELDNAME).
        if (qErr.code === 'ER_DUP_KEYNAME' || qErr.code === 'ER_DUP_FIELDNAME') {
          continue;
        }
        throw qErr;
      }
    }

    // Vérification et migration de la colonne 'role' dans 'users'
    try {
      const [bioColumns] = await connection.query("SHOW COLUMNS FROM users LIKE 'bio'");
      if (bioColumns.length === 0) {
        console.log("â„¹ï¸ La colonne 'bio' est manquante dans 'users'. Ajout en cours...");
        await connection.query("ALTER TABLE users ADD COLUMN bio VARCHAR(500) NULL");
        console.log("âœ… Colonne 'bio' ajoutÃ©e avec succÃ¨s.");
      }

      const [avatarColumns] = await connection.query("SHOW COLUMNS FROM users LIKE 'avatar'");
      if (avatarColumns.length === 0) {
        console.log("â„¹ï¸ La colonne 'avatar' est manquante dans 'users'. Ajout en cours...");
        await connection.query("ALTER TABLE users ADD COLUMN avatar VARCHAR(255) NULL");
        console.log("âœ… Colonne 'avatar' ajoutÃ©e avec succÃ¨s.");
      }
    } catch (migErr) {
      console.warn("âš ï¸ Attention : Ã©chec de la migration des colonnes de profil :", migErr.message);
    }

    try {
      const [columns] = await connection.query("SHOW COLUMNS FROM users LIKE 'role'");
      if (columns.length === 0) {
        console.log("ℹ️ La colonne 'role' est manquante dans 'users'. Ajout en cours...");
        await connection.query("ALTER TABLE users ADD COLUMN role ENUM('user', 'admin') DEFAULT 'user'");
        console.log("✅ Colonne 'role' ajoutée avec succès.");
      }
    } catch (migErr) {
      console.warn("⚠️ Attention : échec de la migration de la colonne 'role' :", migErr.message);
    }

    // Vérification et migration de la colonne 'workspace_id' dans 'tasks'
    try {
      const [tagColumns] = await connection.query("SHOW COLUMNS FROM tasks LIKE 'tag'");
      if (tagColumns.length > 0 && tagColumns[0].Null === 'NO') {
        console.log("â„¹ï¸ La colonne 'tag' est obligatoire dans 'tasks'. Passage en nullable...");
        await connection.query("ALTER TABLE tasks MODIFY COLUMN tag VARCHAR(40) NULL");
        console.log("âœ… Colonne 'tag' rendue nullable avec succÃ¨s.");
      }
    } catch (migErr) {
      console.warn("âš ï¸ Attention : Ã©chec de la migration de la colonne 'tag' :", migErr.message);
    }

    try {
      const [columns] = await connection.query("SHOW COLUMNS FROM tasks LIKE 'workspace_id'");
      if (columns.length === 0) {
        console.log("ℹ️ La colonne 'workspace_id' est manquante dans 'tasks'. Ajout en cours...");
        await connection.query("ALTER TABLE tasks ADD COLUMN workspace_id INT NULL");
        await connection.query("ALTER TABLE tasks ADD CONSTRAINT fk_tasks_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE");
        console.log("✅ Colonne 'workspace_id' et contrainte étrangère ajoutées avec succès.");
      }
    } catch (migErr) {
      console.warn("⚠️ Attention : échec de la migration de la colonne 'workspace_id' :", migErr.message);
    }

    // Migration pour soft-delete / archivage
    try {
      const [isArchivedColumns] = await connection.query("SHOW COLUMNS FROM tasks LIKE 'is_archived'");
      if (isArchivedColumns.length === 0) {
        console.log("ℹ️ La colonne 'is_archived' est manquante dans 'tasks'. Ajout en cours...");
        await connection.query("ALTER TABLE tasks ADD COLUMN is_archived BOOLEAN DEFAULT FALSE");
        console.log("✅ Colonne 'is_archived' ajoutée avec succès.");
      }
    } catch (migErr) {
      console.warn("⚠️ Attention : échec de la migration de la colonne 'is_archived' :", migErr.message);
    }

    try {
      const [archivedAtColumns] = await connection.query("SHOW COLUMNS FROM tasks LIKE 'archived_at'");
      if (archivedAtColumns.length === 0) {
        console.log("ℹ️ La colonne 'archived_at' est manquante dans 'tasks'. Ajout en cours...");
        await connection.query("ALTER TABLE tasks ADD COLUMN archived_at DATETIME NULL");
        console.log("✅ Colonne 'archived_at' ajoutée avec succès.");
      }
    } catch (migErr) {
      console.warn("⚠️ Attention : échec de la migration de la colonne 'archived_at' :", migErr.message);
    }

    // Suivi du temps (minuteur) : colonnes time_spent / timer_start
    try {
      const [timeSpentColumns] = await connection.query("SHOW COLUMNS FROM tasks LIKE 'time_spent'");
      if (timeSpentColumns.length === 0) {
        console.log("ℹ️ La colonne 'time_spent' est manquante dans 'tasks'. Ajout en cours...");
        await connection.query("ALTER TABLE tasks ADD COLUMN time_spent INT NOT NULL DEFAULT 0");
        console.log("✅ Colonne 'time_spent' ajoutée avec succès.");
      }
      const [timerStartColumns] = await connection.query("SHOW COLUMNS FROM tasks LIKE 'timer_start'");
      if (timerStartColumns.length === 0) {
        console.log("ℹ️ La colonne 'timer_start' est manquante dans 'tasks'. Ajout en cours...");
        await connection.query("ALTER TABLE tasks ADD COLUMN timer_start DATETIME NULL");
        console.log("✅ Colonne 'timer_start' ajoutée avec succès.");
      }
    } catch (migErr) {
      console.warn("⚠️ Attention : échec de la migration des colonnes de suivi du temps :", migErr.message);
    }

    // Tâches récurrentes : colonne recurrence
    try {
      const [recurrenceColumns] = await connection.query("SHOW COLUMNS FROM tasks LIKE 'recurrence'");
      if (recurrenceColumns.length === 0) {
        console.log("ℹ️ La colonne 'recurrence' est manquante dans 'tasks'. Ajout en cours...");
        await connection.query("ALTER TABLE tasks ADD COLUMN recurrence VARCHAR(10) NULL");
        console.log("✅ Colonne 'recurrence' ajoutée avec succès.");
      }
    } catch (migErr) {
      console.warn("⚠️ Attention : échec de la migration de la colonne 'recurrence' :", migErr.message);
    }

    // Rappels d'échéance automatiques : colonne due_reminded_at (anti-doublon)
    try {
      const [dueRemindedColumns] = await connection.query("SHOW COLUMNS FROM tasks LIKE 'due_reminded_at'");
      if (dueRemindedColumns.length === 0) {
        console.log("ℹ️ La colonne 'due_reminded_at' est manquante dans 'tasks'. Ajout en cours...");
        await connection.query("ALTER TABLE tasks ADD COLUMN due_reminded_at DATETIME NULL");
        console.log("✅ Colonne 'due_reminded_at' ajoutée avec succès.");
      }
    } catch (migErr) {
      console.warn("⚠️ Attention : échec de la migration de la colonne 'due_reminded_at' :", migErr.message);
    }

    try {
      const [wsTenantColumns] = await connection.query("SHOW COLUMNS FROM workspaces LIKE 'tenant_id'");
      if (wsTenantColumns.length === 0) {
        console.log("ℹ️ La colonne 'tenant_id' est manquante dans 'workspaces'. Ajout en cours...");
        await connection.query("ALTER TABLE workspaces ADD COLUMN tenant_id INT NULL");
        await connection.query("ALTER TABLE workspaces ADD CONSTRAINT fk_workspaces_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE");
        console.log("✅ Colonne 'tenant_id' ajoutée à 'workspaces' avec succès.");
      }
    } catch (migErr) {
      console.warn("⚠️ Attention : échec de la migration de 'tenant_id' dans 'workspaces' :", migErr.message);
    }

    try {
      const [tasksTenantColumns] = await connection.query("SHOW COLUMNS FROM tasks LIKE 'tenant_id'");
      if (tasksTenantColumns.length === 0) {
        console.log("ℹ️ La colonne 'tenant_id' est manquante dans 'tasks'. Ajout en cours...");
        await connection.query("ALTER TABLE tasks ADD COLUMN tenant_id INT NULL");
        await connection.query("ALTER TABLE tasks ADD CONSTRAINT fk_tasks_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE");
        console.log("✅ Colonne 'tenant_id' ajoutée à 'tasks' avec succès.");
      }
    } catch (migErr) {
      console.warn("⚠️ Attention : échec de la migration de 'tenant_id' dans 'tasks' :", migErr.message);
    }

    try {
      await connection.query("CREATE INDEX idx_tasks_user_status_active ON tasks(user_id, status, is_archived)");
    } catch (e) { /* index existant */ }

    try {
      await connection.query("CREATE INDEX idx_tasks_user_archived ON tasks(user_id, is_archived)");
    } catch (e) { /* index existant */ }

    try {
      await connection.query("CREATE INDEX idx_tasks_tenant ON tasks(tenant_id)");
    } catch (e) { /* index existant */ }

    try {
      await connection.query("CREATE INDEX idx_workspaces_tenant ON workspaces(tenant_id)");
    } catch (e) { /* index existant */ }

    console.log('✅ Base initialisée avec succès (tables et index créés).');
    console.log('   Tu peux maintenant lancer : npm start');
  } catch (err) {
    console.error('❌ Échec de l\'initialisation de la base.');
    console.error(`   Erreur : [${err.code || 'INCONNU'}] ${err.message}`);
    console.error(`   → ${hint(err)}`);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

main();

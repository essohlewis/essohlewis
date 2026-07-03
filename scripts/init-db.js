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

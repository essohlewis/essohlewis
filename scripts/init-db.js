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

    await connection.query(schema);
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

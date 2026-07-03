const mysql = require('mysql2/promise');
require('dotenv').config();

const DB_HOST = process.env.DB_HOST;
const DB_PORT = process.env.DB_PORT || 3306;
const DB_USER = process.env.DB_USER;
const DB_NAME = process.env.DB_NAME;

// Pool de connexions : plus performant qu'une connexion unique
// car il réutilise les connexions au lieu d'en ouvrir une nouvelle à chaque requête.
const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: process.env.DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  // Taille du pool ajustable sans toucher au code (utile pour monter en charge).
  connectionLimit: Number(process.env.DB_POOL_LIMIT) || 10,
  queueLimit: 0,
  // Maintient les connexions inactives en vie : évite les reconnexions coûteuses
  // et les erreurs "connection lost" quand le trafic est irrégulier.
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// Traduit les erreurs de connexion MySQL les plus courantes en conseils concrets,
// pour ne pas laisser l'utilisateur deviner ce qui cloche.
function connectionHint(err) {
  switch (err.code) {
    case 'ER_ACCESS_DENIED_ERROR':
      return "Identifiants refusés : vérifie DB_USER / DB_PASSWORD dans .env "
        + `(teste-les avec : mysql -u ${DB_USER || '<user>'} -p).`;
    case 'ER_BAD_DB_ERROR':
      return `La base "${DB_NAME}" n'existe pas : crée-la puis importe le schéma `
        + '(mysql -u <user> -p < schema.sql).';
    case 'ECONNREFUSED':
      return `Aucun serveur MySQL n'écoute sur ${DB_HOST}:${DB_PORT} : `
        + 'MySQL est-il démarré ? DB_HOST / DB_PORT sont-ils corrects ?';
    case 'ENOTFOUND':
      return `Hôte introuvable : "${DB_HOST}" (DB_HOST) est-il correct ?`;
    default:
      return 'Vérifie la configuration DB_* de ton fichier .env.';
  }
}

// Petit test de connexion au démarrage, utile pour détecter vite un problème de config.
pool.getConnection()
  .then((conn) => {
    console.log(`✅ Connexion à MySQL réussie (${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME})`);
    conn.release();
  })
  .catch((err) => {
    console.error('❌ Impossible de se connecter à MySQL.');
    console.error(`   Cible : ${DB_USER || '<DB_USER manquant>'}@${DB_HOST || '<DB_HOST manquant>'}:${DB_PORT}/${DB_NAME || '<DB_NAME manquant>'}`);
    console.error(`   Erreur : [${err.code || 'INCONNU'}] ${err.message}`);
    console.error(`   → ${connectionHint(err)}`);
  });

module.exports = pool;

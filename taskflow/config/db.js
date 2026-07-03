const mysql = require('mysql2/promise');
require('dotenv').config();

// Pool de connexions : plus performant qu'une connexion unique
// car il réutilise les connexions au lieu d'en ouvrir une nouvelle à chaque requête.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  // Taille du pool ajustable sans toucher au code (utile pour monter en charge).
  connectionLimit: Number(process.env.DB_POOL_LIMIT) || 10,
  queueLimit: 0,
  // Maintient les connexions inactives en vie : évite les reconnexions coûteuses
  // et les erreurs "connection lost" quand le trafic est irrégulier.
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000
});

// Petit test de connexion au démarrage, utile pour détecter vite un problème de config
pool.getConnection()
  .then((conn) => {
    console.log('✅ Connexion à MySQL réussie');
    conn.release();
  })
  .catch((err) => {
    console.error('❌ Impossible de se connecter à MySQL :', err.message);
  });

module.exports = pool;

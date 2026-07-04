const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.PGHOST || process.env.DB_HOST || 'localhost',
  port: process.env.PGPORT || 5432,
  user: process.env.PGUSER || process.env.DB_USER || 'postgres',
  password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
  database: process.env.PGDATABASE || process.env.DB_NAME || 'taskflow',
  max: Number(process.env.DB_POOL_LIMIT) || 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
  console.log('✅ Connexion à PostgreSQL établie avec succès.');
});

pool.on('error', (err) => {
  console.error('❌ Erreur inattendue sur le client PostgreSQL :', err.message);
});

module.exports = pool;

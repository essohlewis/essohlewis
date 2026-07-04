const { createClient } = require('redis');
const logger = require('./logger');

let client;

// Initialiser la connexion Redis
const initRedis = async () => {
  try {
    client = createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined,
      retryStrategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          logger.warn('Redis non disponible - cache désactivé');
          return;
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Redis retry time exhausted');
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    client.on('error', (err) => logger.error('Redis erreur:', err));
    client.on('connect', () => logger.info('Redis connecté'));

    await client.connect();
    return true;
  } catch (err) {
    logger.warn('Impossible de se connecter à Redis:', err.message);
    return false;
  }
};

// Récupérer une clé
const get = async (key) => {
  if (!client) return null;
  try {
    return await client.get(key);
  } catch (err) {
    logger.error(`Erreur Redis GET ${key}:`, err);
    return null;
  }
};

// Définir une clé
const set = async (key, value, ttl = 3600) => {
  if (!client) return false;
  try {
    await client.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (err) {
    logger.error(`Erreur Redis SET ${key}:`, err);
    return false;
  }
};

// Supprimer une clé
const del = async (key) => {
  if (!client) return false;
  try {
    await client.del(key);
    return true;
  } catch (err) {
    logger.error(`Erreur Redis DEL ${key}:`, err);
    return false;
  }
};

// Supprimer plusieurs clés par pattern
const delPattern = async (pattern) => {
  if (!client) return false;
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
    return true;
  } catch (err) {
    logger.error(`Erreur Redis DEL pattern ${pattern}:`, err);
    return false;
  }
};

// Effacer le cache
const flush = async () => {
  if (!client) return false;
  try {
    await client.flushDb();
    return true;
  } catch (err) {
    logger.error('Erreur Redis FLUSH:', err);
    return false;
  }
};

module.exports = {
  initRedis,
  get,
  set,
  del,
  delPattern,
  flush
};

const redis = require('redis');
const logger = require('./logger');

let client = null;
let connected = false;

const initCache = async () => {
  try {
    if (!process.env.REDIS_HOST) {
      logger.info('Redis disabled (REDIS_HOST not set)');
      return;
    }

    client = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD || undefined
    });

    client.on('error', (err) => {
      logger.warn('Redis connection error: %s', err.message);
      connected = false;
    });

    client.on('connect', () => {
      logger.info('Redis connected successfully');
      connected = true;
    });

    await client.connect();
  } catch (err) {
    logger.warn('Redis initialization error: %s', err.message);
    connected = false;
  }
};

const get = async (key) => {
  if (!connected || !client) return null;
  try {
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (err) {
    logger.warn('Cache get error for key %s: %s', key, err.message);
    return null;
  }
};

const set = async (key, value, ttl = 300) => {
  if (!connected || !client) return false;
  try {
    await client.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (err) {
    logger.warn('Cache set error for key %s: %s', key, err.message);
    return false;
  }
};

const del = async (key) => {
  if (!connected || !client) return false;
  try {
    await client.del(key);
    return true;
  } catch (err) {
    logger.warn('Cache del error for key %s: %s', key, err.message);
    return false;
  }
};

const deletePattern = async (pattern) => {
  if (!connected || !client) return false;
  try {
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
    return true;
  } catch (err) {
    logger.warn('Cache delete pattern error for %s: %s', pattern, err.message);
    return false;
  }
};

const flush = async () => {
  if (!connected || !client) return false;
  try {
    await client.flushDb();
    return true;
  } catch (err) {
    logger.warn('Cache flush error: %s', err.message);
    return false;
  }
};

module.exports = {
  initCache,
  get,
  set,
  del,
  deletePattern,
  flush,
  isConnected: () => connected
};

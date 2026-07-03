const cache = require('../utils/cache');
const logger = require('../utils/logger');

// Middleware pour cacher les réponses GET
const cacheMiddleware = (ttl = 300) => {
  return async (req, res, next) => {
    // Ne cache que les requêtes GET
    if (req.method !== 'GET') {
      return next();
    }

    // Ne cache pas les requêtes sans authentification (sauf cas spécialisés)
    if (!req.user && !req.path.includes('/users') && !req.path.includes('/avatar')) {
      return next();
    }

    // Construire une clé unique de cache incluant l'utilisateur et les paramètres
    const cacheKey = buildCacheKey(req);
    
    // Essayer de récupérer du cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      res.set('X-Cache', 'HIT');
      logger.info(`Cache HIT: ${cacheKey}`);
      return res.json(cached);
    }

    // Override res.json pour intercepter la réponse et la cacher
    const originalJson = res.json.bind(res);
    res.json = function(data) {
      if (res.statusCode === 200) {
        cache.set(cacheKey, data, ttl).catch(err => 
          logger.warn(`Failed to cache ${cacheKey}: ${err.message}`)
        );
      }
      res.set('X-Cache', 'MISS');
      logger.info(`Cache MISS: ${cacheKey}`);
      return originalJson(data);
    };

    next();
  };
};

// Construire une clé unique de cache
function buildCacheKey(req) {
  const userId = req.user?.id || 'anonymous';
  const queryString = new URLSearchParams(req.query).toString();
  const path = req.path;
  
  if (queryString) {
    return `${path}:${userId}:${queryString}`;
  }
  return `${path}:${userId}`;
}

// Invalider le cache pour un pattern
const invalidateCache = async (pattern) => {
  logger.info(`Invalidating cache pattern: ${pattern}`);
  await cache.deletePattern(pattern);
};

// Invalider le cache utilisateur lors de modifications
const invalidateUserCache = (userId) => {
  invalidateCache(`/api/tasks*:${userId}:*`);
  invalidateCache(`/api/users/${userId}*`);
  invalidateCache(`/api/tasks/stats:${userId}:*`);
};

// Invalider tout le cache
const flushAllCache = async () => {
  logger.info('Flushing all cache');
  await cache.flush();
};

module.exports = {
  cacheMiddleware,
  invalidateCache,
  invalidateUserCache,
  flushAllCache,
  buildCacheKey
};

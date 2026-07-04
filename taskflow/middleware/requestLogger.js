const logger = require('../utils/logger');

// Middleware de logging des requêtes
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // Intercepter la réponse
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel](
      `${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`
    );
    
    return originalJson.call(this, data);
  };

  next();
};

module.exports = requestLogger;

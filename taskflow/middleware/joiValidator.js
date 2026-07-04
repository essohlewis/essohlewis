const logger = require('../utils/logger');

// Middleware de validation avec Joi
const validateWithJoi = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, { 
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));
      
      logger.warn(`Validation error: ${JSON.stringify(details)}`);
      
      return res.status(400).json({ 
        message: 'Erreur de validation',
        errors: details 
      });
    }

    // Remplacer le body par les données validées
    req.body = value;
    next();
  };
};

// Middleware de validation des query params avec Joi
const validateQueryWithJoi = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, { 
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(d => ({
        field: d.path.join('.'),
        message: d.message
      }));
      
      logger.warn(`Query validation error: ${JSON.stringify(details)}`);
      
      return res.status(400).json({ 
        message: 'Erreur de validation des paramètres',
        errors: details 
      });
    }

    // Remplacer la query par les données validées
    req.query = value;
    next();
  };
};

module.exports = {
  validateWithJoi,
  validateQueryWithJoi
};

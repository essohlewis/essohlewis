const Joi = require('joi');

// Schémas de validation avec Joi
const authSchemas = {
  register: Joi.object({
    name: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(50).required()
  }),
  
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  refreshToken: Joi.object({
    refreshToken: Joi.string().required()
  })
};

const taskSchemas = {
  create: Joi.object({
    title: Joi.string().min(3).max(200).required(),
    description: Joi.string().max(2000).allow(''),
    priority: Joi.string().valid('basse', 'moyenne', 'haute').default('moyenne'),
    tag: Joi.string().max(40).allow(''),
    due_date: Joi.date().allow(null)
  }),

  update: Joi.object({
    title: Joi.string().min(3).max(200),
    description: Joi.string().max(2000),
    status: Joi.string().valid('a_faire', 'en_cours', 'terminee'),
    priority: Joi.string().valid('basse', 'moyenne', 'haute'),
    tag: Joi.string().max(40),
    due_date: Joi.date().allow(null)
  }).min(1),

  filter: Joi.object({
    status: Joi.string().valid('a_faire', 'en_cours', 'terminee'),
    priority: Joi.string().valid('basse', 'moyenne', 'haute'),
    tag: Joi.string().max(40),
    search: Joi.string().max(100),
    sort: Joi.string().valid('recent', 'ancien', 'echeance', 'priorite'),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  })
};

module.exports = {
  authSchemas,
  taskSchemas
};

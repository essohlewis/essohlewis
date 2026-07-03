const { body, query, validationResult } = require('express-validator');

// Renvoie une erreur 422 lisible si une règle de validation échoue
function checkValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      message: errors.array()[0].msg,
      errors: errors.array()
    });
  }
  next();
}

const registerRules = [
  body('name').trim().notEmpty().withMessage('Le nom est requis.')
    .isLength({ max: 100 }).withMessage('Le nom est trop long.'),
  body('email').trim().isEmail().withMessage('Email invalide.').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Le mot de passe doit contenir au moins 6 caractères.'),
  checkValidation
];

const loginRules = [
  body('email').trim().isEmail().withMessage('Email invalide.').normalizeEmail(),
  body('password').notEmpty().withMessage('Le mot de passe est requis.'),
  checkValidation
];

const taskRules = [
  body('title').trim().notEmpty().withMessage('Le titre est requis.')
    .isLength({ max: 200 }).withMessage('Le titre est trop long (200 caractères max).'),
  body('description').optional({ nullable: true }).isLength({ max: 2000 }).withMessage('La description est trop longue.'),
  body('status').optional().isIn(['a_faire', 'en_cours', 'terminee']).withMessage('Statut invalide.'),
  body('priority').optional().isIn(['basse', 'moyenne', 'haute']).withMessage('Priorité invalide.'),
  body('tag').optional({ nullable: true }).trim().isLength({ max: 40 }).withMessage('Le tag est trop long (40 caractères max).'),
  body('due_date').optional({ nullable: true }).isISO8601().withMessage('Date invalide (format attendu : AAAA-MM-JJ).'),
  checkValidation
];

const taskUpdateRules = [
  body('title').optional().trim().notEmpty().withMessage('Le titre ne peut pas être vide.')
    .isLength({ max: 200 }).withMessage('Le titre est trop long (200 caractères max).'),
  body('description').optional({ nullable: true }).isLength({ max: 2000 }).withMessage('La description est trop longue.'),
  body('status').optional().isIn(['a_faire', 'en_cours', 'terminee']).withMessage('Statut invalide.'),
  body('priority').optional().isIn(['basse', 'moyenne', 'haute']).withMessage('Priorité invalide.'),
  body('tag').optional({ nullable: true }).trim().isLength({ max: 40 }).withMessage('Le tag est trop long (40 caractères max).'),
  body('due_date').optional({ nullable: true }).isISO8601().withMessage('Date invalide (format attendu : AAAA-MM-JJ).'),
  checkValidation
];

const taskQueryRules = [
  query('status').optional().isIn(['a_faire', 'en_cours', 'terminee']),
  query('priority').optional().isIn(['basse', 'moyenne', 'haute']),
  query('sort').optional().isIn(['recent', 'ancien', 'echeance', 'priorite']),
  query('search').optional().isLength({ max: 200 }),
  checkValidation
];

// Règles pour l'endpoint groupé PATCH /api/tasks/bulk.
// On borne aussi le nombre d'ids pour éviter une requête IN (...) démesurée.
const bulkRules = [
  body('ids').isArray({ min: 1, max: 200 }).withMessage('La liste des tâches est invalide (1 à 200).'),
  body('ids.*').isInt({ min: 1 }).withMessage('Identifiant de tâche invalide.'),
  body('action').isIn(['status', 'priority', 'delete']).withMessage('Action groupée invalide.'),
  body('value')
    .if(body('action').equals('status'))
    .isIn(['a_faire', 'en_cours', 'terminee']).withMessage('Statut invalide.'),
  body('value')
    .if(body('action').equals('priority'))
    .isIn(['basse', 'moyenne', 'haute']).withMessage('Priorité invalide.'),
  checkValidation
];

module.exports = {
  registerRules,
  loginRules,
  taskRules,
  taskUpdateRules,
  taskQueryRules,
  bulkRules
};

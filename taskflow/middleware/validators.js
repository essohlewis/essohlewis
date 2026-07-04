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

const refreshRules = [
  body('refreshToken').isString().trim().notEmpty().withMessage('Refresh token manquant.'),
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
  body('recurrence').optional({ nullable: true, checkFalsy: true }).isIn(['daily', 'weekly', 'monthly']).withMessage('Récurrence invalide.'),
  body('labels').optional({ nullable: true }).isArray({ max: 20 }).withMessage('Étiquettes invalides (20 maximum).'),
  body('labels.*').optional().isString().trim().isLength({ max: 40 }).withMessage('Étiquette trop longue (40 caractères max).'),
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
  body('recurrence').optional({ nullable: true, checkFalsy: true }).isIn(['daily', 'weekly', 'monthly']).withMessage('Récurrence invalide.'),
  body('labels').optional({ nullable: true }).isArray({ max: 20 }).withMessage('Étiquettes invalides (20 maximum).'),
  body('labels.*').optional().isString().trim().isLength({ max: 40 }).withMessage('Étiquette trop longue (40 caractères max).'),
  checkValidation
];

const taskQueryRules = [
  query('status').optional().isIn(['a_faire', 'en_cours', 'terminee']),
  query('priority').optional().isIn(['basse', 'moyenne', 'haute']),
  query('sort').optional().isIn(['recent', 'ancien', 'echeance', 'priorite']),
  query('search').optional().isLength({ max: 200 }),
  query('limit').optional().isInt({ min: 1, max: 200 }),
  query('offset').optional().isInt({ min: 0 }),
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

// Règles pour l'import en masse. Le détail de chaque tâche est nettoyé/validé
// dans le contrôleur ; ici on borne surtout la taille du lot.
const importRules = [
  body('tasks').isArray({ min: 1, max: 1000 }).withMessage('Le fichier doit contenir de 1 à 1000 tâches.'),
  checkValidation
];

// Mise à jour du profil (nom et/ou bio).
const profileRules = [
  body('name').optional().trim().notEmpty().withMessage('Le nom ne peut pas être vide.')
    .isLength({ max: 100 }).withMessage('Le nom est trop long.'),
  body('bio').optional({ nullable: true }).isLength({ max: 500 }).withMessage('La bio est trop longue (500 caractères max).'),
  checkValidation
];

// Commentaire sur une tâche.
const commentRules = [
  body('body').trim().notEmpty().withMessage('Le commentaire est vide.')
    .isLength({ max: 1000 }).withMessage('Le commentaire est trop long (1000 caractères max).'),
  checkValidation
];

// Réaction (emoji) sur une tâche.
const reactionRules = [
  body('emoji').trim().notEmpty().withMessage('Emoji requis.')
    .isLength({ max: 8 }).withMessage('Emoji invalide.'),
  checkValidation
];

// Règle pour le partage d'une tâche (par email du destinataire).
const shareRules = [
  body('email').trim().isEmail().withMessage('Email invalide.').normalizeEmail(),
  checkValidation
];

// Règles pour les sous-tâches (checklist).
const subtaskRules = [
  body('title').trim().notEmpty().withMessage('Le titre de la sous-tâche est requis.')
    .isLength({ max: 200 }).withMessage('Le titre est trop long (200 caractères max).'),
  checkValidation
];

const subtaskUpdateRules = [
  body('title').optional().trim().notEmpty().withMessage('Le titre ne peut pas être vide.')
    .isLength({ max: 200 }).withMessage('Le titre est trop long (200 caractères max).'),
  body('done').optional().isBoolean().withMessage('La valeur "done" doit être un booléen.'),
  checkValidation
];

module.exports = {
  registerRules,
  loginRules,
  refreshRules,
  taskRules,
  taskUpdateRules,
  taskQueryRules,
  bulkRules,
  importRules,
  shareRules,
  profileRules,
  commentRules,
  reactionRules,
  subtaskRules,
  subtaskUpdateRules
};

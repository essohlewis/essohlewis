const pool = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const asyncHandler = require('../middleware/asyncHandler');

// Vues enregistrées : combinaisons de filtres/tri sauvegardées par l'utilisateur
// pour être ré-appliquées en un clic (à la manière des vues de Linear/Jira).

const MAX_VIEWS_PER_USER = 30;
const SORTS = ['recent', 'ancien', 'echeance', 'priorite'];
const STATUSES = ['a_faire', 'en_cours', 'terminee'];
const PRIORITIES = ['basse', 'moyenne', 'haute'];

// Ne conserve que des clés de filtre connues, avec des valeurs bornées : on ne
// stocke jamais de contenu arbitraire dans la colonne JSON.
function sanitizeFilters(input) {
  const src = input && typeof input === 'object' ? input : {};
  const out = {};
  if (STATUSES.includes(src.status)) out.status = src.status;
  if (PRIORITIES.includes(src.priority)) out.priority = src.priority;
  if (SORTS.includes(src.sort)) out.sort = src.sort;
  if (typeof src.tag === 'string' && src.tag.trim()) out.tag = src.tag.trim().slice(0, 40);
  if (typeof src.label === 'string' && src.label.trim()) out.label = src.label.trim().slice(0, 40);
  if (typeof src.search === 'string' && src.search.trim()) out.search = src.search.trim().slice(0, 200);
  return out;
}

// mysql2 renvoie une colonne JSON déjà désérialisée sur la plupart des adaptateurs,
// mais peut renvoyer une chaîne selon la configuration : on gère les deux cas.
function parseFilters(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch (e) { return {}; }
  }
  return {};
}

// GET /api/views
const listViews = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT id, name, filters, created_at FROM saved_views WHERE user_id = ? ORDER BY created_at DESC',
    [req.userId]
  );
  res.json(rows.map((r) => ({ ...r, filters: parseFilters(r.filters) })));
});

// POST /api/views
const createView = asyncHandler(async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim().slice(0, 80) : '';
  if (!name) throw new AppError('Le nom de la vue est requis.', 400);

  const [[{ count }]] = await pool.query(
    'SELECT COUNT(*) AS count FROM saved_views WHERE user_id = ?',
    [req.userId]
  );
  if (count >= MAX_VIEWS_PER_USER) {
    throw new AppError(`Limite de ${MAX_VIEWS_PER_USER} vues enregistrées atteinte.`, 400);
  }

  const filters = sanitizeFilters(req.body.filters);
  const [result] = await pool.query(
    'INSERT INTO saved_views (user_id, name, filters) VALUES (?, ?, ?)',
    [req.userId, name, JSON.stringify(filters)]
  );

  res.status(201).json({ id: result.insertId, name, filters });
});

// DELETE /api/views/:id
const deleteView = asyncHandler(async (req, res) => {
  const [result] = await pool.query(
    'DELETE FROM saved_views WHERE id = ? AND user_id = ?',
    [req.params.id, req.userId]
  );
  if (result.affectedRows === 0) throw new AppError('Vue introuvable.', 404);
  res.json({ message: 'Vue supprimée.' });
});

module.exports = { listViews, createView, deleteView, sanitizeFilters };

const pool = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const asyncHandler = require('../middleware/asyncHandler');
const statsCache = require('../middleware/statsCache');

const SORT_OPTIONS = {
  recent: 'created_at DESC',
  ancien: 'created_at ASC',
  echeance: 'due_date IS NULL, due_date ASC',
  priorite: "FIELD(priority, 'haute', 'moyenne', 'basse')"
};

// InnoDB ignore les mots plus courts que innodb_ft_min_token_size (3 par défaut).
// En dessous de ce seuil, MATCH ... AGAINST ne renvoie rien : on retombe donc
// sur un LIKE classique pour les recherches très courtes.
const FULLTEXT_MIN_LEN = 3;

// Construit la clause de recherche. Au-delà de 3 caractères, on utilise l'index
// FULLTEXT (MATCH ... AGAINST en mode booléen avec troncature `mot*`), qui est
// réellement indexé — bien plus rapide que `LIKE '%mot%'` sur une grande table.
function buildSearchClause(search) {
  const term = search.trim();
  if (term.length >= FULLTEXT_MIN_LEN) {
    // On neutralise les opérateurs booléens FULLTEXT pour traiter la saisie
    // utilisateur comme du texte, puis on ajoute `*` pour la recherche par préfixe.
    const cleaned = term.replace(/[+\-><()~*"@]/g, ' ').trim();
    if (cleaned) {
      return {
        clause: 'MATCH(title, description) AGAINST (? IN BOOLEAN MODE)',
        params: [`${cleaned}*`]
      };
    }
  }
  return {
    clause: '(title LIKE ? OR description LIKE ?)',
    params: [`%${term}%`, `%${term}%`]
  };
}

// GET /api/tasks?status=&priority=&search=&sort=&tag=
// Tous les paramètres sont optionnels et combinables.
const getTasks = asyncHandler(async (req, res) => {
  const { status, priority, search, sort, tag } = req.query;

  const conditions = ['user_id = ?'];
  const params = [req.userId];

  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }
  if (priority) {
    conditions.push('priority = ?');
    params.push(priority);
  }
  if (tag) {
    conditions.push('tag = ?');
    params.push(tag);
  }
  if (search && search.trim()) {
    const { clause, params: searchParams } = buildSearchClause(search);
    conditions.push(clause);
    params.push(...searchParams);
  }

  const orderBy = SORT_OPTIONS[sort] || SORT_OPTIONS.recent;

  const [tasks] = await pool.query(
    `SELECT * FROM tasks WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy}`,
    params
  );

  res.json(tasks);
});

// GET /api/tasks/stats - petit tableau de bord (compteurs, retard, taux de complétion)
// Résultat mis en cache par utilisateur (voir middleware/statsCache.js) : tant
// qu'aucune tâche n'est modifiée, on évite de relancer l'agrégat en base.
const getStats = asyncHandler(async (req, res) => {
  const cached = statsCache.get(req.userId);
  if (cached) {
    res.set('X-Cache', 'HIT');
    return res.json(cached);
  }

  const [rows] = await pool.query(
    `SELECT
       COUNT(*) AS total,
       SUM(status = 'a_faire') AS a_faire,
       SUM(status = 'en_cours') AS en_cours,
       SUM(status = 'terminee') AS terminee,
       SUM(due_date IS NOT NULL AND due_date < CURDATE() AND status != 'terminee') AS en_retard
     FROM tasks WHERE user_id = ?`,
    [req.userId]
  );

  const stats = rows[0];
  const total = Number(stats.total) || 0;
  const terminee = Number(stats.terminee) || 0;

  const payload = {
    total,
    a_faire: Number(stats.a_faire) || 0,
    en_cours: Number(stats.en_cours) || 0,
    terminee,
    en_retard: Number(stats.en_retard) || 0,
    taux_completion: total > 0 ? Math.round((terminee / total) * 100) : 0
  };

  statsCache.set(req.userId, payload);
  res.set('X-Cache', 'MISS');
  res.json(payload);
});

// GET /api/tasks/:id
const getTaskById = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
    [req.params.id, req.userId]
  );
  if (rows.length === 0) {
    throw new AppError('Tâche introuvable.', 404);
  }
  res.json(rows[0]);
});

// POST /api/tasks
const createTask = asyncHandler(async (req, res) => {
  const { title, description, status, priority, due_date, tag } = req.body;

  const [result] = await pool.query(
    `INSERT INTO tasks (user_id, title, description, status, priority, due_date, tag)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      req.userId,
      title,
      description || null,
      status || 'a_faire',
      priority || 'moyenne',
      due_date || null,
      tag || null
    ]
  );

  statsCache.invalidate(req.userId);

  const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

// PUT /api/tasks/:id
const updateTask = asyncHandler(async (req, res) => {
  const { title, description, status, priority, due_date, tag } = req.body;

  const [existing] = await pool.query(
    'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
    [req.params.id, req.userId]
  );
  if (existing.length === 0) {
    throw new AppError('Tâche introuvable.', 404);
  }

  const current = existing[0];

  await pool.query(
    `UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, due_date = ?, tag = ?
     WHERE id = ? AND user_id = ?`,
    [
      title ?? current.title,
      description ?? current.description,
      status ?? current.status,
      priority ?? current.priority,
      due_date ?? current.due_date,
      tag ?? current.tag,
      req.params.id,
      req.userId
    ]
  );

  statsCache.invalidate(req.userId);

  const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

// PATCH /api/tasks/bulk - modifie ou supprime plusieurs tâches en une seule requête SQL.
// Body : { ids: [1,2,3], action: 'status'|'priority'|'delete', value?: '...' }
// Bien plus performant qu'un aller-retour HTTP par tâche (multi-sélection,
// glisser-déposer groupé), et atomique côté base.
const bulkUpdate = asyncHandler(async (req, res) => {
  const { ids, action, value } = req.body;

  // Sécurité : la clause `user_id = ?` garantit qu'on ne touche jamais qu'aux
  // tâches de l'utilisateur courant, même si des ids étrangers sont envoyés.
  const placeholders = ids.map(() => '?').join(', ');

  let affectedRows;
  if (action === 'delete') {
    const [result] = await pool.query(
      `DELETE FROM tasks WHERE id IN (${placeholders}) AND user_id = ?`,
      [...ids, req.userId]
    );
    affectedRows = result.affectedRows;
  } else {
    const column = action === 'status' ? 'status' : 'priority';
    const [result] = await pool.query(
      `UPDATE tasks SET ${column} = ? WHERE id IN (${placeholders}) AND user_id = ?`,
      [value, ...ids, req.userId]
    );
    affectedRows = result.affectedRows;
  }

  statsCache.invalidate(req.userId);
  res.json({ affected: affectedRows });
});

// DELETE /api/tasks/:id
const deleteTask = asyncHandler(async (req, res) => {
  const [result] = await pool.query(
    'DELETE FROM tasks WHERE id = ? AND user_id = ?',
    [req.params.id, req.userId]
  );

  if (result.affectedRows === 0) {
    throw new AppError('Tâche introuvable.', 404);
  }

  statsCache.invalidate(req.userId);
  res.json({ message: 'Tâche supprimée.' });
});

module.exports = {
  getTasks,
  getStats,
  getTaskById,
  createTask,
  updateTask,
  bulkUpdate,
  deleteTask
};

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

const STATUSES = ['a_faire', 'en_cours', 'terminee'];
const PRIORITIES = ['basse', 'moyenne', 'haute'];
const EXPORT_COLUMNS = ['title', 'description', 'status', 'priority', 'tag', 'due_date'];

// Vérifie qu'une chaîne est une vraie date calendaire AAAA-MM-JJ (et pas juste
// au bon format) : "2026-13-99" doit être rejeté avant l'INSERT (MySQL strict).
function isValidDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

// Échappement CSV minimal : on entoure de guillemets et on double les guillemets
// internes dès qu'une valeur contient une virgule, un guillemet ou un saut de ligne.
function csvCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toCsv(rows) {
  const header = EXPORT_COLUMNS.join(',');
  const lines = rows.map((r) =>
    EXPORT_COLUMNS.map((col) => csvCell(
      col === 'due_date' && r.due_date
        ? new Date(r.due_date).toISOString().slice(0, 10)
        : r[col]
    )).join(',')
  );
  return [header, ...lines].join('\n');
}

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

  // Pagination optionnelle : si `limit` est fourni, on borne le nombre de
  // résultats (avec `offset`). Sans `limit`, on renvoie tout (rétrocompatible).
  let limitClause = '';
  if (req.query.limit !== undefined) {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 0, 1), 200);
    const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
    limitClause = ' LIMIT ? OFFSET ?';
    params.push(limit, offset);
  }

  const [tasks] = await pool.query(
    `SELECT * FROM tasks WHERE ${conditions.join(' AND ')} ORDER BY ${orderBy}${limitClause}`,
    params
  );

  // Avancement des sous-tâches : une seule requête agrégée pour toutes les
  // tâches renvoyées (pas de N+1), puis fusion en mémoire.
  if (tasks.length > 0) {
    const ids = tasks.map((t) => t.id);
    const [aggs] = await pool.query(
      `SELECT task_id, COUNT(*) AS total, SUM(done) AS done
         FROM subtasks WHERE task_id IN (?) GROUP BY task_id`,
      [ids]
    );
    const byTask = new Map(
      aggs.map((a) => [a.task_id, { total: Number(a.total), done: Number(a.done) }])
    );

    // Nombre de pièces jointes par tâche (même approche, une seule requête).
    const [atts] = await pool.query(
      `SELECT task_id, COUNT(*) AS total FROM attachments WHERE task_id IN (?) GROUP BY task_id`,
      [ids]
    );
    const attByTask = new Map(atts.map((a) => [a.task_id, Number(a.total)]));

    tasks.forEach((t) => {
      const agg = byTask.get(t.id);
      t.subtasks_total = agg ? agg.total : 0;
      t.subtasks_done = agg ? agg.done : 0;
      t.attachments_count = attByTask.get(t.id) || 0;
    });
  }

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

// GET /api/tasks/reminders?days=3 - tâches non terminées en retard ou dont
// l'échéance approche (dans les `days` prochains jours). Sert la cloche de
// notifications ; l'endpoint est prêt pour un futur envoi par email.
const getReminders = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 3, 0), 30);

  const [rows] = await pool.query(
    `SELECT id, title, status, due_date,
            CASE WHEN due_date < CURDATE() THEN 'overdue' ELSE 'soon' END AS reminder
       FROM tasks
      WHERE user_id = ?
        AND status != 'terminee'
        AND due_date IS NOT NULL
        AND due_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY due_date ASC`,
    [req.userId, days]
  );

  const overdue = rows.filter((r) => r.reminder === 'overdue');
  const soon = rows.filter((r) => r.reminder === 'soon');
  res.json({ total: rows.length, overdue, soon });
});

// GET /api/tasks/tags - liste des tags distincts de l'utilisateur (avec compteur),
// pour alimenter le filtre par tag.
const getTags = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT tag, COUNT(*) AS count
       FROM tasks
      WHERE user_id = ? AND tag IS NOT NULL AND tag != ''
      GROUP BY tag
      ORDER BY tag ASC`,
    [req.userId]
  );
  res.json(rows.map((r) => ({ tag: r.tag, count: Number(r.count) })));
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
  const [existing] = await pool.query(
    'SELECT * FROM tasks WHERE id = ? AND user_id = ?',
    [req.params.id, req.userId]
  );
  if (existing.length === 0) {
    throw new AppError('Tâche introuvable.', 404);
  }

  const current = existing[0];

  // On distingue « champ absent du corps » (on conserve la valeur actuelle)
  // de « champ fourni à null » (on efface le champ). Le `??` ne le permettait
  // pas : envoyer due_date: null ne vidait jamais l'échéance.
  const pick = (field) => (field in req.body ? req.body[field] : current[field]);

  await pool.query(
    `UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, due_date = ?, tag = ?
     WHERE id = ? AND user_id = ?`,
    [
      pick('title'),
      pick('description'),
      pick('status'),
      pick('priority'),
      pick('due_date'),
      pick('tag'),
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

// GET /api/tasks/export?format=json|csv - télécharge toutes les tâches de
// l'utilisateur (sauvegarde / portabilité des données).
const exportTasks = asyncHandler(async (req, res) => {
  const format = req.query.format === 'csv' ? 'csv' : 'json';
  const [rows] = await pool.query(
    `SELECT ${EXPORT_COLUMNS.join(', ')} FROM tasks WHERE user_id = ? ORDER BY created_at ASC`,
    [req.userId]
  );

  const stamp = new Date().toISOString().slice(0, 10);

  if (format === 'csv') {
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="taskflow_${stamp}.csv"`);
    return res.send(toCsv(rows));
  }

  const tasks = rows.map((r) => ({
    ...r,
    due_date: r.due_date ? new Date(r.due_date).toISOString().slice(0, 10) : null
  }));
  res.set('Content-Disposition', `attachment; filename="taskflow_${stamp}.json"`);
  res.json({ exported_at: new Date().toISOString(), tasks });
});

// Normalise une tâche importée : garde un titre non vide, coerce les énumérés
// invalides vers les valeurs par défaut, valide la date. Renvoie null si
// la ligne est inexploitable (pas de titre).
function sanitizeImportedTask(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = typeof raw.title === 'string' ? raw.title.trim().slice(0, 200) : '';
  if (!title) return null;

  const description = typeof raw.description === 'string' ? raw.description.slice(0, 2000) : null;
  const status = STATUSES.includes(raw.status) ? raw.status : 'a_faire';
  const priority = PRIORITIES.includes(raw.priority) ? raw.priority : 'moyenne';
  const tag = typeof raw.tag === 'string' && raw.tag.trim() ? raw.tag.trim().slice(0, 40) : null;
  const due_date = isValidDate(raw.due_date) ? raw.due_date : null;

  return [title, description, status, priority, due_date, tag];
}

// POST /api/tasks/import - ajoute en masse des tâches à partir d'un export JSON.
// Body : { tasks: [ { title, description?, status?, priority?, tag?, due_date? }, ... ] }
// Insertion multi-lignes (une seule requête) ; les lignes sans titre sont ignorées.
const importTasks = asyncHandler(async (req, res) => {
  const list = Array.isArray(req.body.tasks) ? req.body.tasks : [];

  const values = [];
  for (const raw of list) {
    const clean = sanitizeImportedTask(raw);
    if (clean) values.push([req.userId, ...clean]);
  }

  if (values.length === 0) {
    return res.status(400).json({ message: 'Aucune tâche valide à importer.' });
  }

  await pool.query(
    `INSERT INTO tasks (user_id, title, description, status, priority, due_date, tag) VALUES ?`,
    [values]
  );

  statsCache.invalidate(req.userId);
  res.status(201).json({ imported: values.length, skipped: list.length - values.length });
});

module.exports = {
  getTasks,
  getStats,
  getReminders,
  getTags,
  getTaskById,
  createTask,
  updateTask,
  bulkUpdate,
  deleteTask,
  exportTasks,
  importTasks
};

const pool = require('../config/db');
const { AppError } = require('../middleware/errorHandler');
const asyncHandler = require('../middleware/asyncHandler');
const statsCache = require('../middleware/statsCache');
const { logActivity } = require('../utils/activity');
const logger = require('../utils/logger');
const redisCache = require('../utils/cache');
const { invalidateUserCache } = require('../middleware/cacheMiddleware');

async function logTaskAudit(taskId, userId, action, details = null) {
  try {
    await pool.query(
      'INSERT INTO task_audit (task_id, user_id, action, details) VALUES (?, ?, ?, ?)',
      [taskId, userId, action, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('⚠️ Échec de la journalisation d\'audit de tâche :', err.message);
  }
}

// Vérifie si un utilisateur a accès à une tâche (créateur ou membre de son espace)
async function checkTaskAccess(taskId, userId) {
  const [tasks] = await pool.query('SELECT * FROM tasks WHERE id = ?', [taskId]);
  if (tasks.length === 0) return null;
  const task = tasks[0];

  if (!task.workspace_id) {
    // Tâche personnelle : accès uniquement au propriétaire
    return task.user_id === userId ? task : null;
  }

  // Tâche d'équipe : accès si l'utilisateur est membre de l'espace de travail
  const [members] = await pool.query(
    'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
    [task.workspace_id, userId]
  );
  return members.length > 0 ? task : null;
}

const SORT_OPTIONS = {
  recent: 'created_at DESC',
  ancien: 'created_at ASC',
  echeance: 'due_date IS NULL, due_date ASC',
  priorite: "FIELD(priority, 'haute', 'moyenne', 'basse')"
};

const STATUSES = ['a_faire', 'en_cours', 'terminee'];
const PRIORITIES = ['basse', 'moyenne', 'haute'];
const EXPORT_COLUMNS = ['title', 'description', 'status', 'priority', 'tag', 'due_date'];

function isValidDate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const d = new Date(`${str}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === str;
}

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

const FULLTEXT_MIN_LEN = 3;

function buildSearchClause(search) {
  const term = search.trim();
  if (term.length >= FULLTEXT_MIN_LEN) {
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

// GET /api/tasks
const getTasks = asyncHandler(async (req, res) => {
  const { status, priority, search, sort, tag, workspaceId } = req.query;

  const conditions = [];
  const params = [];

  if (workspaceId) {
    // Vérification de la présence dans l'espace de travail
    const [members] = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, req.userId]
    );
    if (members.length === 0) {
      return res.status(403).json({ message: 'Accès refusé à cet espace de travail.' });
    }
    conditions.push('workspace_id = ?');
    params.push(workspaceId);
  } else {
    // Tâches personnelles uniquement (créées par l'utilisateur et hors espace de travail)
    conditions.push('user_id = ?');
    conditions.push('workspace_id IS NULL');
    params.push(req.userId);
  }

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

    const [atts] = await pool.query(
      `SELECT task_id, COUNT(*) AS total FROM attachments WHERE task_id IN (?) GROUP BY task_id`,
      [ids]
    );
    const attByTask = new Map(atts.map((a) => [a.task_id, Number(a.total)]));

    const [cmts] = await pool.query(
      `SELECT task_id, COUNT(*) AS total FROM comments WHERE task_id IN (?) GROUP BY task_id`,
      [ids]
    );
    const cmtByTask = new Map(cmts.map((c) => [c.task_id, Number(c.total)]));

    const [rx] = await pool.query(
      `SELECT task_id, emoji, COUNT(*) AS count FROM reactions WHERE task_id IN (?) GROUP BY task_id, emoji`,
      [ids]
    );
    const rxByTask = new Map();
    rx.forEach((r) => {
      if (!rxByTask.has(r.task_id)) rxByTask.set(r.task_id, []);
      rxByTask.get(r.task_id).push({ emoji: r.emoji, count: Number(r.count) });
    });
    const [myRx] = await pool.query(
      `SELECT task_id, emoji FROM reactions WHERE task_id IN (?) AND user_id = ?`,
      [ids, req.userId]
    );
    const myRxByTask = new Map();
    myRx.forEach((r) => {
      if (!myRxByTask.has(r.task_id)) myRxByTask.set(r.task_id, []);
      myRxByTask.get(r.task_id).push(r.emoji);
    });

    tasks.forEach((t) => {
      const agg = byTask.get(t.id);
      t.subtasks_total = agg ? agg.total : 0;
      t.subtasks_done = agg ? agg.done : 0;
      t.attachments_count = attByTask.get(t.id) || 0;
      t.comments_count = cmtByTask.get(t.id) || 0;
      t.reactions = rxByTask.get(t.id) || [];
      t.my_reactions = myRxByTask.get(t.id) || [];
    });
  }

  res.json(tasks);
});

// GET /api/tasks/stats
const getStats = asyncHandler(async (req, res) => {
  const { workspaceId } = req.query;
  const redisCacheKey = `stats:${req.userId}:${workspaceId || 'personal'}`;

  // Essayer le cache Redis en premier
  const cached = await redisCache.get(redisCacheKey);
  if (cached) {
    res.set('X-Cache', 'HIT');
    logger.info(`Stats cache HIT for user ${req.userId}`);
    return res.json(cached);
  }

  let query = `
    SELECT
      COUNT(*) AS total,
      SUM(status = 'a_faire') AS a_faire,
      SUM(status = 'en_cours') AS en_cours,
      SUM(status = 'terminee') AS terminee,
      SUM(due_date IS NOT NULL AND due_date < CURDATE() AND status != 'terminee') AS en_retard
    FROM tasks WHERE `;

  const params = [];
  if (workspaceId) {
    const [members] = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, req.userId]
    );
    if (members.length === 0) {
      return res.status(403).json({ message: 'Accès refusé à cet espace de travail.' });
    }
    query += 'workspace_id = ?';
    params.push(workspaceId);
  } else {
    query += 'user_id = ? AND workspace_id IS NULL';
    params.push(req.userId);
  }

  const [rows] = await pool.query(query, params);
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

  // Mettre en cache avec TTL de 1 heure
  await redisCache.set(redisCacheKey, payload, 3600);
  res.set('X-Cache', 'MISS');
  logger.info(`Stats cache MISS for user ${req.userId}`);
  res.json(payload);
});

// GET /api/tasks/reminders
const getReminders = asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(parseInt(req.query.days, 10) || 3, 0), 30);

  // Récupère les rappels pour les tâches personnelles + les tâches des espaces rejoints
  const [rows] = await pool.query(
    `SELECT t.id, t.title, t.status, t.due_date,
            CASE WHEN t.due_date < CURDATE() THEN 'overdue' ELSE 'soon' END AS reminder
       FROM tasks t
      WHERE (t.user_id = ? AND t.workspace_id IS NULL OR t.workspace_id IN (
         SELECT workspace_id FROM workspace_members WHERE user_id = ?
      ))
        AND t.status != 'terminee'
        AND t.due_date IS NOT NULL
        AND t.due_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
      ORDER BY t.due_date ASC`,
    [req.userId, req.userId, days]
  );

  const overdue = rows.filter((r) => r.reminder === 'overdue');
  const soon = rows.filter((r) => r.reminder === 'soon');
  res.json({ total: rows.length, overdue, soon });
});

// GET /api/tasks/tags
const getTags = asyncHandler(async (req, res) => {
  const { workspaceId } = req.query;
  let query = 'SELECT tag, COUNT(*) AS count FROM tasks WHERE ';
  const params = [];

  if (workspaceId) {
    const [members] = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, req.userId]
    );
    if (members.length === 0) {
      return res.status(403).json({ message: 'Accès refusé à cet espace.' });
    }
    query += 'workspace_id = ?';
    params.push(workspaceId);
  } else {
    query += 'user_id = ? AND workspace_id IS NULL';
    params.push(req.userId);
  }

  query += ' AND tag IS NOT NULL AND tag != \'\' GROUP BY tag ORDER BY tag ASC';
  const [rows] = await pool.query(query, params);
  res.json(rows.map((r) => ({ tag: r.tag, count: Number(r.count) })));
});

// GET /api/tasks/:id
const getTaskById = asyncHandler(async (req, res) => {
  const task = await checkTaskAccess(req.params.id, req.userId);
  if (!task) {
    throw new AppError('Tâche introuvable ou accès refusé.', 404);
  }
  res.json(task);
});

// POST /api/tasks
const createTask = asyncHandler(async (req, res) => {
  const { title, description, status, priority, due_date, tag, workspaceId } = req.body;

  let finalWorkspaceId = null;
  if (workspaceId) {
    const [members] = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, req.userId]
    );
    if (members.length === 0) {
      return res.status(403).json({ message: 'Accès refusé à cet espace de travail.' });
    }
    finalWorkspaceId = workspaceId;
  }

  const [result] = await pool.query(
    `INSERT INTO tasks (user_id, title, description, status, priority, due_date, tag, workspace_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      req.userId,
      title,
      description || null,
      status || 'a_faire',
      priority || 'moyenne',
      due_date || null,
      tag || null,
      finalWorkspaceId
    ]
  );

  // Invalider le cache
  if (finalWorkspaceId) {
    const [mRows] = await pool.query('SELECT user_id FROM workspace_members WHERE workspace_id = ?', [finalWorkspaceId]);
    mRows.forEach(async (m) => {
      await redisCache.del(`stats:${m.user_id}:${finalWorkspaceId}`);
      await redisCache.deletePattern(`/api/tasks:${m.user_id}:*`);
    });
    statsCache.invalidate(req.userId + '_' + finalWorkspaceId);
  } else {
    await redisCache.del(`stats:${req.userId}:personal`);
    await redisCache.deletePattern(`/api/tasks:${req.userId}:*`);
    statsCache.invalidate(req.userId + '_personal');
  }

  logger.info(`Task created: "${title}" (user: ${req.userId}, workspace: ${finalWorkspaceId || 'personal'})`);
  logActivity(req.userId, 'created', result.insertId, title);
  await logTaskAudit(result.insertId, req.userId, 'created', { title, status, priority, due_date, tag });

  const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [result.insertId]);
  res.status(201).json(rows[0]);
});

// PUT /api/tasks/:id
const updateTask = asyncHandler(async (req, res) => {
  const task = await checkTaskAccess(req.params.id, req.userId);
  if (!task) {
    throw new AppError('Tâche introuvable ou accès refusé.', 404);
  }

  const pick = (field) => (field in req.body ? req.body[field] : task[field]);

  const changes = {};
  for (const field of ['title', 'description', 'status', 'priority', 'due_date', 'tag']) {
    if (field in req.body && req.body[field] !== task[field]) {
      changes[field] = { old: task[field], new: req.body[field] };
    }
  }

  const title = pick('title');
  const description = pick('description');
  const status = pick('status');
  const priority = pick('priority');
  const due_date = pick('due_date');
  const tag = pick('tag');

  await pool.query(
    `UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, due_date = ?, tag = ?
     WHERE id = ?`,
    [title, description || null, status, priority, due_date || null, tag || null, req.params.id]
  );

  // Invalider le cache
  if (task.workspace_id) {
    const [mRows] = await pool.query('SELECT user_id FROM workspace_members WHERE workspace_id = ?', [task.workspace_id]);
    mRows.forEach(async (m) => {
      await redisCache.del(`stats:${m.user_id}:${task.workspace_id}`);
      await redisCache.deletePattern(`/api/tasks:${m.user_id}:*`);
    });
    statsCache.invalidate(req.userId + '_' + task.workspace_id);
  } else {
    await redisCache.del(`stats:${req.userId}:personal`);
    await redisCache.deletePattern(`/api/tasks:${req.userId}:*`);
    statsCache.invalidate(req.userId + '_personal');
  }

  if (Object.keys(changes).length > 0) {
    logger.info(`Task updated: "${title}" (task_id: ${req.params.id}, changes: ${Object.keys(changes).join(', ')})`);
    await logTaskAudit(req.params.id, req.userId, 'updated', changes);
  }

  if (pick('status') === 'terminee' && task.status !== 'terminee') {
    logger.info(`Task completed: "${title}" (task_id: ${req.params.id})`);
    logActivity(req.userId, 'completed', task.id, title);
  }

  const [rows] = await pool.query('SELECT * FROM tasks WHERE id = ?', [req.params.id]);
  res.json(rows[0]);
});

// PATCH /api/tasks/bulk
const bulkUpdate = asyncHandler(async (req, res) => {
  const { ids, action, value } = req.body;
  if (!ids || ids.length === 0) return res.json({ affected: 0 });

  // Construire la clause de sécurité (les tâches doivent appartenir à l'utilisateur ou à l'un de ses espaces)
  const [memberships] = await pool.query('SELECT workspace_id FROM workspace_members WHERE user_id = ?', [req.userId]);
  const joinedWorkspaceIds = memberships.map((m) => m.workspace_id);

  let securityClause = 'user_id = ?';
  const securityParams = [req.userId];

  if (joinedWorkspaceIds.length > 0) {
    securityClause = `(user_id = ? OR workspace_id IN (${joinedWorkspaceIds.map(() => '?').join(', ')}))`;
    securityParams.push(...joinedWorkspaceIds);
  }

  const placeholders = ids.map(() => '?').join(', ');

  let affectedRows;
  if (action === 'delete') {
    const [result] = await pool.query(
      `DELETE FROM tasks WHERE id IN (${placeholders}) AND ${securityClause}`,
      [...ids, ...securityParams]
    );
    affectedRows = result.affectedRows;
  } else {
    for (const id of ids) {
      await logTaskAudit(id, req.userId, 'updated', { [action]: { new: value } });
    }

    const column = action === 'status' ? 'status' : 'priority';
    const [result] = await pool.query(
      `UPDATE tasks SET ${column} = ? WHERE id IN (${placeholders}) AND ${securityClause}`,
      [value, ...ids, ...securityParams]
    );
    affectedRows = result.affectedRows;
  }

  // Invalider tous les caches pour le user et ses espaces
  await redisCache.del(`stats:${req.userId}:personal`);
  await redisCache.deletePattern(`/api/tasks:${req.userId}:*`);
  statsCache.invalidate(req.userId + '_personal');

  joinedWorkspaceIds.forEach(async (wid) => {
    await redisCache.del(`stats:${req.userId}:${wid}`);
    await redisCache.deletePattern(`/api/tasks:${req.userId}:*`);
    statsCache.invalidate(req.userId + '_' + wid);
  });

  logger.info(`Bulk ${action}: ${affectedRows} tasks affected (user: ${req.userId})`);
  res.json({ affected: affectedRows });
});

// DELETE /api/tasks/:id
const deleteTask = asyncHandler(async (req, res) => {
  const task = await checkTaskAccess(req.params.id, req.userId);
  if (!task) {
    throw new AppError('Tâche introuvable ou accès refusé.', 404);
  }

  await pool.query('DELETE FROM tasks WHERE id = ?', [req.params.id]);

  // Invalider le cache
  if (task.workspace_id) {
    const [mRows] = await pool.query('SELECT user_id FROM workspace_members WHERE workspace_id = ?', [task.workspace_id]);
    mRows.forEach(async (m) => {
      await redisCache.del(`stats:${m.user_id}:${task.workspace_id}`);
      await redisCache.deletePattern(`/api/tasks:${m.user_id}:*`);
    });
    statsCache.invalidate(req.userId + '_' + task.workspace_id);
  } else {
    await redisCache.del(`stats:${req.userId}:personal`);
    await redisCache.deletePattern(`/api/tasks:${req.userId}:*`);
    statsCache.invalidate(req.userId + '_personal');
  }

  logger.info(`Task deleted: ${task.title || 'Untitled'} (task_id: ${req.params.id})`);
  res.json({ message: 'Tâche supprimée.' });
});

// GET /api/tasks/export
const exportTasks = asyncHandler(async (req, res) => {
  const { format, workspaceId } = req.query;
  const targetFormat = format === 'csv' ? 'csv' : 'json';

  let query = `SELECT ${EXPORT_COLUMNS.join(', ')} FROM tasks WHERE `;
  const params = [];

  if (workspaceId) {
    const [members] = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, req.userId]
    );
    if (members.length === 0) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    query += 'workspace_id = ?';
    params.push(workspaceId);
  } else {
    query += 'user_id = ? AND workspace_id IS NULL';
    params.push(req.userId);
  }

  query += ' ORDER BY created_at ASC';
  const [rows] = await pool.query(query, params);
  const stamp = new Date().toISOString().slice(0, 10);

  if (targetFormat === 'csv') {
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

// POST /api/tasks/import
const importTasks = asyncHandler(async (req, res) => {
  const { tasks: list, workspaceId } = req.body;
  const arrayList = Array.isArray(list) ? list : [];

  let finalWorkspaceId = null;
  if (workspaceId) {
    const [members] = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = ? AND user_id = ?',
      [workspaceId, req.userId]
    );
    if (members.length === 0) {
      return res.status(403).json({ message: 'Accès refusé.' });
    }
    finalWorkspaceId = workspaceId;
  }

  const values = [];
  for (const raw of arrayList) {
    const clean = sanitizeImportedTask(raw);
    if (clean) values.push([req.userId, ...clean, finalWorkspaceId]);
  }

  if (values.length === 0) {
    return res.status(400).json({ message: 'Aucune tâche valide à importer.' });
  }

  await pool.query(
    `INSERT INTO tasks (user_id, title, description, status, priority, due_date, tag, workspace_id) VALUES ?`,
    [values]
  );

  // Invalider le cache
  if (finalWorkspaceId) {
    const [mRows] = await pool.query('SELECT user_id FROM workspace_members WHERE workspace_id = ?', [finalWorkspaceId]);
    mRows.forEach((m) => statsCache.invalidate(m.user_id + '_' + finalWorkspaceId));
  } else {
    statsCache.invalidate(req.userId + '_personal');
  }

  res.status(201).json({ imported: values.length, skipped: arrayList.length - values.length });
});

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

// GET /api/tasks/:id/history
const getTaskHistory = asyncHandler(async (req, res) => {
  const task = await checkTaskAccess(req.params.id, req.userId);
  if (!task) {
    throw new AppError('Tâche introuvable.', 404);
  }

  const [rows] = await pool.query(
    `SELECT ta.*, u.name as user_name 
     FROM task_audit ta 
     LEFT JOIN users u ON ta.user_id = u.id 
     WHERE ta.task_id = ? 
     ORDER BY ta.created_at DESC`,
    [req.params.id]
  );
  res.json(rows);
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
  importTasks,
  getTaskHistory
};

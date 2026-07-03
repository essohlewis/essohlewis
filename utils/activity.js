const pool = require('../config/db');

// Enregistre une entrée dans le journal d'activité (alimente le fil d'actualité).
// Best effort : une erreur ici ne doit jamais faire échouer l'action principale.
async function logActivity(userId, type, taskId = null, taskTitle = null) {
  try {
    await pool.query(
      'INSERT INTO activities (user_id, type, task_id, task_title) VALUES (?, ?, ?, ?)',
      [userId, type, taskId, taskTitle ? String(taskTitle).slice(0, 200) : null]
    );
  } catch (err) {
    console.error('⚠️ Journalisation d\'activité échouée :', err.message);
  }
}

module.exports = { logActivity };

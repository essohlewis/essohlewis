// Rappels d'échéance automatiques.
//
// Un job périodique (démarré dans server.js) balaye les tâches dont l'échéance
// est dépassée ou proche et envoie une notification à leur propriétaire, via le
// même canal que le reste de l'app (persistée en base + push SSE temps réel).
//
// Anti-doublon : une fois la notification envoyée pour une tâche, on horodate
// `due_reminded_at`. On ne re-notifie donc pas à chaque passage. Le rappel est
// « réarmé » (remise à NULL) uniquement quand l'utilisateur change l'échéance
// de la tâche (voir updateTask), ce qui redéclenche un rappel pertinent.

// Nombre de jours d'anticipation (échéance « proche »).
const DEFAULT_DAYS = Number(process.env.DUE_REMINDER_DAYS) || 1;

function reminderMessage(row) {
  const title = row.title || 'Sans titre';
  if (row.kind === 'overdue') {
    return `⏰ Rappel : la tâche « ${title} » est en retard.`;
  }
  return `⏰ Rappel : la tâche « ${title} » arrive à échéance bientôt.`;
}

// Balaye les tâches à rappeler et envoie une notification par tâche.
// `notify(userId, type, message)` est injecté (createAndSendNotification en prod,
// une fonction espionne dans les tests) → module testable sans coupler au SSE.
// Retourne le nombre de rappels envoyés.
async function runDueReminderScan(pool, notify, { days = DEFAULT_DAYS } = {}) {
  const [rows] = await pool.query(
    `SELECT id, user_id, title,
            CASE WHEN due_date < CURDATE() THEN 'overdue' ELSE 'soon' END AS kind
       FROM tasks
      WHERE status <> 'terminee'
        AND is_archived = false
        AND due_date IS NOT NULL
        AND due_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
        AND due_reminded_at IS NULL`,
    [days]
  );

  let sent = 0;
  for (const row of rows) {
    try {
      await notify(row.user_id, 'reminder', reminderMessage(row));
      await pool.query('UPDATE tasks SET due_reminded_at = NOW() WHERE id = ?', [row.id]);
      sent += 1;
    } catch (err) {
      // Best effort : un échec sur une tâche ne doit pas interrompre le balayage.
      console.error(`⚠️ Rappel d'échéance échoué pour la tâche ${row.id} :`, err.message);
    }
  }
  return sent;
}

module.exports = { runDueReminderScan, reminderMessage, DEFAULT_DAYS };

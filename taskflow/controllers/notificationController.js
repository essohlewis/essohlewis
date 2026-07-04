const pool = require('../config/db');
const asyncHandler = require('../middleware/asyncHandler');

// Stocke les connexions SSE actives : userId -> Set of Response objects
const activeClients = new Map();

// Envoie une notification à un utilisateur (sauvegarde en base + push temps réel si connecté)
async function createAndSendNotification(userId, type, message) {
  try {
    const [result] = await pool.query(
      'INSERT INTO notifications (user_id, message, type) VALUES (?, ?, ?)',
      [userId, message, type]
    );
    
    const insertId = result.insertId;
    const payload = { id: insertId, type, message, created_at: new Date().toISOString(), read_status: 0 };
    
    const userSockets = activeClients.get(Number(userId));
    if (userSockets && userSockets.size > 0) {
      const data = `data: ${JSON.stringify(payload)}\n\n`;
      for (const res of userSockets) {
        res.write(data);
      }
    }
  } catch (err) {
    console.error('⚠️ Erreur d\'envoi de la notification :', err.message);
  }
}

// Route d'abonnement SSE stream
const streamNotifications = (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Content-Encoding': 'none'
  });
  res.write('\n'); // Premier ping de connexion

  const userId = Number(req.userId);
  if (!activeClients.has(userId)) {
    activeClients.set(userId, new Set());
  }
  activeClients.get(userId).add(res);

  // Ping régulier de 30 secondes pour maintenir la connexion ouverte
  const keepAliveInterval = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepAliveInterval);
    const userSockets = activeClients.get(userId);
    if (userSockets) {
      userSockets.delete(res);
      if (userSockets.size === 0) {
        activeClients.delete(userId);
      }
    }
  });
};

// GET /api/notifications
const getNotifications = asyncHandler(async (req, res) => {
  const [rows] = await pool.query(
    'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [req.userId]
  );
  res.json(rows);
});

// PATCH /api/notifications/:id/read
const markAsRead = asyncHandler(async (req, res) => {
  const [result] = await pool.query(
    'UPDATE notifications SET read_status = 1 WHERE id = ? AND user_id = ?',
    [req.params.id, req.userId]
  );
  if (result.affectedRows === 0) {
    return res.status(404).json({ message: 'Notification introuvable.' });
  }
  res.json({ message: 'Notification marquée comme lue.' });
});

// POST /api/notifications/mark-all-read
const markAllRead = asyncHandler(async (req, res) => {
  await pool.query(
    'UPDATE notifications SET read_status = 1 WHERE user_id = ?',
    [req.userId]
  );
  res.json({ message: 'Toutes les notifications marquées comme lues.' });
});

module.exports = {
  streamNotifications,
  createAndSendNotification,
  getNotifications,
  markAsRead,
  markAllRead
};

const logger = require('../utils/logger');

class SocketService {
  constructor(io) {
    this.io = io;
    this.userSockets = new Map(); // Map userId -> Set of socket IDs
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Middleware pour authentifier les connexions Socket.io
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        // Vérifier le token JWT
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.userName = decoded.userName || 'Anonymous';

        next();
      } catch (err) {
        logger.warn('Socket authentication failed: %s', err.message);
        next(new Error('Authentication error'));
      }
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      const userId = socket.userId;
      logger.info(`User connected: ${userId} (socket: ${socket.id})`);

      // Ajouter l'utilisateur à la Map
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId).add(socket.id);

      // Joindre une room pour l'utilisateur
      socket.join(`user:${userId}`);

      // Broadcast de présence
      this.io.emit('user:online', {
        userId,
        userName: socket.userName,
        timestamp: new Date()
      });

      // Écouter la déconnexion
      socket.on('disconnect', () => {
        logger.info(`User disconnected: ${userId} (socket: ${socket.id})`);
        
        const sockets = this.userSockets.get(userId);
        if (sockets) {
          sockets.delete(socket.id);
          if (sockets.size === 0) {
            this.userSockets.delete(userId);
            this.io.emit('user:offline', {
              userId,
              timestamp: new Date()
            });
          }
        }
      });

      // Ping/Pong pour maintenir la connexion
      socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date() });
      });
    });
  }

  // Émettre un événement à un utilisateur spécifique
  emitToUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, {
      ...data,
      timestamp: new Date()
    });
  }

  // Émettre un événement à tous les utilisateurs d'un workspace
  emitToWorkspace(workspaceId, event, data) {
    this.io.to(`workspace:${workspaceId}`).emit(event, {
      ...data,
      timestamp: new Date()
    });
  }

  // Émettre à tous les utilisateurs connectés
  emitToAll(event, data) {
    this.io.emit(event, {
      ...data,
      timestamp: new Date()
    });
  }

  // Vérifier si un utilisateur est connecté
  isUserOnline(userId) {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
  }

  // Obtenir le nombre d'utilisateurs connectés
  getOnlineUserCount() {
    return this.userSockets.size;
  }

  // Obtenir la liste des utilisateurs connectés
  getOnlineUsers() {
    return Array.from(this.userSockets.keys());
  }
}

module.exports = SocketService;

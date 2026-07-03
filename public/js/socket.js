// Socket.io Client Library
// Gère la connexion temps réel et les événements de tâches

class TaskFlowSocket {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.listeners = new Map();
  }

  // Connecter au serveur Socket.io
  connect(token) {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${window.location.hostname}:${window.location.port}`;

    this.socket = io({
      auth: {
        token
      },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    // Événements de connexion
    this.socket.on('connect', () => {
      console.log('✅ Connected to Socket.io');
      this.connected = true;
      this.emit('socket:connected');
    });

    this.socket.on('disconnect', () => {
      console.warn('❌ Disconnected from Socket.io');
      this.connected = false;
      this.emit('socket:disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Événements utilisateur (présence)
    this.socket.on('user:online', (data) => {
      console.log(`👤 User online: ${data.userName}`);
      this.emit('user:online', data);
    });

    this.socket.on('user:offline', (data) => {
      console.log(`👤 User offline: ${data.userId}`);
      this.emit('user:offline', data);
    });

    // Événements de tâches
    this.socket.on('task:created', (data) => {
      console.log(`➕ Task created: ${data.task.title}`);
      this.emit('task:created', data);
    });

    this.socket.on('task:updated', (data) => {
      console.log(`✏️ Task updated: ${data.task.title}`);
      this.emit('task:updated', data);
    });

    this.socket.on('task:deleted', (data) => {
      console.log(`❌ Task deleted: ${data.task.title}`);
      this.emit('task:deleted', data);
    });

    // Événements de commentaires
    this.socket.on('comment:added', (data) => {
      console.log(`💬 Comment added on task ${data.taskId}`);
      this.emit('comment:added', data);
    });

    this.socket.on('comment:deleted', (data) => {
      console.log(`💬 Comment deleted from task ${data.taskId}`);
      this.emit('comment:deleted', data);
    });

    // Événements de réactions
    this.socket.on('reaction:added', (data) => {
      console.log(`😊 Reaction added: ${data.emoji}`);
      this.emit('reaction:added', data);
    });

    this.socket.on('reaction:removed', (data) => {
      console.log(`😊 Reaction removed: ${data.emoji}`);
      this.emit('reaction:removed', data);
    });

    // Ping/Pong pour maintenir la connexion
    setInterval(() => {
      if (this.connected && this.socket) {
        this.socket.emit('ping');
      }
    }, 30000); // Toutes les 30 secondes
  }

  // Écouter les événements locaux
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  // Émettre les événements locaux
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  // Déconnecter
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }

  // Vérifier la connexion
  isConnected() {
    return this.connected && this.socket && this.socket.connected;
  }
}

// Instance globale
const taskFlowSocket = new TaskFlowSocket();

// Exporter pour les modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = taskFlowSocket;
}

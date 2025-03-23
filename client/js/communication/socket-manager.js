/**
 * Manages Socket.IO connection and events
 */
export class SocketManager {
  /**
   * @param {EventBus} eventBus - Application event bus
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.socket = window.SocketIOLib();
    this.sessionId = null;
    this.mobileSocketId = null;
    this.eventHandlers = new Map();
    this.setupEventListeners();
  }

  /**
   * Set up Socket.IO event listeners
   */
  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to signaling server with ID:', this.socket.id);
      
      // Check if this is the mobile page (play.html)
      const isMobilePage = window.location.pathname.includes('/play');
      
      if (!isMobilePage) {
        // Only desktop clients should register as desktop
        this.socket.emit('register-desktop');
      }
      
      this.eventBus.emit('socket:connected', { socketId: this.socket.id });
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
      this.eventBus.emit('socket:disconnected');
    });

    // Session and mobile device pairing
    this.socket.on('session-created', (data) => {
      this.sessionId = data.sessionId;
      console.log('Session created with ID:', this.sessionId);
      this.eventBus.emit('session:created', { sessionId: this.sessionId });
    });

    this.socket.on('mobile-joined', (data) => {
      this.mobileSocketId = data.mobileSocketId;
      console.log('Mobile device joined with socket ID:', this.mobileSocketId);
      this.eventBus.emit('mobile:joined', { mobileSocketId: this.mobileSocketId });
    });

    this.socket.on('mobile-disconnected', () => {
      console.log('Mobile device disconnected');
      this.eventBus.emit('mobile:disconnected');
    });

    // WebRTC signaling events
    this.socket.on('webrtc-offer', (data) => {
      this.eventBus.emit('webrtc:received-offer', data);
    });

    this.socket.on('webrtc-answer', (data) => {
      this.eventBus.emit('webrtc:received-answer', data);
    });

    this.socket.on('webrtc-ice-candidate', (data) => {
      this.eventBus.emit('webrtc:received-ice-candidate', data);
    });

    // Calibration events
    this.socket.on('calibration-complete', (data) => {
      this.eventBus.emit('calibration:complete', data);
    });

    this.socket.on('calibration-failed', (data) => {
      this.eventBus.emit('calibration:failed', data);
    });
    
    // Multiplayer events
    const multiplayer = [
      'game-state-update',
      'rooms-list',
      'room-created',
      'room-joined',
      'room-left',
      'room-error',
      'player-joined',
      'player-left',
      'host-changed',
      'physics:state',
      'physics:object-created',
      'physics:object-pickup',
      'physics:object-drop',
      'physics:apply-force'
    ];
    
    // Set up handlers for all multiplayer events
    multiplayer.forEach(eventName => {
      this.socket.on(eventName, (data) => {
        // Call any registered event handlers
        if (this.eventHandlers.has(eventName)) {
          this.eventHandlers.get(eventName).forEach(handler => handler(data));
        }
      });
    });
  }

  /**
   * Register a handler for a Socket.IO event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   */
  on(event, callback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(callback);
  }
  
  /**
   * Remove a handler for a Socket.IO event
   * @param {string} event - Event name
   * @param {Function} callback - Callback function to remove
   */
  off(event, callback) {
    if (!this.eventHandlers.has(event)) return;
    
    const handlers = this.eventHandlers.get(event);
    const index = handlers.indexOf(callback);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  /**
   * Emit a Socket.IO event
   * @param {string} event - Event name
   * @param {any} data - Event data
   */
  emit(event, data) {
    if (this.socket && this.socket.connected) {
      this.socket.emit(event, data);
      return true;
    }
    return false;
  }

  /**
   * Get the current session ID
   * @returns {string} Session ID
   */
  getSessionId() {
    return this.sessionId;
  }

  /**
   * Get the mobile socket ID
   * @returns {string} Mobile socket ID
   */
  getMobileSocketId() {
    return this.mobileSocketId;
  }
  
  /**
   * Check if socket is connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.socket && this.socket.connected;
  }
}
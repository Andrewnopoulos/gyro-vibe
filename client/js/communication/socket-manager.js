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
    this.setupEventListeners();
  }

  /**
   * Set up Socket.IO event listeners
   */
  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('Connected to signaling server with ID:', this.socket.id);
      this.socket.emit('register-desktop');
      this.eventBus.emit('socket:connected', { socketId: this.socket.id });
    });

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
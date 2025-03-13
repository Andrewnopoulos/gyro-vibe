import { DEBUG_CONFIG } from '../config.js';

/**
 * Debug panel for multiplayer testing
 */
export class DebugPanel {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {GameStateManager} gameStateManager - Game state manager
   */
  constructor(eventBus, gameStateManager) {
    this.eventBus = eventBus;
    this.gameStateManager = gameStateManager;
    this.panel = null;
    
    if (DEBUG_CONFIG.ENABLE_MULTIPLAYER_DEBUG) {
      this.createDebugPanel();
      this.setupEventListeners();
      
      // Auto-join debug room if enabled
      if (DEBUG_CONFIG.AUTO_JOIN_DEBUG_ROOM) {
        // Wait a bit to ensure everything is initialized
        setTimeout(() => {
          this.createDebugRoom();
        }, 1000);
      }
    }
  }
  
  /**
   * Create debug panel UI
   */
  createDebugPanel() {
    // Create debug panel container
    this.panel = document.createElement('div');
    this.panel.id = 'debug-panel';
    this.panel.style.position = 'absolute';
    this.panel.style.top = '10px';
    this.panel.style.left = '10px';
    this.panel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
    this.panel.style.color = 'white';
    this.panel.style.padding = '10px';
    this.panel.style.borderRadius = '5px';
    this.panel.style.zIndex = '1000';
    this.panel.style.fontFamily = 'monospace';
    this.panel.style.fontSize = '12px';
    this.panel.style.maxWidth = '300px';
    
    // Create title
    const title = document.createElement('div');
    title.textContent = 'MULTIPLAYER DEBUG MODE';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '10px';
    title.style.textAlign = 'center';
    title.style.color = '#ff0';
    this.panel.appendChild(title);
    
    // Create debug controls
    const controls = document.createElement('div');
    controls.style.display = 'flex';
    controls.style.flexDirection = 'column';
    controls.style.gap = '5px';
    
    // Create/join room buttons
    const roomControls = document.createElement('div');
    roomControls.style.display = 'flex';
    roomControls.style.gap = '5px';
    roomControls.style.marginBottom = '5px';
    
    const createRoomBtn = document.createElement('button');
    createRoomBtn.textContent = 'Create Room';
    createRoomBtn.style.flex = '1';
    createRoomBtn.onclick = () => this.createDebugRoom();
    roomControls.appendChild(createRoomBtn);
    
    const joinRoomInput = document.createElement('input');
    joinRoomInput.type = 'text';
    joinRoomInput.placeholder = 'Room Code';
    joinRoomInput.style.width = '80px';
    joinRoomInput.style.padding = '3px';
    roomControls.appendChild(joinRoomInput);
    
    const joinRoomBtn = document.createElement('button');
    joinRoomBtn.textContent = 'Join';
    joinRoomBtn.onclick = () => {
      const roomCode = joinRoomInput.value.trim();
      if (roomCode) {
        this.gameStateManager.joinRoom(roomCode, DEBUG_CONFIG.DEBUG_USERNAME);
      }
    };
    roomControls.appendChild(joinRoomBtn);
    
    controls.appendChild(roomControls);
    
    // Toggle first-person button
    const toggleFpBtn = document.createElement('button');
    toggleFpBtn.textContent = 'Toggle First Person Mode';
    toggleFpBtn.onclick = () => {
      this.eventBus.emit('debug:toggle-first-person');
    };
    controls.appendChild(toggleFpBtn);
    
    // Leave room button
    const leaveRoomBtn = document.createElement('button');
    leaveRoomBtn.textContent = 'Leave Room';
    leaveRoomBtn.onclick = () => {
      this.gameStateManager.leaveRoom();
    };
    controls.appendChild(leaveRoomBtn);
    
    // Status display
    this.statusDisplay = document.createElement('div');
    this.statusDisplay.style.marginTop = '10px';
    this.statusDisplay.style.padding = '5px';
    this.statusDisplay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    this.statusDisplay.style.borderRadius = '3px';
    this.statusDisplay.style.fontSize = '11px';
    this.statusDisplay.textContent = 'Not connected to any room';
    
    // Add sections to panel
    this.panel.appendChild(controls);
    this.panel.appendChild(this.statusDisplay);
    
    // Add to document
    document.body.appendChild(this.panel);
    
    console.log('Debug panel created');
  }
  
  /**
   * Setup event listeners for room/game state events
   */
  setupEventListeners() {
    this.eventBus.on('multiplayer:room-created', (data) => {
      this.updateStatus(`Created room: ${data.room.roomName} (Code: ${data.room.roomCode})`);
    });
    
    this.eventBus.on('multiplayer:room-joined', (data) => {
      this.updateStatus(`Joined room: ${data.room.roomName} (Code: ${data.room.roomCode})`);
    });
    
    this.eventBus.on('multiplayer:room-left', () => {
      this.updateStatus('Left room');
    });
    
    this.eventBus.on('multiplayer:room-error', (data) => {
      this.updateStatus(`Error: ${data.error}`, true);
    });
    
    this.eventBus.on('multiplayer:player-joined', (data) => {
      this.updateStatus(`Player joined: ${data.player.username}`);
    });
    
    this.eventBus.on('multiplayer:player-left', (data) => {
      this.updateStatus(`Player left: ${data.player.username}`);
    });
  }
  
  /**
   * Create a debug room
   */
  createDebugRoom() {
    this.gameStateManager.createRoom(DEBUG_CONFIG.DEBUG_USERNAME, DEBUG_CONFIG.DEBUG_ROOM_NAME);
  }
  
  /**
   * Update status display
   * @param {string} message - Status message
   * @param {boolean} isError - Whether this is an error message
   */
  updateStatus(message, isError = false) {
    if (!this.statusDisplay) return;
    
    const timestamp = new Date().toLocaleTimeString();
    const formattedMessage = `[${timestamp}] ${message}`;
    
    if (isError) {
      this.statusDisplay.innerHTML = `<span style="color: #f77;">${formattedMessage}</span><br>${this.statusDisplay.innerHTML}`;
    } else {
      this.statusDisplay.innerHTML = `${formattedMessage}<br>${this.statusDisplay.innerHTML}`;
    }
    
    // Trim status display if it gets too long
    const lines = this.statusDisplay.innerHTML.split('<br>');
    if (lines.length > 10) {
      this.statusDisplay.innerHTML = lines.slice(0, 10).join('<br>');
    }
  }
}
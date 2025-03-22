import { DEBUG_CONFIG } from '../config.js';

/**
 * Debug panel for multiplayer testing and physics controls
 */
export class DebugPanel {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {GameStateManager} gameStateManager - Game state manager
   * @param {PhysicsManager} physicsManager - Physics manager (optional)
   */
  constructor(eventBus, gameStateManager, physicsManager = null) {
    this.eventBus = eventBus;
    this.gameStateManager = gameStateManager;
    this.physicsManager = physicsManager;
    this.panel = null;
    this.physicsUtils = null; // Will be set via event if available
    
    if (DEBUG_CONFIG.ENABLE_MULTIPLAYER_DEBUG || physicsManager) {
      this.createDebugPanel();
      this.setupEventListeners();
      
      // Auto-join debug room if enabled
      if (DEBUG_CONFIG.AUTO_JOIN_DEBUG_ROOM) {
        // Wait a bit to ensure everything is initialized
        setTimeout(() => {
          this.createDebugRoom();
        }, 1000);
      }
      
      // Auto-start gyro simulation if enabled
      if (DEBUG_CONFIG.SIMULATE_GYRO) {
        setTimeout(() => {
          this.startGyroSimulation();
        }, 1500);
      }
      
      // Request physics utils reference
      this.eventBus.emit('physics:request-utils', (utils) => {
        if (utils) {
          this.physicsUtils = utils;
        }
      });
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
    title.textContent = 'DEBUG MODE';
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
    
    // Add gravity gun controls if physics manager is available
    if (this.physicsManager) {
      this.addGravityGunControls(controls);
    }
    
    // Only add multiplayer controls if enabled
    if (DEBUG_CONFIG.ENABLE_MULTIPLAYER_DEBUG) {
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
      
      // Simulate gyro movement button
      const simulateGyroBtn = document.createElement('button');
      simulateGyroBtn.textContent = 'Simulate Gyro Movement';
      simulateGyroBtn.onclick = () => {
        // Emit sample gyro data that changes over time to simulate movement
        this.startGyroSimulation();
      };
      controls.appendChild(simulateGyroBtn);
      
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
    } else {
      // Just add the controls section if we're only using physics debug
      this.panel.appendChild(controls);
    }
    
    // Add to document
    document.body.appendChild(this.panel);
    
    console.log('Debug panel created');
  }
  
  /**
   * Add gravity gun control sliders to debug panel
   * @param {HTMLElement} container - Container to add controls to
   */
  addGravityGunControls(container) {
    // Create gravity gun controls section
    const gravityGunSection = document.createElement('div');
    gravityGunSection.style.marginBottom = '10px';
    gravityGunSection.style.padding = '5px';
    gravityGunSection.style.backgroundColor = 'rgba(0, 100, 255, 0.2)';
    gravityGunSection.style.borderRadius = '3px';
    
    // Section title
    const sectionTitle = document.createElement('div');
    sectionTitle.textContent = 'GRAVITY GUN CONTROLS';
    sectionTitle.style.fontWeight = 'bold';
    sectionTitle.style.marginBottom = '5px';
    sectionTitle.style.fontSize = '11px';
    gravityGunSection.appendChild(sectionTitle);
    
    // k_p slider (stiffness)
    const kpContainer = document.createElement('div');
    kpContainer.style.display = 'flex';
    kpContainer.style.alignItems = 'center';
    kpContainer.style.marginBottom = '5px';
    
    const kpLabel = document.createElement('div');
    kpLabel.textContent = 'Stiffness (k_p):';
    kpLabel.style.flex = '1';
    kpLabel.style.fontSize = '11px';
    kpContainer.appendChild(kpLabel);
    
    const kpValue = document.createElement('div');
    kpValue.textContent = this.physicsManager.k_p || '14.5';
    kpValue.style.width = '30px';
    kpValue.style.textAlign = 'right';
    kpValue.style.fontSize = '11px';
    kpContainer.appendChild(kpValue);
    
    const kpSlider = document.createElement('input');
    kpSlider.type = 'range';
    kpSlider.min = '1';
    kpSlider.max = '30';
    kpSlider.step = '0.5';
    kpSlider.value = this.physicsManager.k_p || '14.5';
    kpSlider.style.width = '100%';
    kpSlider.style.marginTop = '3px';
    kpSlider.oninput = () => {
      const value = parseFloat(kpSlider.value);
      this.physicsManager.k_p = value;
      kpValue.textContent = value.toFixed(1);
    };
    
    // k_d slider (damping)
    const kdContainer = document.createElement('div');
    kdContainer.style.display = 'flex';
    kdContainer.style.alignItems = 'center';
    kdContainer.style.marginBottom = '5px';
    
    const kdLabel = document.createElement('div');
    kdLabel.textContent = 'Damping (k_d):';
    kdLabel.style.flex = '1';
    kdLabel.style.fontSize = '11px';
    kdContainer.appendChild(kdLabel);
    
    const kdValue = document.createElement('div');
    kdValue.textContent = this.physicsManager.k_d || '0.5';
    kdValue.style.width = '30px';
    kdValue.style.textAlign = 'right';
    kdValue.style.fontSize = '11px';
    kdContainer.appendChild(kdValue);
    
    const kdSlider = document.createElement('input');
    kdSlider.type = 'range';
    kdSlider.min = '0';
    kdSlider.max = '20';
    kdSlider.step = '0.5';
    kdSlider.value = this.physicsManager.k_d || '0.5';
    kdSlider.style.width = '100%';
    kdSlider.style.marginTop = '3px';
    kdSlider.oninput = () => {
      const value = parseFloat(kdSlider.value);
      this.physicsManager.k_d = value;
      kdValue.textContent = value.toFixed(1);
    };
    
    // Reset button
    const resetButton = document.createElement('button');
    resetButton.textContent = 'Reset to Defaults';
    resetButton.style.width = '100%';
    resetButton.style.padding = '3px';
    resetButton.style.marginTop = '5px';
    resetButton.onclick = () => {
      // Reset to defaults
      this.physicsManager.k_p = 10;
      this.physicsManager.k_d = 5;
      
      // Update sliders and values
      kpSlider.value = '10';
      kpValue.textContent = '10';
      kdSlider.value = '5';
      kdValue.textContent = '5';
    };
    
    // Add all elements to container
    gravityGunSection.appendChild(kpContainer);
    gravityGunSection.appendChild(kpSlider);
    gravityGunSection.appendChild(kdContainer);
    gravityGunSection.appendChild(kdSlider);
    gravityGunSection.appendChild(resetButton);
    
    // Add the gravity gun controls to the container
    container.appendChild(gravityGunSection);
    
    // Add physics debug section
    this.addPhysicsDebugControls(container);
  }
  
  /**
   * Add physics debug controls
   * @param {HTMLElement} container - Container to add controls to
   */
  addPhysicsDebugControls(container) {
    // Create physics debug section
    const debugSection = document.createElement('div');
    debugSection.style.marginBottom = '10px';
    debugSection.style.marginTop = '10px';
    debugSection.style.padding = '5px';
    debugSection.style.backgroundColor = 'rgba(255, 100, 0, 0.2)';
    debugSection.style.borderRadius = '3px';
    
    // Section title
    const sectionTitle = document.createElement('div');
    sectionTitle.textContent = 'PHYSICS DEBUG';
    sectionTitle.style.fontWeight = 'bold';
    sectionTitle.style.marginBottom = '5px';
    sectionTitle.style.fontSize = '11px';
    debugSection.appendChild(sectionTitle);
    
    // Toggle for physics debug wireframes
    const wireframeContainer = document.createElement('div');
    wireframeContainer.style.display = 'flex';
    wireframeContainer.style.alignItems = 'center';
    wireframeContainer.style.marginBottom = '5px';
    
    const wireframeLabel = document.createElement('div');
    wireframeLabel.textContent = 'Show Physics Wireframes:';
    wireframeLabel.style.flex = '1';
    wireframeLabel.style.fontSize = '11px';
    wireframeContainer.appendChild(wireframeLabel);
    
    const wireframeToggle = document.createElement('input');
    wireframeToggle.type = 'checkbox';
    wireframeToggle.checked = false;
    wireframeToggle.onchange = () => {
      // Toggle physics debug wireframes
      if (this.physicsUtils) {
        this.physicsUtils.toggleDebugMode(wireframeToggle.checked);
        this.updateStatus(`Physics wireframes ${wireframeToggle.checked ? 'enabled' : 'disabled'}`);
      } else {
        this.updateStatus('Physics utils not available', true);
      }
    };
    wireframeContainer.appendChild(wireframeToggle);
    
    // Add wireframe description
    const wireframeDescription = document.createElement('div');
    wireframeDescription.textContent = 'Shows wireframe representation of all physics bodies in the scene';
    wireframeDescription.style.fontSize = '10px';
    wireframeDescription.style.color = '#ccc';
    wireframeDescription.style.marginBottom = '10px';
    
    // God Mode toggle
    const godModeContainer = document.createElement('div');
    godModeContainer.style.display = 'flex';
    godModeContainer.style.alignItems = 'center';
    godModeContainer.style.marginBottom = '5px';
    
    const godModeLabel = document.createElement('div');
    godModeLabel.textContent = 'God Mode:';
    godModeLabel.style.flex = '1';
    godModeLabel.style.fontSize = '11px';
    godModeContainer.appendChild(godModeLabel);
    
    const godModeToggle = document.createElement('input');
    godModeToggle.type = 'checkbox';
    godModeToggle.checked = false;
    godModeToggle.onchange = () => {
      // Toggle god mode
      this.eventBus.emit('debug:toggle-god-mode', { enabled: godModeToggle.checked });
      this.updateStatus(`God Mode ${godModeToggle.checked ? 'enabled' : 'disabled'}`);
    };
    godModeContainer.appendChild(godModeToggle);
    
    // Add god mode description
    const godModeDescription = document.createElement('div');
    godModeDescription.textContent = 'Ignore physics collisions and fly freely in all directions (WASD + Q/E for up/down)';
    godModeDescription.style.fontSize = '10px';
    godModeDescription.style.color = '#ccc';
    godModeDescription.style.marginBottom = '5px';
    
    // Add all elements to container
    debugSection.appendChild(wireframeContainer);
    debugSection.appendChild(wireframeDescription);
    debugSection.appendChild(godModeContainer);
    debugSection.appendChild(godModeDescription);
    
    // Add the physics debug controls to the container
    container.appendChild(debugSection);
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
  
  /**
   * Start simulation of gyroscope movement
   */
  startGyroSimulation() {
    // Display status
    this.updateStatus('Starting gyro simulation');
    
    // Clear any existing interval
    if (this.gyroSimulationInterval) {
      clearInterval(this.gyroSimulationInterval);
    }
    
    // Starting values
    let alpha = 0;
    let beta = 0;
    let gamma = 0;
    
    // Emit initial gyro data
    this.eventBus.emit('sensor:gyro-updated', { alpha, beta, gamma });
    
    // Update at 30fps
    this.gyroSimulationInterval = setInterval(() => {
      // Increment angles to simulate movement
      alpha = (alpha + 2) % 360;  // Rotate around Z axis (compass)
      beta = 45 * Math.sin(Date.now() / 2000);  // Tilt forward/backward
      gamma = 30 * Math.sin(Date.now() / 1500);  // Tilt left/right
      
      // Emit gyro data
      this.eventBus.emit('sensor:gyro-updated', { alpha, beta, gamma });
      
      // Update status occasionally
      if (Math.random() < 0.1) {
        this.updateStatus(`Simulating gyro: α=${alpha.toFixed(0)}° β=${beta.toFixed(0)}° γ=${gamma.toFixed(0)}°`);
      }
    }, 33); // ~30fps
  }
}
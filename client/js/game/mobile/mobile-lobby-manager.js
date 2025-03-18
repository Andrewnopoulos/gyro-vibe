import { EventBus } from '../../utils/event-bus.js';
import { SocketManager } from '../../communication/socket-manager.js';
import { GameStateManager } from '../game-state-manager.js';
import { MobileGameManager } from './mobile-game-manager.js';

/**
 * Manages the mobile lobby and room joining functionality
 */
export class MobileLobbyManager {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {SocketManager} socketManager - Socket.IO manager
   * @param {GameStateManager} gameStateManager - Game state manager
   */
  constructor(eventBus, socketManager, gameStateManager) {
    this.eventBus = eventBus;
    this.socketManager = socketManager;
    this.gameStateManager = gameStateManager;
    this.mobileGameManager = null;
    this.availableRooms = [];
    this.roomRefreshInterval = null;

    // Room info for reconnection
    this.lastRoomCode = '';
    this.lastUsername = '';
    this.isReconnecting = false;

    // Store UI references
    this.setupUIReferences();
    this.setupEventListeners();

    // Reset gameCanvas to ensure a clean slate for WebGL
    this.resetGameCanvas();

    // Mobile clients don't need to create sessions
    // They just need to list rooms
    setTimeout(() => {
      this.refreshRoomsList();

      // Set up periodic room list refresh
      this.roomRefreshInterval = setInterval(() => {
        this.refreshRoomsList();
      }, 5000); // Refresh every 5 seconds
    }, 1000);
  }

  /**
   * Setup references to UI elements
   */
  setupUIReferences() {
    // DOM elements
    this.lobbyScreen = document.getElementById('lobbyScreen');
    this.gameScreen = document.getElementById('gameScreen');
    this.gameCanvas = document.getElementById('gameCanvas');
    this.usernameInput = document.getElementById('username-input');
    this.roomCodeInput = document.getElementById('room-code-input');
    this.joinRoomBtn = document.getElementById('join-room-btn');
    this.refreshRoomsBtn = document.getElementById('refresh-rooms-btn');
    this.roomsList = document.getElementById('rooms-list');
    this.noRoomsMessage = document.getElementById('no-rooms-message');
    this.lobbyStatusMessage = document.getElementById('lobby-status-message');
    this.connectionStatus = document.getElementById('connection-status');
    this.connectionStatusText = document.getElementById('connection-status-text');
    this.backBtn = document.getElementById('backBtn');

    // Game screen UI elements
    this.roomInfoPanel = document.getElementById('roomInfoPanel');
    this.currentRoomCode = document.getElementById('currentRoomCode');
    this.playerCount = document.getElementById('playerCount');
    this.maxPlayers = document.getElementById('maxPlayers');
    this.playerList = document.getElementById('playerList');
    this.collapseRoomInfo = document.getElementById('collapseRoomInfo');
    this.connectionIndicator = document.getElementById('connectionIndicator');
    this.connectionText = document.getElementById('connectionText');
    this.signalBars = [
      document.getElementById('signalBar1'),
      document.getElementById('signalBar2'),
      document.getElementById('signalBar3'),
      document.getElementById('signalBar4')
    ];
    this.notificationContainer = document.getElementById('notificationContainer');
  }

  /**
   * Reset the game canvas to ensure a clean WebGL context
   */
  resetGameCanvas() {
    try {
      // Find the canvas or its container
      let canvasContainer;
      if (this.gameCanvas) {
        canvasContainer = this.gameCanvas.parentElement;
      } else {
        // Try to find canvas container if gameCanvas reference is missing
        canvasContainer = document.querySelector('.canvas-container');
      }

      if (!canvasContainer) {
        console.warn("Cannot reset canvas: container not found");
        return;
      }

      // Find existing canvas within the container
      const existingCanvas = canvasContainer.querySelector('#gameCanvas');
      if (existingCanvas) {
        // Remove old canvas
        canvasContainer.removeChild(existingCanvas);
      }

      // Create fresh canvas
      const newCanvas = document.createElement('canvas');
      newCanvas.id = 'gameCanvas';
      newCanvas.style.width = '100%';
      newCanvas.style.height = '100%';

      // Add to container
      canvasContainer.appendChild(newCanvas);

      // Update reference
      this.gameCanvas = newCanvas;
      console.log("Canvas reset for clean WebGL context");

      // Force a layout recalculation to ensure dimensions are updated
      void canvasContainer.offsetHeight;
    } catch (error) {
      console.error("Error resetting canvas:", error);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Socket connection events
    this.eventBus.on('socket:connected', this.handleSocketConnected.bind(this));
    this.eventBus.on('socket:disconnected', this.handleSocketDisconnected.bind(this));

    // Multiplayer events
    this.eventBus.on('multiplayer:rooms-list', this.handleRoomsList.bind(this));
    this.eventBus.on('multiplayer:room-joined', this.handleRoomJoined.bind(this));
    this.eventBus.on('multiplayer:room-left', this.handleRoomLeft.bind(this));
    this.eventBus.on('multiplayer:room-error', this.handleRoomError.bind(this));
    this.eventBus.on('multiplayer:player-joined', this.handlePlayerJoined.bind(this));
    this.eventBus.on('multiplayer:player-left', this.handlePlayerLeft.bind(this));

    // UI event listeners
    if (this.joinRoomBtn) {
      this.joinRoomBtn.addEventListener('click', () => this.handleJoinRoom());
    }

    if (this.refreshRoomsBtn) {
      this.refreshRoomsBtn.addEventListener('click', () => this.refreshRoomsList());
    }

    if (this.backBtn) {
      this.backBtn.addEventListener('click', () => this.handleLeaveRoom());
    }

    if (this.collapseRoomInfo) {
      this.collapseRoomInfo.addEventListener('click', () => this.toggleRoomInfoPanel());
    }

    // Forward sensor events to event bus
    window.addEventListener('deviceorientation', (event) => {
      const orientationData = {
        alpha: event.alpha || 0,
        beta: event.beta || 0,
        gamma: event.gamma || 0
      };

      this.eventBus.emit('sensor:gyro-updated', orientationData);
    });

    window.addEventListener('devicemotion', (event) => {
      if (event.accelerationIncludingGravity) {
        const acceleration = {
          x: event.accelerationIncludingGravity.x || 0,
          y: event.accelerationIncludingGravity.y || 0,
          z: event.accelerationIncludingGravity.z || 0
        };

        this.eventBus.emit('sensor:acceleration-updated', acceleration);
      }
    });

    // Handle canvas resizing
    window.addEventListener('resize', this.resizeCanvas.bind(this));
  }

  /**
   * Resize the canvas to match its container
   */
  resizeCanvas() {
    try {
      if (!this.gameCanvas) {
        this.gameCanvas = document.getElementById('gameCanvas');
        if (!this.gameCanvas) {
          console.warn("Cannot find gameCanvas element");
          return;
        }
      }

      const container = this.gameCanvas.parentElement;
      if (!container) {
        console.warn("Canvas has no parent element");
        return;
      }

      // Don't set canvas dimensions directly here - let WebGL handle this
      // This is important to avoid conflicts between 2D and WebGL contexts

      // Instead, we ensure the canvas has the correct CSS size
      this.gameCanvas.style.width = '100%';
      this.gameCanvas.style.height = '100%';

      console.log(`Canvas container dimensions: ${container.clientWidth}x${container.clientHeight}`);
    } catch (error) {
      console.error("Error resizing canvas:", error);
    }
  }

  /**
   * Handle room list response from server
   * @param {Object} data - Rooms list data
   */
  handleRoomsList(data) {
    this.availableRooms = data.rooms || [];
    this.updateRoomsList();
  }

  /**
   * Update the rooms list UI with available rooms
   */
  updateRoomsList() {
    // Clear existing content
    if (!this.roomsList) {
      this.roomsList = document.getElementById('rooms-list');
      if (!this.roomsList) return;
    }

    if (!this.noRoomsMessage) {
      this.noRoomsMessage = document.getElementById('no-rooms-message');
    }

    this.roomsList.innerHTML = '';

    if (this.availableRooms.length === 0) {
      if (this.noRoomsMessage) {
        this.roomsList.appendChild(this.noRoomsMessage);
      } else {
        const message = document.createElement('div');
        message.className = 'no-rooms-message';
        message.textContent = 'No rooms available. Refresh the list.';
        this.roomsList.appendChild(message);
      }
      return;
    }

    // Add rooms to list
    this.availableRooms.forEach(room => {
      const roomItem = document.createElement('div');
      roomItem.className = 'room-item';

      roomItem.innerHTML = `
        <div class="room-name">${room.roomName}</div>
        <div class="room-info">
          <span>Players: ${room.playerCount}/${room.maxPlayers}</span>
          <span class="room-code">Code: ${room.roomCode}</span>
        </div>
      `;

      roomItem.onclick = () => {
        const username = this.usernameInput.value.trim() || 'Player' + Math.floor(Math.random() * 1000);
        this.usernameInput.value = username;
        this.gameStateManager.joinRoom(room.roomCode, username);
      };

      this.roomsList.appendChild(roomItem);
    });
  }

  /**
   * Handle join room button click
   */
  handleJoinRoom() {
    const username = this.usernameInput.value.trim();
    const roomCode = this.roomCodeInput.value.trim();

    if (!username) {
      this.showLobbyError('Please enter a username');
      return;
    }

    if (!roomCode) {
      this.showLobbyError('Please enter a room code');
      return;
    }

    // Show connection status
    this.showConnectionStatus('Joining room...');

    // Check socket connection
    if (!this.socketManager.isConnected()) {
      this.showConnectionStatus('Connecting to server...');
      setTimeout(() => {
        if (!this.socketManager.isConnected()) {
          this.hideConnectionStatus();
          this.showLobbyError('Failed to connect to server. Please try again.');
          return;
        }
        this.gameStateManager.joinRoom(roomCode, username);
      }, 1500); // Give time for socket to connect
      return;
    }

    this.gameStateManager.joinRoom(roomCode, username);
  }

  /**
   * Handle leave room button click
   */
  handleLeaveRoom() {
    this.gameStateManager.leaveRoom();

    // Return to menu
    this.gameScreen.style.display = 'none';
    this.lobbyScreen.style.display = 'flex';

    // Clean up mobile game manager if it exists
    if (this.mobileGameManager) {
      this.mobileGameManager.cleanup();
      this.mobileGameManager = null;
    }

    // Resume room list refreshing
    if (!this.roomRefreshInterval) {
      this.roomRefreshInterval = setInterval(() => {
        this.refreshRoomsList();
      }, 5000);
    }
  }

  /**
   * Request the list of available rooms from the server
   */
  refreshRoomsList() {
    this.gameStateManager.listRooms();
  }

  /**
   * Handle successful room join
   * @param {Object} data - Room joined data
   */
  handleRoomJoined(data) {
    // Hide connection status
    this.hideConnectionStatus();

    // Store local player id for player list highlighting
    window.currentPlayerId = data.playerId;

    // IMPORTANT: Switch to game screen FIRST before doing anything with the canvas
    this.lobbyScreen.style.display = 'none';
    this.gameScreen.style.display = 'block';

    // Give the browser time to update the DOM before proceeding
    setTimeout(() => {
      // Always recreate the canvas for a clean WebGL context
      this.resetGameCanvas();

      // Ensure we have a reference to the fresh canvas
      this.gameCanvas = document.getElementById('gameCanvas');
      const canvasContainer = document.querySelector('.canvas-container');

      if (!this.gameCanvas || !this.gameCanvas.parentElement) {
        console.warn("Canvas doesn't have a parent or doesn't exist after reset, recreating it manually");

        // If canvas exists but has no parent, remove it
        if (this.gameCanvas) {
          if (this.gameCanvas.parentElement) {
            this.gameCanvas.parentElement.removeChild(this.gameCanvas);
          } else if (document.body.contains(this.gameCanvas)) {
            document.body.removeChild(this.gameCanvas);
          }
        }

        // Create a new canvas
        this.gameCanvas = document.createElement('canvas');
        this.gameCanvas.id = 'gameCanvas';
        this.gameCanvas.style.width = '100%';
        this.gameCanvas.style.height = '100%';

        // Add to container if it exists, or to the game screen
        if (canvasContainer) {
          canvasContainer.appendChild(this.gameCanvas);
          console.log("Canvas added to canvas container");
        } else {
          this.gameScreen.appendChild(this.gameCanvas);
          console.log("Canvas added to game screen");
        }

        // Force a layout recalculation
        void (canvasContainer || this.gameScreen).offsetHeight;
      }

      // Now resize the canvas
      this.resizeCanvas();

      // Update connection status indicator
      this.updateConnectionIndicator('connected', 100);

      // Start sensor access
      this.enableSensors()
        .then(() => {
          console.log('Sensors enabled successfully');
        })
        .catch(error => {
          console.warn('Sensor access issue:', error);
          // Show a non-blocking warning
          this.showNotification('Limited sensor access. Some features may not work correctly.', 'warning');
        });

      // Stop refreshing room list while in a game
      if (this.roomRefreshInterval) {
        clearInterval(this.roomRefreshInterval);
        this.roomRefreshInterval = null;
      }

      // Save room info for potential reconnection
      this.lastRoomCode = data.room.roomCode;
      this.lastUsername = data.playerId ? (data.players.find(p => p.id === data.playerId)?.username || '') : '';

      // Create mobile game manager only after ensuring canvas is properly sized
      // Check canvas container dimensions before proceeding
      const ensureCanvasReady = () => {
        const container = this.gameCanvas?.parentElement;
        if (!container) {
          console.warn("Canvas container not found, aborting game initialization");
          return;
        }

        // Check if container has non-zero dimensions
        if (container.clientWidth > 0 && container.clientHeight > 0) {
          console.log(`Canvas container is ready with dimensions: ${container.clientWidth}x${container.clientHeight}`);

          if (!this.mobileGameManager) {
            try {
              this.mobileGameManager = new MobileGameManager(
                this.eventBus,
                this.socketManager,
                this.gameStateManager
              );
              console.log('Mobile game manager initialized with room data:', data);

              // Directly call handleRoomJoined to ensure scene initialization
              this.mobileGameManager.handleRoomJoined(data);

              // Update room info panel
              this.updateRoomInfoPanel(data);

              // Show notification
              this.showNotification(`Joined room: ${data.room.name}`, 'info');

              // If this is a reconnection, show a specific message
              if (this.isReconnecting) {
                this.showNotification('Successfully reconnected to the room!', 'info');
                this.isReconnecting = false;
              }
            } catch (error) {
              console.error('Failed to initialize mobile game manager:', error);
              this.showLobbyError('Failed to initialize game view. Please try again.');
              this.gameStateManager.leaveRoom();
            }
          }
        }
      };

      // Start the canvas readiness check
      ensureCanvasReady();
    }, 100); // Give time for the display change to take effect
  }

  /**
   * Update the room info panel with room data
   * @param {Object} data - Room data
   */
  updateRoomInfoPanel(data) {
    if (!this.currentRoomCode || !this.playerCount || !this.maxPlayers || !this.playerList) {
      this.currentRoomCode = document.getElementById('currentRoomCode');
      this.playerCount = document.getElementById('playerCount');
      this.maxPlayers = document.getElementById('maxPlayers');
      this.playerList = document.getElementById('playerList');

      if (!this.currentRoomCode || !this.playerCount || !this.maxPlayers || !this.playerList) {
        console.error("Room info panel elements not found");
        return;
      }
    }

    // Update room info panel
    this.currentRoomCode.textContent = data.room.roomCode || '----';
    this.playerCount.textContent = data.room.players && data.room.players.length ? data.room.players.length : 0;
    this.maxPlayers.textContent = data.room.maxPlayers || 8;

    // Update player list
    this.updatePlayerList(data.players);

    // Make room info panel and connection indicator visible
    if (this.roomInfoPanel) this.roomInfoPanel.style.display = 'block';
    if (this.connectionIndicator) this.connectionIndicator.style.display = 'flex';

    // Add a game message element if it doesn't exist yet
    if (!document.getElementById('game-message')) {
      const messageElement = document.createElement('div');
      messageElement.id = 'game-message';
      messageElement.style.position = 'absolute';
      messageElement.style.top = '70px';
      messageElement.style.left = '0';
      messageElement.style.width = '100%';
      messageElement.style.textAlign = 'center';
      messageElement.style.color = 'white';
      messageElement.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
      messageElement.style.padding = '8px';
      messageElement.style.zIndex = '100';
      messageElement.style.display = 'none';
      this.gameScreen.appendChild(messageElement);
    }
  }

  /**
   * Toggle the room info panel between expanded and collapsed states
   */
  toggleRoomInfoPanel() {
    if (!this.roomInfoPanel) return;

    this.roomInfoPanel.classList.toggle('collapsed');

    if (this.collapseRoomInfo) {
      this.collapseRoomInfo.textContent = this.roomInfoPanel.classList.contains('collapsed') ? '+' : '−';
    }

    // If collapsed, add click handler to expand
    if (this.roomInfoPanel.classList.contains('collapsed')) {
      this.roomInfoPanel.innerHTML = '<span class="expand-btn">+</span>';
      this.roomInfoPanel.addEventListener('click', this.expandRoomInfoPanel.bind(this));
    } else {
      this.roomInfoPanel.removeEventListener('click', this.expandRoomInfoPanel.bind(this));
    }
  }

  /**
   * Expand the collapsed room info panel
   */
  expandRoomInfoPanel() {
    if (!this.roomInfoPanel) return;

    this.roomInfoPanel.classList.remove('collapsed');
    // Rebuild the panel structure
    this.roomInfoPanel.innerHTML = `
      <div class="room-info-header">
        <span class="room-code" id="currentRoomCode">${this.currentRoomCode ? this.currentRoomCode.textContent : '----'}</span>
        <span class="player-count"><span id="playerCount">${this.playerCount ? this.playerCount.textContent : '0'}</span>/<span id="maxPlayers">${this.maxPlayers ? this.maxPlayers.textContent : '8'}</span></span>
        <button class="collapse-btn" id="collapseRoomInfo">−</button>
      </div>
      <div class="player-list" id="playerList"></div>
    `;

    // Re-reference DOM elements
    this.currentRoomCode = document.getElementById('currentRoomCode');
    this.playerCount = document.getElementById('playerCount');
    this.maxPlayers = document.getElementById('maxPlayers');
    this.playerList = document.getElementById('playerList');
    this.collapseRoomInfo = document.getElementById('collapseRoomInfo');

    // Add event listener to new collapse button
    if (this.collapseRoomInfo) {
      this.collapseRoomInfo.addEventListener('click', this.toggleRoomInfoPanel.bind(this));
    }

    // Rebuild player list
    if (window.currentPlayers && this.playerList) {
      window.currentPlayers.forEach(player => {
        this.addPlayerToList(player);
      });
    }

    this.roomInfoPanel.removeEventListener('click', this.expandRoomInfoPanel.bind(this));
  }

  /**
   * Update the player list with current players
   * @param {Array} players - List of player objects
   */
  updatePlayerList(players) {
    if (!players || !this.playerList) return;

    // Store players for reference
    window.currentPlayers = players;

    // Clear existing list
    this.playerList.innerHTML = '';

    // Update count if element exists
    if (this.playerCount) {
      this.playerCount.textContent = players.length;
    }

    // Add players to list
    players.forEach(player => {
      this.addPlayerToList(player);
    });
  }

  /**
   * Add a player to the player list
   * @param {Object} player - Player data
   * @param {HTMLElement} listElement - Optional custom list element
   */
  addPlayerToList(player, listElement) {
    if (!player) return;

    const list = listElement || this.playerList;
    if (!list) return;

    const playerItem = document.createElement('div');
    playerItem.className = 'player-item';
    playerItem.dataset.playerId = player.id;

    const isCurrentPlayer = player.id === window.currentPlayerId;
    const deviceType = player.deviceType || (player.isMobilePlayer ? 'mobile' : 'desktop');

    playerItem.innerHTML = `
      <span class="player-icon ${deviceType} ${isCurrentPlayer ? 'me' : ''}"></span>
      <span class="player-name ${isCurrentPlayer ? 'me' : ''}">${player.username}</span>
    `;

    list.appendChild(playerItem);
  }

  /**
   * Handle room left event
   */
  handleRoomLeft() {
    // Return to lobby
    if (this.gameScreen) this.gameScreen.style.display = 'none';
    if (this.lobbyScreen) this.lobbyScreen.style.display = 'flex';

    // Reset room info panel
    if (this.currentRoomCode) this.currentRoomCode.textContent = '----';
    if (this.playerCount) this.playerCount.textContent = '0';
    if (this.playerList) this.playerList.innerHTML = '';

    // Hide room info panel and connection indicator in game view
    if (this.roomInfoPanel) this.roomInfoPanel.style.display = 'none';
    if (this.connectionIndicator) this.connectionIndicator.style.display = 'none';

    // Clean up connection state
    window.currentPlayerId = null;
    window.currentPlayers = null;

    // Show notification
    this.showNotification('You left the room', 'info');
  }

  /**
   * Handle room error event
   * @param {Object} data - Error data
   */
  handleRoomError(data) {
    this.showLobbyError(data.error || 'An error occurred');
  }

  /**
   * Show an error message in the lobby
   * @param {string} message - Error message
   */
  showLobbyError(message) {
    this.hideConnectionStatus();

    if (!this.lobbyStatusMessage) {
      this.lobbyStatusMessage = document.getElementById('lobby-status-message');
      if (!this.lobbyStatusMessage) return;
    }

    this.lobbyStatusMessage.textContent = message;
    this.lobbyStatusMessage.style.display = 'block';

    // Hide after 5 seconds
    setTimeout(() => {
      if (this.lobbyStatusMessage) {
        this.lobbyStatusMessage.style.display = 'none';
      }
    }, 5000);
  }

  /**
   * Show connection status spinner
   * @param {string} message - Status message
   */
  showConnectionStatus(message) {
    if (!this.connectionStatus || !this.connectionStatusText) {
      this.connectionStatus = document.getElementById('connection-status');
      this.connectionStatusText = document.getElementById('connection-status-text');
      if (!this.connectionStatus || !this.connectionStatusText) return;
    }

    this.connectionStatusText.textContent = message || 'Connecting...';
    this.connectionStatus.style.display = 'block';
  }

  /**
   * Hide connection status spinner
   */
  hideConnectionStatus() {
    if (this.connectionStatus) {
      this.connectionStatus.style.display = 'none';
    }
  }

  /**
   * Handle socket connected event
   * @param {Object} data - Connection data
   */
  handleSocketConnected(data) {
    console.log('Connected to server with socket ID:', data.socketId);

    // Update connection status
    this.updateConnectionIndicator('connected', 0);

    // Measure ping time periodically
    this.setupPingMeasurement();
  }

  /**
   * Handle socket disconnected event
   */
  handleSocketDisconnected() {
    console.log('Disconnected from server');

    // Update UI to show disconnected state
    this.updateConnectionIndicator('disconnected');

    // Show error message based on context
    if (this.mobileGameManager) {
      // If in game, show notification
      this.showNotification('Disconnected from server. Attempting to reconnect...', 'warning');
      this.attemptReconnect();
    } else {
      // If in lobby, show error
      this.showLobbyError('Disconnected from server. Please wait or refresh the page.');
      this.attemptReconnect();
    }
  }

  /**
   * Set up periodic ping measurement
   */
  setupPingMeasurement() {
    // Clear existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Ping every 15 seconds
    this.pingInterval = setInterval(() => {
      if (!this.socketManager.isConnected()) {
        this.updateConnectionIndicator('disconnected');
        return;
      }

      const startTime = Date.now();
      this.socketManager.emit('ping', { timestamp: startTime });

      // Set up one-time event handler for pong
      const pongHandler = (data) => {
        const endTime = Date.now();
        const pingTime = endTime - data.timestamp;

        // Update connection indicator
        this.updateConnectionIndicator('connected', pingTime);

        // Remove this one-time handler
        this.socketManager.off('pong', pongHandler);
      };

      this.socketManager.on('pong', pongHandler);

      // Timeout if no response
      setTimeout(() => {
        this.socketManager.off('pong', pongHandler);
        // If we didn't get a response, mark as poor connection
        this.updateConnectionIndicator('connected', 500);
      }, 2000);
    }, 15000);
  }

  /**
   * Attempt to reconnect to the server
   */
  attemptReconnect() {
    // Update UI to show reconnecting state
    this.updateConnectionIndicator('reconnecting');

    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    // Store room info for potential rejoin
    if (this.roomCodeInput) this.lastRoomCode = this.roomCodeInput.value.trim();
    if (this.usernameInput) this.lastUsername = this.usernameInput.value.trim();

    const attemptReconnection = () => {
      if (this.socketManager.isConnected()) {
        // We're connected again, reset state
        this.updateConnectionIndicator('connected', 100);
        this.showNotification('Reconnected to server.', 'info');

        // If we were in a game, rejoin the room
        if (this.lastRoomCode && this.lastUsername) {
          this.showConnectionStatus('Rejoining room...');
          this.isReconnecting = true;
          this.gameStateManager.joinRoom(this.lastRoomCode, this.lastUsername);
        }
        return;
      }

      reconnectAttempts++;

      if (reconnectAttempts >= maxReconnectAttempts) {
        // Give up after several attempts
        this.updateConnectionIndicator('disconnected');
        this.showLobbyError('Failed to reconnect. Please refresh the page.');
        return;
      }

      // Try again in a few seconds
      setTimeout(attemptReconnection, 3000);
    };

    // Start the reconnection process after a short delay
    setTimeout(attemptReconnection, 2000);
  }

  /**
   * Update connection indicator
   * @param {string} status - Connection status
   * @param {number} pingTime - Ping time in milliseconds
   */
  updateConnectionIndicator(status = 'connecting', pingTime = 0) {
    if (!this.signalBars || !this.connectionText) {
      return;
    }

    // Reset all bars
    this.signalBars.forEach(bar => {
      if (bar) bar.className = 'signal-bar';
    });

    switch (status) {
      case 'connected':
        // Determine connection quality based on ping time
        let quality = 'good';
        let activeBars = 4;

        if (pingTime > 300) {
          quality = 'poor';
          activeBars = 2;
        } else if (pingTime > 150) {
          quality = 'medium';
          activeBars = 3;
        } else if (pingTime > 500) {
          quality = 'bad';
          activeBars = 1;
        }

        // Activate appropriate number of bars
        for (let i = 0; i < activeBars; i++) {
          if (!this.signalBars[i]) continue;

          if (quality === 'poor') {
            this.signalBars[i].classList.add('active', 'poor');
          } else if (quality === 'bad') {
            this.signalBars[i].classList.add('active', 'bad');
          } else {
            this.signalBars[i].classList.add('active');
          }
        }

        this.connectionText.textContent = `${quality.toUpperCase()} (${pingTime}ms)`;
        break;

      case 'connecting':
        // Show first bar pulsing
        if (this.signalBars[0]) this.signalBars[0].classList.add('active');
        this.connectionText.textContent = 'Connecting...';
        break;

      case 'disconnected':
        // Show red bars
        this.signalBars.forEach(bar => {
          if (bar) bar.classList.add('bad');
        });
        this.connectionText.textContent = 'Disconnected';
        break;

      case 'reconnecting':
        // Show orange first bar
        if (this.signalBars[0]) this.signalBars[0].classList.add('active', 'poor');
        this.connectionText.textContent = 'Reconnecting...';
        break;
    }
  }

  /**
   * Handle player joined event
   * @param {Object} data - Player data
   */
  handlePlayerJoined(data) {
    const player = data.player;
    console.log('Player joined:', player.username);

    // Show a notification
    this.showNotification(`${player.username} joined the room`, 'join');

    // Add player to the player list if we're in-game
    if (this.mobileGameManager) {
      // Find existing player with the same ID
      const existingPlayer = document.querySelector(`.player-item[data-player-id="${player.id}"]`);
      if (!existingPlayer && this.playerList) {
        // If not found, add to the list
        this.addPlayerToList(player);

        // Update player count
        if (this.playerCount) {
          const currentCount = parseInt(this.playerCount.textContent) || 0;
          this.playerCount.textContent = currentCount + 1;
        }
      }
    }
  }

  /**
   * Handle player left event
   * @param {Object} data - Player left data
   */
  handlePlayerLeft(data) {
    console.log('Player left:', data.playerId);

    // Get player name before removing from list
    const playerElement = document.querySelector(`.player-item[data-player-id="${data.playerId}"]`);
    let playerName = 'A player';

    if (playerElement) {
      const nameElement = playerElement.querySelector('.player-name');
      if (nameElement) {
        playerName = nameElement.textContent;
      }

      // Remove from list
      playerElement.remove();

      // Update player count
      if (this.playerCount) {
        const currentCount = parseInt(this.playerCount.textContent) || 0;
        if (currentCount > 0) {
          this.playerCount.textContent = currentCount - 1;
        }
      }
    }

    // Show notification
    this.showNotification(`${playerName} left the room`, 'leave');
  }

  /**
   * Show a notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type (info, join, leave, warning)
   */
  showNotification(message, type = 'info') {
    if (!this.notificationContainer) {
      this.notificationContainer = document.getElementById('notificationContainer');
      if (!this.notificationContainer) return;
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;

    this.notificationContainer.appendChild(notification);

    // Remove after animation completes (5 seconds)
    setTimeout(() => {
      if (notification.parentNode === this.notificationContainer) {
        this.notificationContainer.removeChild(notification);
      }
    }, 5000);
  }

  /**
   * Enable device sensors with permission handling
   * @returns {Promise} Resolves when sensors are enabled
   */
  async enableSensors() {
    // Request permission on iOS
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission();
        if (permission !== 'granted') {
          console.log('Permission denied for orientation sensors');
          throw new Error('Sensor access denied');
        }
        return true;
      } catch (err) {
        console.error('Error requesting orientation permission:', err);
        throw err;
      }
    }

    // For non-iOS devices or if permission API is not available
    return new Promise((resolve, reject) => {
      // Add a one-time event listener to check if we receive sensor data
      let sensorData = { active: false };

      const checkTimeout = setTimeout(() => {
        window.removeEventListener('deviceorientation', sensorCheckHandler);
        if (!sensorData.active) {
          reject(new Error('No sensor data received'));
        } else {
          resolve(true);
        }
      }, 2000);

      const sensorCheckHandler = (event) => {
        if (event.alpha !== null || event.beta !== null || event.gamma !== null) {
          sensorData.active = true;
          clearTimeout(checkTimeout);
          window.removeEventListener('deviceorientation', sensorCheckHandler);
          resolve(true);
        }
      };

      window.addEventListener('deviceorientation', sensorCheckHandler, { once: false });
    });
  }

  /**
   * Show a message in the game view
   * @param {string} message - Message to display
   * @param {number} duration - Duration in milliseconds
   */
  showGameMessage(message, duration = 5000) {
    const messageElement = document.getElementById('game-message');
    if (messageElement) {
      messageElement.textContent = message;
      messageElement.style.display = 'block';

      // Hide after specified duration
      if (duration > 0) {
        setTimeout(() => {
          messageElement.style.display = 'none';
        }, duration);
      }
    }
  }
}
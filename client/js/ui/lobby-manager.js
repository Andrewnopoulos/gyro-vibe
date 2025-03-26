/**
 * Manages multiplayer lobby and room UI
 */
export class LobbyManager {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {GameStateManager} gameStateManager - Game state manager
   */
  constructor(eventBus, gameStateManager) {
    this.eventBus = eventBus;
    this.gameStateManager = gameStateManager;
    this.lobbyOverlay = null;
    this.roomOverlay = null;
    this.availableRooms = [];
    this.playerListEl = null;
    this.currentRoomInfo = null;
    this.lobbyShowing = false;
    
    // Check if user is on a mobile device (but not on the /mobile endpoint)
    this.isMobileDevice = this.checkIsMobileDevice();
    
    // Only create UI if not on a mobile device
    if (!this.isMobileDevice) {
      this.createUI();
      this.setupEventListeners();
      
      // Start with lobby minimized
      this.hideLobby();
      
      // Set up the lobby toggle button
      this.lobbyToggleBtn = document.getElementById('lobbyToggleBtn');
      if (this.lobbyToggleBtn) {
        this.lobbyToggleBtn.addEventListener('click', () => {
          this.toggleLobby();
        });
      }
    } else {
      console.log('Mobile device detected. Multiplayer lobby UI disabled.');
    }
  }
  
  /**
   * Check if the current device is a mobile device not using the mobile endpoint
   * @returns {boolean} Whether the device is a mobile device
   */
  checkIsMobileDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    
    // Detect phones
    const mobileRegex = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i;
    
    // Detect tablets
    const tabletRegex = /android|ipad|playbook|silk/i;
    
    // Check if not accessing via the mobile-specific endpoint
    const isMobileEndpoint = window.location.pathname.includes('/mobile');
    
    return (mobileRegex.test(userAgent) || tabletRegex.test(userAgent)) && !isMobileEndpoint;
  }
  
  /**
   * Toggle lobby visibility
   */
  toggleLobby() {
    this.lobbyShowing = !this.lobbyShowing;
    
    if (this.lobbyShowing) {
      this.showLobby();
      
      // Hide instructions when lobby is shown
      const instructionsElement = document.getElementById('instructions');
      if (instructionsElement) {
        instructionsElement.style.display = 'none';
      }
    } else {
      this.hideLobby();
      
      // Show instructions only if QR code is visible
      const qrcodeElement = document.getElementById('qrcode');
      const instructionsElement = document.getElementById('instructions');
      if (qrcodeElement && instructionsElement) {
        if (qrcodeElement.style.display === 'block') {
          instructionsElement.style.display = 'block';
        }
      }
    }
    
    // Update button text
    if (this.lobbyToggleBtn) {
      this.lobbyToggleBtn.textContent = this.lobbyShowing ? 'Hide Multiplayer' : 'Show Multiplayer';
    }
  }
  
  /**
   * Create UI elements
   */
  createUI() {
    this.createLobbyOverlay();
    this.createRoomOverlay();
  }
  
  /**
   * Create lobby UI
   */
  createLobbyOverlay() {
    // Create lobby overlay container
    this.lobbyOverlay = document.createElement('div');
    this.lobbyOverlay.id = 'lobby-overlay';
    this.lobbyOverlay.className = 'overlay';
    this.lobbyOverlay.style.display = 'none';
    this.lobbyOverlay.style.top = '50%';
    this.lobbyOverlay.style.right = '10%';
    this.lobbyOverlay.style.left = 'auto';
    this.lobbyOverlay.style.transform = 'translateY(-50%)';
    this.lobbyOverlay.style.width = '500px';
    this.lobbyOverlay.style.maxWidth = '90%';
    this.lobbyOverlay.style.padding = '20px';
    this.lobbyOverlay.style.borderRadius = '8px';
    this.lobbyOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
    this.lobbyOverlay.style.color = 'white';
    this.lobbyOverlay.style.boxShadow = '0 0 20px rgba(0, 0, 0, 0.5)';
    this.lobbyOverlay.style.textAlign = 'center';
    this.lobbyOverlay.style.zIndex = '1000';
    
    // Create title
    const title = document.createElement('h1');
    title.textContent = 'MAGE FIGHT Multiplayer';
    title.style.margin = '0 0 20px 0';
    title.style.fontSize = '24px';
    title.style.color = '#4fc3f7';
    this.lobbyOverlay.appendChild(title);
    
    // Create username input section
    const usernameSection = document.createElement('div');
    usernameSection.style.marginBottom = '20px';
    usernameSection.style.textAlign = 'left';
    
    const usernameLabel = document.createElement('label');
    usernameLabel.textContent = 'Your Username:';
    usernameLabel.style.display = 'block';
    usernameLabel.style.marginBottom = '5px';
    usernameSection.appendChild(usernameLabel);
    
    const usernameInput = document.createElement('input');
    usernameInput.id = 'username-input';
    usernameInput.type = 'text';
    usernameInput.placeholder = 'Enter your username';
    usernameInput.style.width = '100%';
    usernameInput.style.padding = '10px';
    usernameInput.style.boxSizing = 'border-box';
    usernameInput.style.border = '1px solid #555';
    usernameInput.style.borderRadius = '4px';
    usernameInput.style.backgroundColor = 'rgba(30, 30, 30, 0.9)';
    usernameInput.style.color = 'white';
    usernameInput.style.marginBottom = '10px';
    usernameSection.appendChild(usernameInput);
    
    this.lobbyOverlay.appendChild(usernameSection);
    
    // Create "Create Room" section
    const createRoomSection = document.createElement('div');
    createRoomSection.style.marginBottom = '20px';
    createRoomSection.style.padding = '15px';
    createRoomSection.style.backgroundColor = 'rgba(50, 50, 100, 0.4)';
    createRoomSection.style.borderRadius = '8px';
    createRoomSection.style.textAlign = 'left';
    
    const createRoomTitle = document.createElement('h2');
    createRoomTitle.textContent = 'Create a New Room';
    createRoomTitle.style.margin = '0 0 10px 0';
    createRoomTitle.style.fontSize = '18px';
    createRoomSection.appendChild(createRoomTitle);
    
    const roomNameLabel = document.createElement('label');
    roomNameLabel.textContent = 'Room Name:';
    roomNameLabel.style.display = 'block';
    roomNameLabel.style.marginBottom = '5px';
    createRoomSection.appendChild(roomNameLabel);
    
    const roomNameInput = document.createElement('input');
    roomNameInput.id = 'room-name-input';
    roomNameInput.type = 'text';
    roomNameInput.placeholder = 'Enter room name';
    roomNameInput.style.width = '100%';
    roomNameInput.style.padding = '8px';
    roomNameInput.style.boxSizing = 'border-box';
    roomNameInput.style.border = '1px solid #555';
    roomNameInput.style.borderRadius = '4px';
    roomNameInput.style.backgroundColor = 'rgba(30, 30, 30, 0.9)';
    roomNameInput.style.color = 'white';
    roomNameInput.style.marginBottom = '10px';
    createRoomSection.appendChild(roomNameInput);
    
    const createRoomBtn = document.createElement('button');
    createRoomBtn.id = 'create-room-btn';
    createRoomBtn.textContent = 'Create Room';
    createRoomBtn.className = 'game-button blue';
    createRoomBtn.style.width = '100%';
    createRoomBtn.style.padding = '10px';
    createRoomBtn.style.marginTop = '5px';
    createRoomBtn.style.cursor = 'pointer';
    createRoomBtn.onclick = () => this.handleCreateRoom();
    createRoomSection.appendChild(createRoomBtn);
    
    this.lobbyOverlay.appendChild(createRoomSection);
    
    // Create "Join Room" section
    const joinRoomSection = document.createElement('div');
    joinRoomSection.style.marginBottom = '20px';
    joinRoomSection.style.textAlign = 'left';
    
    // Join by code
    const joinByCodeSection = document.createElement('div');
    joinByCodeSection.style.marginBottom = '20px';
    joinByCodeSection.style.padding = '15px';
    joinByCodeSection.style.backgroundColor = 'rgba(80, 50, 100, 0.4)';
    joinByCodeSection.style.borderRadius = '8px';
    
    const joinByCodeTitle = document.createElement('h2');
    joinByCodeTitle.textContent = 'Join with Room Code';
    joinByCodeTitle.style.margin = '0 0 10px 0';
    joinByCodeTitle.style.fontSize = '18px';
    joinByCodeSection.appendChild(joinByCodeTitle);
    
    const roomCodeLabel = document.createElement('label');
    roomCodeLabel.textContent = 'Room Code:';
    roomCodeLabel.style.display = 'block';
    roomCodeLabel.style.marginBottom = '5px';
    joinByCodeSection.appendChild(roomCodeLabel);
    
    const roomCodeContainer = document.createElement('div');
    roomCodeContainer.style.display = 'flex';
    roomCodeContainer.style.gap = '10px';
    
    const roomCodeInput = document.createElement('input');
    roomCodeInput.id = 'room-code-input';
    roomCodeInput.type = 'text';
    roomCodeInput.placeholder = 'Enter room code';
    roomCodeInput.style.flex = '1';
    roomCodeInput.style.padding = '8px';
    roomCodeInput.style.border = '1px solid #555';
    roomCodeInput.style.borderRadius = '4px';
    roomCodeInput.style.backgroundColor = 'rgba(30, 30, 30, 0.9)';
    roomCodeInput.style.color = 'white';
    roomCodeContainer.appendChild(roomCodeInput);
    
    const joinRoomBtn = document.createElement('button');
    joinRoomBtn.id = 'join-room-btn';
    joinRoomBtn.textContent = 'Join';
    joinRoomBtn.className = 'game-button blue';
    joinRoomBtn.style.padding = '8px 15px';
    joinRoomBtn.style.cursor = 'pointer';
    joinRoomBtn.onclick = () => this.handleJoinRoom();
    roomCodeContainer.appendChild(joinRoomBtn);
    
    joinByCodeSection.appendChild(roomCodeContainer);
    joinRoomSection.appendChild(joinByCodeSection);
    
    // Available rooms list
    const availableRoomsSection = document.createElement('div');
    availableRoomsSection.style.padding = '15px';
    availableRoomsSection.style.backgroundColor = 'rgba(50, 80, 50, 0.4)';
    availableRoomsSection.style.borderRadius = '8px';
    
    const availableRoomsTitle = document.createElement('h2');
    availableRoomsTitle.textContent = 'Available Rooms';
    availableRoomsTitle.style.margin = '0 0 10px 0';
    availableRoomsTitle.style.fontSize = '18px';
    availableRoomsSection.appendChild(availableRoomsTitle);
    
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'refresh-rooms-btn';
    refreshBtn.textContent = 'Refresh List';
    refreshBtn.className = 'game-button gray';
    refreshBtn.style.padding = '5px 10px';
    refreshBtn.style.marginBottom = '10px';
    refreshBtn.style.cursor = 'pointer';
    refreshBtn.onclick = () => this.refreshRoomsList();
    availableRoomsSection.appendChild(refreshBtn);
    
    const roomsListContainer = document.createElement('div');
    roomsListContainer.id = 'rooms-list';
    roomsListContainer.style.maxHeight = '200px';
    roomsListContainer.style.overflowY = 'auto';
    roomsListContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.2)';
    roomsListContainer.style.borderRadius = '4px';
    roomsListContainer.style.padding = '5px';
    roomsListContainer.style.marginTop = '5px';
    availableRoomsSection.appendChild(roomsListContainer);
    
    const noRoomsMessage = document.createElement('div');
    noRoomsMessage.id = 'no-rooms-message';
    noRoomsMessage.textContent = 'No rooms available. Create one or refresh the list.';
    noRoomsMessage.style.padding = '10px';
    noRoomsMessage.style.textAlign = 'center';
    noRoomsMessage.style.color = '#888';
    noRoomsMessage.style.fontStyle = 'italic';
    roomsListContainer.appendChild(noRoomsMessage);
    
    joinRoomSection.appendChild(availableRoomsSection);
    this.lobbyOverlay.appendChild(joinRoomSection);
    
    // Status message area
    const statusMessage = document.createElement('div');
    statusMessage.id = 'lobby-status-message';
    statusMessage.style.marginTop = '10px';
    statusMessage.style.color = '#ff5555';
    statusMessage.style.minHeight = '20px';
    statusMessage.style.display = 'none';
    this.lobbyOverlay.appendChild(statusMessage);
    
    // Add to document
    document.body.appendChild(this.lobbyOverlay);
  }
  
  /**
   * Create room UI
   */
  createRoomOverlay() {
    // Create room overlay container
    this.roomOverlay = document.createElement('div');
    this.roomOverlay.id = 'room-overlay';
    this.roomOverlay.className = 'overlay';
    this.roomOverlay.style.display = 'none';
    this.roomOverlay.style.top = '10px';
    this.roomOverlay.style.right = '10px';
    this.roomOverlay.style.left = 'auto';
    this.roomOverlay.style.transform = 'none';
    this.roomOverlay.style.width = '300px';
    this.roomOverlay.style.padding = '15px';
    this.roomOverlay.style.borderRadius = '8px';
    this.roomOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    this.roomOverlay.style.color = 'white';
    this.roomOverlay.style.zIndex = '25'; // Higher than QR code but not covering status/controls
    
    // Room info
    const roomInfoContainer = document.createElement('div');
    roomInfoContainer.style.marginBottom = '15px';
    
    const roomTitle = document.createElement('div');
    roomTitle.id = 'room-title';
    roomTitle.style.fontSize = '18px';
    roomTitle.style.fontWeight = 'bold';
    roomTitle.style.marginBottom = '5px';
    roomTitle.style.color = '#4fc3f7';
    roomInfoContainer.appendChild(roomTitle);
    
    const roomCode = document.createElement('div');
    roomCode.style.fontSize = '14px';
    roomCode.style.marginBottom = '10px';
    roomCode.innerHTML = 'Room Code: <span id="room-code" style="font-family: monospace; background-color: rgba(255,255,255,0.1); padding: 2px 5px; border-radius: 3px;"></span>';
    roomInfoContainer.appendChild(roomCode);
    
    this.roomOverlay.appendChild(roomInfoContainer);
    
    // Players list
    const playersContainer = document.createElement('div');
    playersContainer.style.marginBottom = '15px';
    
    const playersTitle = document.createElement('div');
    playersTitle.textContent = 'Players';
    playersTitle.style.fontSize = '16px';
    playersTitle.style.fontWeight = 'bold';
    playersTitle.style.marginBottom = '5px';
    playersTitle.style.borderBottom = '1px solid rgba(255,255,255,0.2)';
    playersTitle.style.paddingBottom = '5px';
    playersContainer.appendChild(playersTitle);
    
    this.playerListEl = document.createElement('div');
    this.playerListEl.id = 'players-list';
    this.playerListEl.style.maxHeight = '150px';
    this.playerListEl.style.overflowY = 'auto';
    playersContainer.appendChild(this.playerListEl);
    
    this.roomOverlay.appendChild(playersContainer);
    
    // Leave room button
    const leaveRoomBtn = document.createElement('button');
    leaveRoomBtn.id = 'leave-room-btn';
    leaveRoomBtn.textContent = 'Leave Room';
    leaveRoomBtn.className = 'game-button gray';
    leaveRoomBtn.style.width = '100%';
    leaveRoomBtn.style.padding = '8px';
    leaveRoomBtn.style.cursor = 'pointer';
    leaveRoomBtn.onclick = () => this.handleLeaveRoom();
    this.roomOverlay.appendChild(leaveRoomBtn);
    
    // Add to document
    document.body.appendChild(this.roomOverlay);
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Multiplayer events
    this.eventBus.on('multiplayer:rooms-list', this.handleRoomsList.bind(this));
    this.eventBus.on('multiplayer:room-created', this.handleRoomCreated.bind(this));
    this.eventBus.on('multiplayer:room-joined', this.handleRoomJoined.bind(this));
    this.eventBus.on('multiplayer:room-left', this.handleRoomLeft.bind(this));
    this.eventBus.on('multiplayer:room-error', this.handleRoomError.bind(this));
    this.eventBus.on('multiplayer:player-joined', this.handlePlayerJoined.bind(this));
    this.eventBus.on('multiplayer:player-left', this.handlePlayerLeft.bind(this));
    
    // Mobile device events
    this.eventBus.on('mobile:joined', this.handleMobileJoined.bind(this));
    this.eventBus.on('mobile:disconnected', this.handleMobileDisconnected.bind(this));
  }
  
  /**
   * Handle rooms list from server
   * @param {Object} data - Rooms list data
   */
  handleRoomsList(data) {
    this.availableRooms = data.rooms || [];
    this.updateRoomsList();
  }
  
  /**
   * Update rooms list UI
   */
  updateRoomsList() {
    const roomsListEl = document.getElementById('rooms-list');
    if (!roomsListEl) return;
    
    // Clear existing content
    roomsListEl.innerHTML = '';
    
    if (this.availableRooms.length === 0) {
      const noRoomsMessage = document.createElement('div');
      noRoomsMessage.id = 'no-rooms-message';
      noRoomsMessage.textContent = 'No rooms available. Create one or refresh the list.';
      noRoomsMessage.style.padding = '10px';
      noRoomsMessage.style.textAlign = 'center';
      noRoomsMessage.style.color = '#888';
      noRoomsMessage.style.fontStyle = 'italic';
      roomsListEl.appendChild(noRoomsMessage);
      return;
    }
    
    // Add rooms to list
    this.availableRooms.forEach(room => {
      const roomItem = document.createElement('div');
      roomItem.className = 'room-item';
      roomItem.style.padding = '10px';
      roomItem.style.marginBottom = '5px';
      roomItem.style.backgroundColor = 'rgba(50, 50, 80, 0.4)';
      roomItem.style.borderRadius = '4px';
      roomItem.style.cursor = 'pointer';
      roomItem.style.transition = 'background-color 0.2s';
      
      roomItem.innerHTML = `
        <div style="font-weight: bold;">${room.roomName}</div>
        <div style="font-size: 12px; margin-top: 3px;">
          <span>Players: ${room.playerCount}/${room.maxPlayers}</span>
          <span style="float: right; font-family: monospace; color: #aaf;">Code: ${room.roomCode}</span>
        </div>
      `;
      
      roomItem.onmouseover = () => {
        roomItem.style.backgroundColor = 'rgba(70, 70, 120, 0.6)';
      };
      
      roomItem.onmouseout = () => {
        roomItem.style.backgroundColor = 'rgba(50, 50, 80, 0.4)';
      };
      
      roomItem.onclick = () => {
        const usernameInput = document.getElementById('username-input');
        const username = usernameInput.value.trim() || 'Player' + Math.floor(Math.random() * 1000);
        usernameInput.value = username;
        this.gameStateManager.joinRoom(room.roomCode, username);
      };
      
      roomsListEl.appendChild(roomItem);
    });
  }
  
  /**
   * Show error message in lobby
   * @param {string} message - Error message
   */
  showLobbyError(message) {
    const statusMessage = document.getElementById('lobby-status-message');
    if (statusMessage) {
      statusMessage.textContent = message;
      statusMessage.style.display = 'block';
      
      // Hide after 5 seconds
      setTimeout(() => {
        statusMessage.style.display = 'none';
      }, 5000);
    }
  }
  
  /**
   * Handle create room button click
   */
  handleCreateRoom() {
    const usernameInput = document.getElementById('username-input');
    const roomNameInput = document.getElementById('room-name-input');
    
    const username = usernameInput.value.trim();
    const roomName = roomNameInput.value.trim();
    
    if (!username) {
      this.showLobbyError('Please enter a username');
      return;
    }
    
    // Use default room name if not specified
    const finalRoomName = roomName || `${username}'s Room`;
    roomNameInput.value = finalRoomName;
    
    this.gameStateManager.createRoom(username, finalRoomName);
  }
  
  /**
   * Handle join room button click
   */
  handleJoinRoom() {
    const usernameInput = document.getElementById('username-input');
    const roomCodeInput = document.getElementById('room-code-input');
    
    const username = usernameInput.value.trim();
    const roomCode = roomCodeInput.value.trim();
    
    if (!username) {
      this.showLobbyError('Please enter a username');
      return;
    }
    
    if (!roomCode) {
      this.showLobbyError('Please enter a room code');
      return;
    }
    
    this.gameStateManager.joinRoom(roomCode, username);
  }
  
  /**
   * Handle leave room button click
   */
  handleLeaveRoom() {
    // Emit an event before leaving the room to notify app this is a manual leave
    this.eventBus.emit('multiplayer:manual-leave-room');
    this.gameStateManager.leaveRoom();
  }
  
  /**
   * Refresh rooms list
   */
  refreshRoomsList() {
    this.gameStateManager.listRooms();
  }
  
  /**
   * Handle room created event
   * @param {Object} data - Room created data
   */
  handleRoomCreated(data) {
    this.currentRoomInfo = data.room;
    this.showRoomOverlay();
    this.updateRoomInfo();
    this.hideLobby();
    this.lobbyShowing = false;
    
    // Update toggle button text
    if (this.lobbyToggleBtn) {
      this.lobbyToggleBtn.textContent = 'Show Multiplayer';
    }
    
    // Don't hide QR code - it should stay visible until mobile device connects
    
    // Add in-room class to body for CSS styling
    document.body.classList.add('in-room');
  }
  
  /**
   * Handle room joined event
   * @param {Object} data - Room joined data
   */
  handleRoomJoined(data) {
    this.currentRoomInfo = data.room;
    this.showRoomOverlay();
    this.updateRoomInfo();
    this.updatePlayersList(data.players);
    this.hideLobby();
    this.lobbyShowing = false;
    
    // Update toggle button text
    if (this.lobbyToggleBtn) {
      this.lobbyToggleBtn.textContent = 'Show Multiplayer';
    }
    
    // Don't hide QR code - it should stay visible until mobile device connects
    
    // Add in-room class to body for CSS styling
    document.body.classList.add('in-room');
  }
  
  /**
   * Handle room left event
   */
  handleRoomLeft() {
    this.currentRoomInfo = null;
    this.hideRoomOverlay();
    this.showLobby();
    this.refreshRoomsList();
    // Don't show QR code - StatusDisplay will handle this based on mobile connection state
    
    // Remove in-room class from body
    document.body.classList.remove('in-room');
  }
  
  /**
   * Handle room error event
   * @param {Object} data - Error data
   */
  handleRoomError(data) {
    this.showLobbyError(data.error);
  }
  
  /**
   * Handle player joined event
   * @param {Object} data - Player joined data
   */
  handlePlayerJoined(data) {
    // Update players list
    if (this.gameStateManager.isInRoom()) {
      const allPlayers = Array.from(this.gameStateManager.getPlayers().values());
      allPlayers.push({ id: this.gameStateManager.getLocalPlayerId(), username: 'You (Local)' });
      this.updatePlayersList(allPlayers);
    }
  }
  
  /**
   * Handle player left event
   */
  handlePlayerLeft() {
    // Update players list
    if (this.gameStateManager.isInRoom()) {
      const allPlayers = Array.from(this.gameStateManager.getPlayers().values());
      allPlayers.push({ id: this.gameStateManager.getLocalPlayerId(), username: 'You (Local)' });
      this.updatePlayersList(allPlayers);
    }
  }
  
  /**
   * Update room info in UI
   */
  updateRoomInfo() {
    if (!this.currentRoomInfo) return;
    
    const roomTitleEl = document.getElementById('room-title');
    const roomCodeEl = document.getElementById('room-code');
    
    if (roomTitleEl) {
      roomTitleEl.textContent = this.currentRoomInfo.roomName;
    }
    
    if (roomCodeEl) {
      roomCodeEl.textContent = this.currentRoomInfo.roomCode;
    }
  }
  
  /**
   * Update players list in UI
   * @param {Array} players - Players list
   */
  updatePlayersList(players) {
    if (!this.playerListEl) return;
    
    // Clear existing list
    this.playerListEl.innerHTML = '';
    
    if (!players || players.length === 0) {
      const noPlayersMessage = document.createElement('div');
      noPlayersMessage.textContent = 'No other players in room';
      noPlayersMessage.style.padding = '10px';
      noPlayersMessage.style.textAlign = 'center';
      noPlayersMessage.style.color = '#888';
      noPlayersMessage.style.fontStyle = 'italic';
      this.playerListEl.appendChild(noPlayersMessage);
      return;
    }
    
    // Add each player to the list
    players.forEach(player => {
      const playerItem = document.createElement('div');
      playerItem.className = 'player-item';
      playerItem.style.padding = '8px';
      playerItem.style.marginBottom = '5px';
      playerItem.style.backgroundColor = 'rgba(40, 40, 60, 0.4)';
      playerItem.style.borderRadius = '4px';
      playerItem.style.display = 'flex';
      playerItem.style.alignItems = 'center';
      
      // Determine if this is the local player or host
      const isLocalPlayer = player.id === this.gameStateManager.getLocalPlayerId();
      const isHost = this.currentRoomInfo && player.id === this.currentRoomInfo.hostId;
      
      // Player icon/avatar
      const playerIcon = document.createElement('div');
      playerIcon.style.width = '20px';
      playerIcon.style.height = '20px';
      playerIcon.style.borderRadius = '50%';
      playerIcon.style.backgroundColor = isLocalPlayer ? '#4fc3f7' : '#888';
      playerIcon.style.marginRight = '10px';
      playerItem.appendChild(playerIcon);
      
      // Player name
      const playerName = document.createElement('div');
      playerName.style.flex = '1';
      
      // Display local player as "You"
      let displayName = player.username;
      if (isLocalPlayer) {
        displayName = 'You (Local)';
      }
      
      playerName.textContent = displayName;
      playerItem.appendChild(playerName);
      
      // Host badge
      if (isHost) {
        const hostBadge = document.createElement('div');
        hostBadge.textContent = 'HOST';
        hostBadge.style.fontSize = '10px';
        hostBadge.style.backgroundColor = '#ffc107';
        hostBadge.style.color = '#000';
        hostBadge.style.padding = '2px 5px';
        hostBadge.style.borderRadius = '3px';
        hostBadge.style.marginLeft = '5px';
        playerItem.appendChild(hostBadge);
      }
      
      this.playerListEl.appendChild(playerItem);
    });
  }
  
  /**
   * Handle mobile device joined
   */
  handleMobileJoined() {
    // If in a room, update mobile connection status
    if (this.gameStateManager.isInRoom()) {
      // You could add some visual indication that the mobile is connected
    }
  }
  
  /**
   * Handle mobile device disconnected
   */
  handleMobileDisconnected() {
    // If in a room, update mobile connection status
    if (this.gameStateManager.isInRoom()) {
      // You could add some visual indication that the mobile is disconnected
    }
  }
  
  /**
   * Show room overlay
   */
  showRoomOverlay() {
    // If on mobile device, don't show room overlay
    if (this.isMobileDevice) {
      return;
    }
    
    if (this.roomOverlay) {
      this.roomOverlay.style.display = 'block';
    }
  }
  
  /**
   * Hide room overlay
   */
  hideRoomOverlay() {
    // If on mobile device, no need to hide (already hidden)
    if (this.isMobileDevice) {
      return;
    }
    
    if (this.roomOverlay) {
      this.roomOverlay.style.display = 'none';
    }
  }
  
  /**
   * Show lobby overlay
   */
  showLobby() {
    // If on mobile device, don't show lobby
    if (this.isMobileDevice) {
      return;
    }
    
    if (this.lobbyOverlay) {
      this.lobbyOverlay.style.display = 'block';
      this.refreshRoomsList();
      this.lobbyShowing = true;
      
      // Update button text
      if (this.lobbyToggleBtn) {
        this.lobbyToggleBtn.textContent = 'Hide Multiplayer';
      }
    }
  }
  
  /**
   * Hide lobby overlay
   */
  hideLobby() {
    // If on mobile device, no need to hide (already hidden)
    if (this.isMobileDevice) {
      return;
    }
    
    if (this.lobbyOverlay) {
      this.lobbyOverlay.style.display = 'none';
      this.lobbyShowing = false;
      
      // Update button text
      if (this.lobbyToggleBtn) {
        this.lobbyToggleBtn.textContent = 'Show Multiplayer';
      }
      
      // Keep multiplayer section header visible even when lobby is hidden
      // This maintains consistency in the side-by-side layout
    }
  }
  
  // QR code visibility is managed by StatusDisplay based on mobile connection state
}
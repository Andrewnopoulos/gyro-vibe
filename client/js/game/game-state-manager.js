/**
 * Manages multiplayer game state
 */
export class GameStateManager {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {SocketManager} socketManager - Socket.IO manager for network communication
   */
  constructor(eventBus, socketManager) {
    this.eventBus = eventBus;
    this.socketManager = socketManager;
    this.gameState = null;
    this.localPlayerId = null;
    this.currentRoom = null;
    this.players = new Map();
    this.gameObjects = [];
    
    this.setupEventListeners();
    
    // Request available rooms when initialized
    setTimeout(() => {
      this.listRooms();
    }, 1000);
  }

  /**
   * Set up event listeners for networking events
   */
  setupEventListeners() {
    // Game state update from server
    this.socketManager.on('game-state-update', this.handleStateUpdate.bind(this));
    
    // Room management events
    this.socketManager.on('rooms-list', this.handleRoomsList.bind(this));
    this.socketManager.on('room-created', this.handleRoomCreated.bind(this));
    this.socketManager.on('room-joined', this.handleRoomJoined.bind(this));
    this.socketManager.on('room-left', this.handleRoomLeft.bind(this));
    this.socketManager.on('room-error', this.handleRoomError.bind(this));
    
    // Player events
    this.socketManager.on('player-joined', this.handlePlayerJoined.bind(this));
    this.socketManager.on('player-left', this.handlePlayerLeft.bind(this));
    this.socketManager.on('host-changed', this.handleHostChanged.bind(this));
    
    // Listen for local player updates to sync with server
    this.eventBus.on('player:local-moved', this.handleLocalPlayerMoved.bind(this));
  }

  /**
   * Handle game state update from server
   * @param {Object} data - Game state data
   */
  handleStateUpdate(data) {
    const previousState = this.gameState;
    this.gameState = data;
    
    // Update players map
    if (data.players) {
      data.players.forEach(playerData => {
        if (playerData.id !== this.localPlayerId) {
          // Update remote player
          if (this.players.has(playerData.id)) {
            this.players.get(playerData.id).lastState = playerData;
          } else {
            // New player joined
            this.players.set(playerData.id, { 
              id: playerData.id,
              username: playerData.username,
              lastState: playerData
            });
          }
        }
      });
      
      // Remove players that are no longer in the game state
      const currentPlayerIds = data.players.map(p => p.id);
      Array.from(this.players.keys()).forEach(playerId => {
        if (!currentPlayerIds.includes(playerId) && playerId !== this.localPlayerId) {
          this.players.delete(playerId);
        }
      });
    }
    
    // Update game objects
    this.gameObjects = data.gameObjects || [];
    
    // Emit event for other components to react to state update
    this.eventBus.emit('gameState:updated', {
      state: this.gameState,
      players: Array.from(this.players.values()),
      gameObjects: this.gameObjects,
      localPlayerId: this.localPlayerId
    });
  }
  
  /**
   * Handle list of available rooms
   * @param {Object} data - Rooms list data
   */
  handleRoomsList(data) {
    this.eventBus.emit('multiplayer:rooms-list', { rooms: data.rooms });
  }
  
  /**
   * Handle room creation success
   * @param {Object} data - Created room data
   */
  handleRoomCreated(data) {
    this.currentRoom = data.room;
    this.localPlayerId = data.playerId;
    
    this.eventBus.emit('multiplayer:room-created', { 
      room: data.room,
      playerId: data.playerId
    });
  }
  
  /**
   * Handle room join success
   * @param {Object} data - Room join data
   */
  handleRoomJoined(data) {
    this.currentRoom = data.room;
    this.localPlayerId = data.playerId;
    
    // Initialize players map with existing players
    if (data.players) {
      data.players.forEach(playerData => {
        if (playerData.id !== this.localPlayerId) {
          this.players.set(playerData.id, {
            id: playerData.id,
            username: playerData.username,
            lastState: playerData
          });
        }
      });
    }
    
    this.eventBus.emit('multiplayer:room-joined', {
      room: data.room,
      players: data.players,
      playerId: data.playerId
    });
  }
  
  /**
   * Handle room leave event
   */
  handleRoomLeft() {
    this.currentRoom = null;
    this.localPlayerId = null;
    this.players.clear();
    this.gameObjects = [];
    
    this.eventBus.emit('multiplayer:room-left');
  }
  
  /**
   * Handle room error
   * @param {Object} data - Error data
   */
  handleRoomError(data) {
    this.eventBus.emit('multiplayer:room-error', { error: data.error });
  }
  
  /**
   * Handle new player joined
   * @param {Object} data - New player data
   */
  handlePlayerJoined(data) {
    const { player } = data;
    
    this.players.set(player.id, {
      id: player.id,
      username: player.username,
      lastState: player
    });
    
    this.eventBus.emit('multiplayer:player-joined', { player });
  }
  
  /**
   * Handle player left
   * @param {Object} data - Player ID that left
   */
  handlePlayerLeft(data) {
    const { playerId } = data;
    
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
      this.eventBus.emit('multiplayer:player-left', { playerId, player });
    }
  }
  
  /**
   * Handle host changed event
   * @param {Object} data - New host ID data
   */
  handleHostChanged(data) {
    if (this.currentRoom) {
      this.currentRoom.hostId = data.newHostId;
      this.eventBus.emit('multiplayer:host-changed', { newHostId: data.newHostId });
    }
  }
  
  /**
   * Handle local player movement to sync with server
   * @param {Object} data - Player movement data
   */
  handleLocalPlayerMoved(data) {
    if (this.localPlayerId && this.currentRoom) {
      const updateData = {
        position: data.position,
        rotation: data.rotation
      };
      
      // Include phone orientation if available
      if (data.phoneOrientation) {
        updateData.phoneOrientation = data.phoneOrientation;
      }
      
      // Include physics state
      if (data.isJumping !== undefined) {
        updateData.isJumping = data.isJumping;
      }
      
      if (data.isGrounded !== undefined) {
        updateData.isGrounded = data.isGrounded;
      }
      
      if (data.velocity) {
        updateData.velocity = {
          x: data.velocity.x,
          y: data.velocity.y,
          z: data.velocity.z
        };
      }
      
      this.socketManager.emit('player-update', updateData);
    }
  }
  
  // Public methods for room management
  
  /**
   * Request list of available rooms
   */
  listRooms() {
    this.socketManager.emit('list-rooms');
  }
  
  /**
   * Create a new room
   * @param {string} username - Player's username
   * @param {string} roomName - Optional room name
   */
  createRoom(username, roomName = null) {
    this.socketManager.emit('create-room', { 
      username, 
      roomName
    });
  }
  
  /**
   * Join an existing room
   * @param {string} roomCode - Room code to join
   * @param {string} username - Player's username
   */
  joinRoom(roomCode, username) {
    this.socketManager.emit('join-room', { roomCode, username });
  }
  
  /**
   * Leave the current room
   */
  leaveRoom() {
    if (this.currentRoom) {
      this.socketManager.emit('leave-room');
    }
  }
  
  /**
   * Check if player is in a room
   * @returns {boolean} True if in a room
   */
  isInRoom() {
    return !!this.currentRoom;
  }
  
  /**
   * Get current room data
   * @returns {Object|null} Room data or null if not in a room
   */
  getCurrentRoom() {
    return this.currentRoom;
  }
  
  /**
   * Get all players
   * @returns {Map} Map of players
   */
  getPlayers() {
    return this.players;
  }
  
  /**
   * Get local player ID
   * @returns {string|null} Local player ID or null if not in a room
   */
  getLocalPlayerId() {
    return this.localPlayerId;
  }
}
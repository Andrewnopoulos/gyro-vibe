import * as THREE from 'three';

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

    // Physics event
    this.socketManager.on('physics:state-update', this.handlePhysicsStateUpdate.bind(this));
    
    // New events for spell casting and enemy synchronization
    this.socketManager.on('remote-spell-cast', this.handleRemoteSpellCast.bind(this));
    this.socketManager.on('enemy-spawn', this.handleEnemySpawn.bind(this));
    this.socketManager.on('enemy-update', this.handleEnemyUpdate.bind(this));
    this.socketManager.on('enemy-death', this.handleEnemyDeath.bind(this));
    
    // Listen for local player updates to sync with server
    this.eventBus.on('player:local-moved', this.handleLocalPlayerMoved.bind(this));
    
    // Listen for local spell casts to sync with server
    this.eventBus.on('spell:cast', this.handleLocalSpellCast.bind(this));
    
    // Listen for local enemy damage to sync with server
    this.eventBus.on('entity:damage', this.handleLocalEnemyDamage.bind(this));
    
    // Listen for player data lookup requests (for UI and other components)
    this.eventBus.on('multiplayer:get-player', (playerId, callback) => {
      if (typeof callback === 'function') {
        callback(this.getPlayer(playerId));
      }
    });
    
    // Listen for player position and direction requests
    this.eventBus.on('multiplayer:get-player-position', (playerId, callback) => {
      if (typeof callback === 'function') {
        callback(this.getPlayerPosition(playerId));
      }
    });
    
    this.eventBus.on('multiplayer:get-player-direction', (playerId, callback) => {
      if (typeof callback === 'function') {
        callback(this.getPlayerForwardDirection(playerId));
      }
    });
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
      
      this.socketManager.emit('player-update', updateData);
    }
  }
  
  handlePhysicsStateUpdate(data) {
    this.eventBus.emit('physics:sync', data);
  }
  
  /**
   * Handle remote spell cast event from server
   * @param {Object} data - Remote spell cast data
   */
  handleRemoteSpellCast(data) {
    const { 
      playerId, 
      spellId, 
      targetPosition, 
      targetId,
      cameraPosition,
      targetDirection,
      channelData, // Channel data for spells like Zoltraak
      initialCast // Whether this is the initial cast event
    } = data;
    
    if (playerId === this.localPlayerId) {
      // Ignore our own spells that come back from the server
      return;
    }
    
    // Log incoming cast data for debugging
    if (initialCast) {
      console.log(`Received initial spell cast for ${spellId} from player ${playerId} with position:`,
        cameraPosition ? `(${cameraPosition.x.toFixed(2)}, ${cameraPosition.y.toFixed(2)}, ${cameraPosition.z.toFixed(2)})` : 'no position');
    } else if (channelData) {
      console.log(`Received channeled spell update for ${spellId} from player ${playerId} with progress: ${channelData.channelProgress?.toFixed(2)}`);
    }
    
    // Emit event for spell system to handle visualizing the remote spell
    this.eventBus.emit('spell:remote-cast', {
      playerId,
      spellId,
      targetPosition,
      targetId,
      // Pass along camera position and direction for accurate spawning
      cameraPosition,
      targetDirection,
      // Pass along channeling data for spells that need it
      channelData,
      // Pass along whether this is an initial cast
      initialCast
    });
  }
  
  /**
   * Handle enemy spawn event from server
   * @param {Object} data - Enemy spawn data
   */
  handleEnemySpawn(data) {
    const { enemyId, type, position, health } = data;
    
    // Emit event for enemy manager to create the enemy
    this.eventBus.emit('enemy:spawn', {
      id: enemyId,
      type,
      position,
      health,
      isNetworked: true // Flag to indicate this is a network-spawned enemy
    });
  }
  
  /**
   * Handle enemy update event from server
   * @param {Object} data - Enemy update data
   */
  handleEnemyUpdate(data) {
    const { enemyId, position, health, state } = data;
    
    // Emit event for enemy manager to update the enemy
    this.eventBus.emit('enemy:update', {
      id: enemyId,
      position,
      health,
      state,
      isNetworked: true
    });
  }
  
  /**
   * Handle enemy death event from server
   * @param {Object} data - Enemy death data
   */
  handleEnemyDeath(data) {
    const { enemyId, killerPlayerId } = data;
    
    // Emit event for enemy manager to handle the death
    this.eventBus.emit('enemy:death', {
      id: enemyId,
      killerPlayerId,
      isNetworked: true
    });
  }
  
  /**
   * Handle local spell cast to sync with server
   * @param {Object} data - Spell cast data
   */
  handleLocalSpellCast(data) {
    if (this.localPlayerId && this.currentRoom) {
      const { spellId, targetPosition, targetId, cameraPosition, targetDirection, channelData } = data;
      
      // Send spell cast to server with additional positioning info
      this.socketManager.emit('spell-cast', {
        spellId,
        targetPosition,
        targetId,
        cameraPosition,
        targetDirection,
        // Include channel data for spells like Zoltraak
        channelData
      });
      
      console.log(`Local spell cast ${spellId} sent to server with positioning data`, 
        targetPosition ? `target: (${targetPosition.x.toFixed(2)}, ${targetPosition.y.toFixed(2)}, ${targetPosition.z.toFixed(2)})` : 'no target',
        cameraPosition ? `camera: (${cameraPosition.x.toFixed(2)}, ${cameraPosition.y.toFixed(2)}, ${cameraPosition.z.toFixed(2)})` : 'no camera',
        channelData ? `channelData: ${JSON.stringify(channelData)}` : ''
      );
    }
  }
  
  /**
   * Handle local enemy damage to sync with server
   * @param {Object} data - Damage data
   */
  handleLocalEnemyDamage(data) {
    if (this.localPlayerId && this.currentRoom && data.isEnemy) {
      const { id, amount, damageType, sourceId, isLocalEvent } = data;
      
      // Only send to server if this was a local-originating event
      // This prevents loops where network events trigger more network events
      if (isLocalEvent && !data.processingComplete) {
        console.log(`Sending local enemy damage to server: ${id} - Amount: ${amount}`);
        
        // Create a clean object with just the required properties for network transmission
        // This prevents circular references that could cause stack overflow
        const cleanData = {
          enemyId: id,
          damage: typeof amount === 'number' ? amount : parseFloat(amount),
          sourceType: typeof damageType === 'string' ? damageType : 'generic',
          sourceId: typeof sourceId === 'string' ? sourceId : this.localPlayerId // Use player ID as fallback source
        };
        
        // Mark that we've processed this event to prevent re-sending
        data.processingComplete = true;
        
        // Send damage to server
        this.socketManager.emit('enemy-damage', cleanData);
      }
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
   * Get player by ID
   * @param {string} playerId - ID of the player to get
   * @returns {Object|null} Player data or null if not found
   */
  getPlayer(playerId) {
    return this.players.get(playerId) || null;
  }
  
  /**
   * Get player position as a THREE.Vector3
   * @param {string} playerId - ID of the player to get position for
   * @returns {THREE.Vector3|null} Player position or null if not found
   */
  getPlayerPosition(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.lastState || !player.lastState.position) {
      console.warn(`No position data found for player ${playerId}`);
      return null;
    }
    
    const position = player.lastState.position;
    return new THREE.Vector3(position.x, position.y, position.z);
  }
  
  /**
   * Get player forward direction as a THREE.Vector3
   * @param {string} playerId - ID of the player to get direction for
   * @returns {THREE.Vector3|null} Player forward direction or null if not found
   */
  getPlayerForwardDirection(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.lastState || !player.lastState.rotation) {
      console.warn(`No rotation data found for player ${playerId}`);
      return null;
    }
    
    // Create quaternion from player rotation
    const rotation = player.lastState.rotation;
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    // Apply quaternion to forward vector to get direction
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(quaternion);
    
    return forward;
  }
  
  /**
   * Get local player ID
   * @returns {string|null} Local player ID or null if not in a room
   */
  getLocalPlayerId() {
    return this.localPlayerId;
  }
}
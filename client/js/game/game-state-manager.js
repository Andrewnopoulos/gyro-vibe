import * as THREE from 'three';

export class GameStateManager {
  constructor(eventBus, socketManager) {
    this.eventBus = eventBus;
    this.socketManager = socketManager;
    this.gameState = null;
    this.localPlayerId = null;
    this.currentRoom = null;
    this.players = new Map();
    this.gameObjects = [];
    
    this.setupEventListeners();
    
    setTimeout(() => {
      this.listRooms();
    }, 1000);
  }

  setupEventListeners() {
    this.socketManager.on('game-state-update', this.handleStateUpdate.bind(this));
    this.socketManager.on('rooms-list', this.handleRoomsList.bind(this));
    this.socketManager.on('room-created', this.handleRoomCreated.bind(this));
    this.socketManager.on('room-joined', this.handleRoomJoined.bind(this));
    this.socketManager.on('room-left', this.handleRoomLeft.bind(this));
    this.socketManager.on('room-error', this.handleRoomError.bind(this));
    this.socketManager.on('player-joined', this.handlePlayerJoined.bind(this));
    this.socketManager.on('player-left', this.handlePlayerLeft.bind(this));
    this.socketManager.on('host-changed', this.handleHostChanged.bind(this));
    this.socketManager.on('physics:state-update', this.handlePhysicsStateUpdate.bind(this));
    this.socketManager.on('remote-spell-cast', this.handleRemoteSpellCast.bind(this));
    this.socketManager.on('enemy-spawn', this.handleEnemySpawn.bind(this));
    this.socketManager.on('enemy-update', this.handleEnemyUpdate.bind(this));
    this.socketManager.on('enemy-death', this.handleEnemyDeath.bind(this));
    
    this.eventBus.on('player:local-moved', this.handleLocalPlayerMoved.bind(this));
    this.eventBus.on('spell:cast', this.handleLocalSpellCast.bind(this));
    this.eventBus.on('entity:damage', this.handleLocalEnemyDamage.bind(this));
    this.eventBus.on('multiplayer:get-player', (playerId, callback) => {
      if (typeof callback === 'function') {
        callback(this.getPlayer(playerId));
      }
    });
    
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

  handleStateUpdate(data) {
    const previousState = this.gameState;
    this.gameState = data;
    
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
      
      const currentPlayerIds = data.players.map(p => p.id);
      Array.from(this.players.keys()).forEach(playerId => {
        if (!currentPlayerIds.includes(playerId) && playerId !== this.localPlayerId) {
          this.players.delete(playerId);
        }
      });
    }
    
    this.gameObjects = data.gameObjects || [];
    this.eventBus.emit('gameState:updated', {
      state: this.gameState,
      players: Array.from(this.players.values()),
      gameObjects: this.gameObjects,
      localPlayerId: this.localPlayerId
    });
  }
  
  handleRoomsList(data) {
    this.eventBus.emit('multiplayer:rooms-list', { rooms: data.rooms });
  }
  
  handleRoomCreated(data) {
    this.currentRoom = data.room;
    this.localPlayerId = data.playerId;
    
    this.eventBus.emit('multiplayer:room-created', { 
      room: data.room,
      playerId: data.playerId
    });
  }
  
  handleRoomJoined(data) {
    this.currentRoom = data.room;
    this.localPlayerId = data.playerId;
    
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
  
  handleRoomLeft() {
    this.currentRoom = null;
    this.localPlayerId = null;
    this.players.clear();
    this.gameObjects = [];
    
    this.eventBus.emit('multiplayer:room-left');
  }
  
  handleRoomError(data) {
    this.eventBus.emit('multiplayer:room-error', { error: data.error });
  }
  
  handlePlayerJoined(data) {
    const { player } = data;
    
    this.players.set(player.id, {
      id: player.id,
      username: player.username,
      lastState: player
    });
    
    this.eventBus.emit('multiplayer:player-joined', { player });
  }
  
  handlePlayerLeft(data) {
    const { playerId } = data;
    
    const player = this.players.get(playerId);
    if (player) {
      this.players.delete(playerId);
      this.eventBus.emit('multiplayer:player-left', { playerId, player });
    }
  }
  
  handleHostChanged(data) {
    if (this.currentRoom) {
      this.currentRoom.hostId = data.newHostId;
      this.eventBus.emit('multiplayer:host-changed', { newHostId: data.newHostId });
    }
  }

  handlePhysicsStateUpdate(data) {
    this.eventBus.emit('physics:sync', data);
  }
  
  handleRemoteSpellCast(data) {
    const { 
      playerId, 
      spellId, 
      targetPosition, 
      targetId,
      cameraPosition,
      targetDirection,
      spellData
    } = data;
    
    if (playerId === this.localPlayerId) {
      // Ignore our own spells that come back from the server
      return;
    }
    
    this.eventBus.emit('spell:remote-cast', {
      playerId,
      spellId,
      targetPosition,
      targetId,
      cameraPosition,
      targetDirection,
      spellData
    });
  }
  
  handleEnemySpawn(data) {
    const { enemyId, type, position, health } = data;
    
    this.eventBus.emit('enemy:spawn', {
      id: enemyId,
      type,
      position,
      health,
      isNetworked: true
    });
  }
  
  handleEnemyUpdate(data) {
    const { enemyId, position, health, state } = data;
    
    this.eventBus.emit('enemy:update', {
      id: enemyId,
      position,
      health,
      state,
      isNetworked: true
    });
  }
  
  handleEnemyDeath(data) {
    const { enemyId, killerPlayerId } = data;
    
    this.eventBus.emit('enemy:death', {
      id: enemyId,
      killerPlayerId,
      isNetworked: true
    });
  }
  
  handleLocalSpellCast(data) {
    if (this.localPlayerId && this.currentRoom) {
      const { spellId, targetPosition, targetId, cameraPosition, targetDirection, spellData } = data;
      
      this.socketManager.emit('spell-cast', {
        spellId,
        targetPosition,
        targetId,
        cameraPosition,
        targetDirection,
        spellData
      });
    }
  }
  
  handleLocalEnemyDamage(data) {
    if (this.localPlayerId && this.currentRoom && data.isEnemy) {
      const { id, amount, damageType, sourceId, isLocalEvent } = data;
      
      if (isLocalEvent && !data.processingComplete) {
        const cleanData = {
          enemyId: id,
          damage: typeof amount === 'number' ? amount : parseFloat(amount),
          sourceType: typeof damageType === 'string' ? damageType : 'generic',
          sourceId: typeof sourceId === 'string' ? sourceId : this.localPlayerId
        };
        
        data.processingComplete = true;
        this.socketManager.emit('enemy-damage', cleanData);
      }
    }
  }
  
  handleLocalPlayerMoved(data) {
    if (this.localPlayerId && this.currentRoom) {
      const updateData = {
        position: data.position,
        rotation: data.rotation
      };
      
      if (data.phoneOrientation) {
        updateData.phoneOrientation = data.phoneOrientation;
      }
      
      this.socketManager.emit('player-update', updateData);
    }
  }
  
  listRooms() {
    this.socketManager.emit('list-rooms');
  }
  
  createRoom(username, roomName = null) {
    this.socketManager.emit('create-room', { 
      username, 
      roomName
    });
  }
  
  joinRoom(roomCode, username) {
    this.socketManager.emit('join-room', { roomCode, username });
  }
  
  leaveRoom() {
    if (this.currentRoom) {
      this.socketManager.emit('leave-room');
    }
  }
  
  isInRoom() {
    return !!this.currentRoom;
  }
  
  getCurrentRoom() {
    return this.currentRoom;
  }
  
  getPlayers() {
    return this.players;
  }
  
  getPlayer(playerId) {
    return this.players.get(playerId) || null;
  }
  
  getPlayerPosition(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.lastState || !player.lastState.position) {
      return null;
    }
    
    const position = player.lastState.position;
    return new THREE.Vector3(position.x, position.y, position.z);
  }
  
  getPlayerForwardDirection(playerId) {
    const player = this.players.get(playerId);
    if (!player || !player.lastState || !player.lastState.rotation) {
      return null;
    }
    
    const rotation = player.lastState.rotation;
    const quaternion = new THREE.Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
    const forward = new THREE.Vector3(0, 0, -1);
    forward.applyQuaternion(quaternion);
    
    return forward;
  }
  
  getLocalPlayerId() {
    return this.localPlayerId;
  }
}
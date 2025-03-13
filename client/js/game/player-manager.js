import { RemotePlayer } from '../3d/remote-player.js';

/**
 * Manages multiple players in the game
 */
export class PlayerManager {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {SceneManager} sceneManager - 3D scene manager
   */
  constructor(eventBus, sceneManager) {
    this.eventBus = eventBus;
    this.sceneManager = sceneManager;
    this.players = new Map();
    this.localPlayerId = null;
    
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for game state updates to update player positions
    this.eventBus.on('gameState:updated', this.handleGameStateUpdate.bind(this));
    
    // Player connection/disconnection events
    this.eventBus.on('multiplayer:player-joined', this.handlePlayerJoined.bind(this));
    this.eventBus.on('multiplayer:player-left', this.handlePlayerLeft.bind(this));
    this.eventBus.on('multiplayer:room-joined', this.handleRoomJoined.bind(this));
    this.eventBus.on('multiplayer:room-left', this.handleRoomLeft.bind(this));
    this.eventBus.on('multiplayer:room-created', this.handleRoomCreated.bind(this));
    
    // Animation update
    this.eventBus.on('scene:update', this.update.bind(this));
  }
  
  /**
   * Handle game state updates
   * @param {Object} data - Game state data
   */
  handleGameStateUpdate(data) {
    if (data.localPlayerId) {
      this.localPlayerId = data.localPlayerId;
    }
    
    // Update existing players and add new ones
    data.players.forEach(playerData => {
      if (playerData.id !== this.localPlayerId) {
        if (this.players.has(playerData.id)) {
          // Update existing player
          this.players.get(playerData.id).updateFromData(playerData.lastState);
        } else {
          // Create new remote player
          this.createRemotePlayer(playerData.id, playerData.lastState);
        }
      }
    });
  }
  
  /**
   * Handle new player joined
   * @param {Object} data - Player joined data
   */
  handlePlayerJoined(data) {
    const { player } = data;
    if (player.id !== this.localPlayerId) {
      this.createRemotePlayer(player.id, player);
    }
  }
  
  /**
   * Handle player left
   * @param {Object} data - Player left data
   */
  handlePlayerLeft(data) {
    const { playerId } = data;
    this.removePlayer(playerId);
  }
  
  /**
   * Handle room joined
   * @param {Object} data - Room joined data
   */
  handleRoomJoined(data) {
    this.localPlayerId = data.playerId;
    
    // Create remote players for existing players in the room
    if (data.players) {
      data.players.forEach(playerData => {
        if (playerData.id !== this.localPlayerId) {
          this.createRemotePlayer(playerData.id, playerData);
        }
      });
    }
  }
  
  /**
   * Handle room created
   * @param {Object} data - Room created data
   */
  handleRoomCreated(data) {
    this.localPlayerId = data.playerId;
    // Clear any existing players (should be none)
    this.clearAllPlayers();
  }
  
  /**
   * Handle room left or disconnected
   */
  handleRoomLeft() {
    this.localPlayerId = null;
    this.clearAllPlayers();
  }
  
  /**
   * Create a new remote player
   * @param {string} playerId - Player ID
   * @param {Object} playerData - Player data
   */
  createRemotePlayer(playerId, playerData) {
    if (this.players.has(playerId)) {
      return;
    }
    
    const scene = this.sceneManager.getScene();
    // Use current player count as index for color assignment
    const playerIndex = this.players.size;
    const remotePlayer = new RemotePlayer(scene, playerId, playerData, playerIndex);
    this.players.set(playerId, remotePlayer);
    
    this.eventBus.emit('player:remote-created', { 
      playerId, 
      player: remotePlayer 
    });
  }
  
  /**
   * Remove a player
   * @param {string} playerId - Player ID to remove
   */
  removePlayer(playerId) {
    if (this.players.has(playerId)) {
      const player = this.players.get(playerId);
      player.dispose();
      this.players.delete(playerId);
      
      this.eventBus.emit('player:remote-removed', { playerId });
    }
  }
  
  /**
   * Clear all players
   */
  clearAllPlayers() {
    this.players.forEach((player, id) => {
      player.dispose();
    });
    this.players.clear();
  }
  
  /**
   * Update all players
   * @param {Object} data - Update data with delta time
   */
  update(data) {
    const { delta } = data;
    this.players.forEach(player => {
      player.update(delta);
    });
  }
}
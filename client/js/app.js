import { EventBus } from './utils/event-bus.js';
import { LoadingManager } from './utils/loading-manager.js';
import { SocketManager } from './communication/socket-manager.js';
import { WebRTCManager } from './communication/webrtc-manager.js';
import { QRCodeGenerator } from './ui/qrcode-generator.js';
import { StatusDisplay } from './ui/status-display.js';
import { VisualizationManager } from './visualization/visualization-manager.js';
import { SceneManager } from './3d/scene-manager.js';
import { FirstPersonController } from './game/first-person.js';
import { WeaponView } from './game/weapon-view.js';
import { CalibrationManager } from './game/calibration-manager.js';
import { GameStateManager } from './game/game-state-manager.js';
import { PlayerManager } from './game/player-manager.js';
import { PhysicsManager } from './physics/physics-manager.js';
import { GravityGunController } from './game/gravity-gun-controller.js';
import { DebugPanel } from './ui/debug-panel.js';
import { LobbyManager } from './ui/lobby-manager.js';
import { DEBUG_CONFIG } from './config.js';
import { EnemyManager, HealthManager } from './game/enemy-system/index.js';
import { PortalManager } from './game/portal-manager.js';

/**
 * Main application class
 */
class App {
  constructor() {
    // Check for portal mode
    this.isPortalMode = new URLSearchParams(window.location.search).get('portal') === 'true';
    console.log('Portal mode:', this.isPortalMode);
    
    // Check if on mobile
    this.isMobileDevice = this.checkIsMobileDevice();
    
    // Flag to track if user has manually left a room
    this.hasManuallyLeftRoom = false;
    
    // Get username from query parameter if in portal mode, or generate one for mobile
    this.username = null;
    if (this.isPortalMode || this.isMobileDevice) {
      const urlParams = new URLSearchParams(window.location.search);
      this.username = urlParams.get('username') || this.generateRandomUsername();
      console.log((this.isPortalMode ? 'Portal' : 'Mobile') + ' mode username:', this.username);
    }
    
    // Create global event bus for cross-module communication
    this.eventBus = new EventBus();
    
    // Initialize loading manager first
    this.loadingManager = new LoadingManager(this.eventBus);
    
    // Initialize managers
    this.socketManager = new SocketManager(this.eventBus);
    this.webRTCManager = new WebRTCManager(this.eventBus, this.socketManager);
    this.statusDisplay = new StatusDisplay(this.eventBus, this.isPortalMode);
    this.qrCodeGenerator = new QRCodeGenerator(this.eventBus, this.socketManager, this.isPortalMode);
    this.visualizationManager = new VisualizationManager(this.eventBus);
    
    // Create scene manager with the loading manager
    this.sceneManager = new SceneManager(this.eventBus, this.loadingManager.getThreeLoadingManager());
    
    this.calibrationManager = new CalibrationManager(this.eventBus);
    this.firstPersonController = new FirstPersonController(this.eventBus, this.sceneManager);
    
    // Create weapon view after scene manager (needs container reference)
    this.weaponView = new WeaponView(this.eventBus, this.sceneManager.getContainer());
    
    // Initialize multiplayer components
    this.gameStateManager = new GameStateManager(this.eventBus, this.socketManager);
    this.playerManager = new PlayerManager(this.eventBus, this.sceneManager);

    // Initialize physics system with scene and socket manager for network synchronization
    this.physicsManager = new PhysicsManager(this.eventBus, this.sceneManager.getScene(), this.socketManager);
    
    // Initialize enemy system
    this.healthManager = new HealthManager(this.eventBus);
    this.enemyManager = new EnemyManager(this.eventBus, this.sceneManager.getScene(), this.physicsManager.world);
    
    // Initialize lobby manager for room management UI
    this.lobbyManager = new LobbyManager(this.eventBus, this.gameStateManager);
    
    // Initialize gravity gun controller
    this.gravityGunController = new GravityGunController(this.eventBus, this.sceneManager, this.weaponView);
    
    // Register event listener for getting the gravity gun controller
    this.eventBus.on('get:gravity-gun-controller', (callback) => {
      if (typeof callback === 'function') {
        callback(this.gravityGunController);
      }
    });
    
    // Register event listener for getting the enemy manager
    this.eventBus.on('game:get-enemy-manager', (callback) => {
      if (typeof callback === 'function') {
        callback(this.enemyManager);
      }
    });
    
    // Initialize portal manager for VibeVerse portals
    this.portalManager = new PortalManager(
      this.eventBus, 
      this.sceneManager.getScene(),
      this.firstPersonController
    );
    
    // Register event listener for getting the username
    this.eventBus.on('get:player-username', (callback) => {
      if (typeof callback === 'function') {
        callback(this.username);
      }
    });
    
    // Initialize debug panel if debug mode is enabled or for physics debugging
    // (Only used for testing, the lobby manager is the primary multiplayer UI)
    this.debugPanel = new DebugPanel(this.eventBus, this.gameStateManager, this.physicsManager);
    
    // Setup update loop for game components
    this.setupUpdateLoop();
    
    // Automatically request session creation to ensure QR code is generated
    this.socketManager.emit('create-session');
    
    // In portal mode or on mobile device, immediately enable first-person mode
    if (this.isPortalMode || this.isMobileDevice) {
      this.sceneManager.setFirstPersonMode(true);
      this.firstPersonController.toggleFirstPersonMode();
      
      // In portal mode or on mobile device, auto-connect to multiplayer
      this.setupAutoMultiplayer();
    }
    
    // Mark core initialization as complete
    this.loadingManager.markAssetsLoaded(1, 'other');
    
    console.log('Application initialized');
  }
  
  /**
   * Check if the current device is a mobile device not using the /mobile endpoint
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
   * Generate a random player username
   * @returns {string} Random username
   */
  generateRandomUsername() {
    const adjectives = ['Brave', 'Mighty', 'Swift', 'Wise', 'Clever', 'Mystic', 'Arcane', 'Fierce', 'Cosmic', 'Shadow'];
    const nouns = ['Wizard', 'Mage', 'Sorcerer', 'Spellcaster', 'Warlock', 'Conjurer', 'Enchanter', 'Magician', 'Sage', 'Alchemist'];
    
    const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
    const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
    const randomNumber = Math.floor(Math.random() * 100) + 1;
    
    return `${randomAdjective}${randomNoun}${randomNumber}`;
  }
  
  /**
   * Handle automatic multiplayer functionality for portal mode and mobile devices
   */
  setupAutoMultiplayer() {
    // Get mode name for logging
    const modeName = this.isPortalMode ? 'Portal' : 'Mobile';
    
    // Listen for available rooms list
    this.eventBus.on('multiplayer:rooms-list', (data) => {
      // If already in a room, don't try to join another
      if (this.gameStateManager.isInRoom()) {
        return;
      }
      
      // If player has manually left a room, don't auto-join again
      if (this.hasManuallyLeftRoom) {
        console.log(`${modeName} mode - Player previously left a room, not auto-joining`);
        return;
      }
      
      const availableRooms = data.rooms || [];
      console.log(`${modeName} mode - Available rooms:`, availableRooms.length);
      
      // Check if there are any rooms that aren't full
      const joinableRooms = availableRooms.filter(room => room.playerCount < room.maxPlayers);
      
      if (joinableRooms.length > 0) {
        // Join the first available room
        const roomToJoin = joinableRooms[0];
        console.log(`${modeName} mode - Joining existing room:`, roomToJoin.roomName);
        this.gameStateManager.joinRoom(roomToJoin.roomCode, this.username);
      } else {
        // No available rooms, create a new one
        console.log(`${modeName} mode - Creating new room`);
        this.gameStateManager.createRoom(this.username, `${this.username}'s Room`);
      }
    });
    
    // Request rooms list to trigger auto-join logic
    this.gameStateManager.listRooms();
  }
  
  /**
   * Setup update loop for game components
   */
  setupUpdateLoop() {
    this.eventBus.on('scene:update', ({ delta, time }) => {
      if (this.firstPersonController.isEnabled()) {
        // Update first-person controller
        this.firstPersonController.update(delta);
        
        // Get movement state for weapon bobbing
        const isMoving = 
          this.firstPersonController.moveForward ||
          this.firstPersonController.moveBackward ||
          this.firstPersonController.moveLeft ||
          this.firstPersonController.moveRight;
        
        // Update weapon view
        this.weaponView.update(delta, isMoving);
        
        // Emit local player position and rotation for multiplayer synchronization
        if (this.gameStateManager.isInRoom()) {
          const camera = this.sceneManager.getCamera();
          
          // Get the phone model orientation if available
          const phoneModel = this.sceneManager.phoneModel;
          let phoneOrientation = null;
          
          if (phoneModel && phoneModel.getModel()) {
            const phoneQuaternion = phoneModel.getModel().quaternion;
            phoneOrientation = {
              x: phoneQuaternion.x,
              y: phoneQuaternion.y,
              z: phoneQuaternion.z,
              w: phoneQuaternion.w
            };
          } else if (DEBUG_CONFIG.ENABLE_MULTIPLAYER_DEBUG || this.isPortalMode) {
            // In debug mode or portal mode, simulate phone orientation by deriving from camera orientation
            // This helps with testing the weapon visualization without needing a mobile device
            const cameraQuaternion = camera.quaternion;
            phoneOrientation = {
              x: cameraQuaternion.x,
              y: cameraQuaternion.y,
              z: cameraQuaternion.z,
              w: cameraQuaternion.w
            };
          }
          
          this.eventBus.emit('player:local-moved', {
            position: camera.position.clone(),
            rotation: {
              x: camera.quaternion.x,
              y: camera.quaternion.y,
              z: camera.quaternion.z,
              w: camera.quaternion.w
            },
            phoneOrientation: phoneOrientation
          });
        }
      }
    });
    
    // Handle debug toggle for first-person mode
    this.eventBus.on('debug:toggle-first-person', () => {
      this.sceneManager.setFirstPersonMode(!this.firstPersonController.isEnabled());
      this.firstPersonController.toggleFirstPersonMode();
    });
    
    // Listen for multiplayer events to update UI and game state
    this.eventBus.on('mobile:joined', () => {
      // When mobile device connects, enable first-person view for the local player
      this.sceneManager.setFirstPersonMode(true);
      
      // Enable first-person mode if not already enabled
      if (!this.firstPersonController.isEnabled()) {
        this.firstPersonController.toggleFirstPersonMode();
      }
      
      // Spawn particle enemies when mobile connects
      if (this.enemyManager) {
        // Clear any existing enemies first
        this.enemyManager.removeAllEnemies();
        
        // Spawn both training dummies and particle enemies
        this.enemyManager.spawnTrainingDummies(20);
        this.enemyManager.spawnParticleEnemies(200);
        
        console.log('Spawned enemies after mobile device connected');
      }
    });
    
    // Listen for manual room leave event from the UI
    this.eventBus.on('multiplayer:manual-leave-room', () => {
      // Set flag when player manually leaves a room through the UI
      this.hasManuallyLeftRoom = true;
      console.log('Player manually left room, auto-join disabled');
    });
    
    // Auto-enable first-person mode in debug, portal mode, or mobile mode when joining a room
    if (DEBUG_CONFIG.ENABLE_MULTIPLAYER_DEBUG || this.isPortalMode || this.isMobileDevice) {
      this.eventBus.on('multiplayer:room-joined', () => {
        // Enable first-person mode if not already enabled
        if (!this.firstPersonController.isEnabled()) {
          this.sceneManager.setFirstPersonMode(true);
          this.firstPersonController.toggleFirstPersonMode();
        }
        // Spawn enemies when joining a room
        if (this.enemyManager) {
          // Remove any existing enemies first
          this.enemyManager.removeAllEnemies();
          
          // Spawn training dummies around the map
          this.enemyManager.spawnTrainingDummies(20);
          
          // Spawn particle enemies
          this.enemyManager.spawnParticleEnemies(200);
        }
      });
      
      this.eventBus.on('multiplayer:room-created', () => {
        // Enable first-person mode if not already enabled
        if (!this.firstPersonController.isEnabled()) {
          this.sceneManager.setFirstPersonMode(true);
          this.firstPersonController.toggleFirstPersonMode();
        }
        
        // Spawn enemies when creating a room
        if (this.enemyManager) {
          // Remove any existing enemies first
          this.enemyManager.removeAllEnemies();
          
          // Spawn training dummies around the map
          this.enemyManager.spawnTrainingDummies(20);
          
          // Spawn particle enemies
          this.enemyManager.spawnParticleEnemies(200);
        }
      });
    }
  }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
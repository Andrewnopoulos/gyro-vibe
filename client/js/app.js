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

/**
 * Main application class
 */
class App {
  constructor() {
    // Create global event bus for cross-module communication
    this.eventBus = new EventBus();
    
    // Initialize loading manager first
    this.loadingManager = new LoadingManager(this.eventBus);
    
    // Initialize managers
    this.socketManager = new SocketManager(this.eventBus);
    this.webRTCManager = new WebRTCManager(this.eventBus, this.socketManager);
    this.statusDisplay = new StatusDisplay(this.eventBus);
    this.qrCodeGenerator = new QRCodeGenerator(this.eventBus, this.socketManager);
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
    
    // Initialize debug panel if debug mode is enabled or for physics debugging
    // (Only used for testing, the lobby manager is the primary multiplayer UI)
    this.debugPanel = new DebugPanel(this.eventBus, this.gameStateManager, this.physicsManager);
    
    // Setup update loop for game components
    this.setupUpdateLoop();
    
    // Listen for loading complete event
    this.eventBus.on('loading:complete', () => {
      console.log('All assets loaded, app ready');
      
      // Automatically request session creation to ensure QR code is generated
      this.socketManager.emit('create-session');
    });
    
    // Mark core initialization as complete
    this.loadingManager.markAssetsLoaded(1, 'other');
    
    console.log('Application initialized');
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
          } else if (DEBUG_CONFIG.ENABLE_MULTIPLAYER_DEBUG) {
            // In debug mode, simulate phone orientation by deriving from camera orientation
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
    });
    
    // Auto-enable first-person mode in debug mode when joining a room
    if (DEBUG_CONFIG.ENABLE_MULTIPLAYER_DEBUG) {
      this.eventBus.on('multiplayer:room-joined', () => {
        // Enable first-person mode if not already enabled
        if (!this.firstPersonController.isEnabled()) {
          this.sceneManager.setFirstPersonMode(true);
          this.firstPersonController.toggleFirstPersonMode();
        }
        // Spawn training dummies when joining a room
        if (this.enemyManager) {
          // Remove any existing enemies first
          this.enemyManager.removeAllEnemies();
          
          // Spawn 5 training dummies around the map
          this.enemyManager.spawnTrainingDummies(20);
        }
      });
      
      this.eventBus.on('multiplayer:room-created', () => {
        // Enable first-person mode if not already enabled
        if (!this.firstPersonController.isEnabled()) {
          this.sceneManager.setFirstPersonMode(true);
          this.firstPersonController.toggleFirstPersonMode();
        }
        
        // Spawn training dummies when creating a room
        if (this.enemyManager) {
          // Remove any existing enemies first
          this.enemyManager.removeAllEnemies();
          
          // Spawn 5 training dummies around the map
          this.enemyManager.spawnTrainingDummies(20);
        }
      });
    }
  }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
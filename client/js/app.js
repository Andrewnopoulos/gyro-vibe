import { EventBus } from './utils/event-bus.js';
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
import { DebugPanel } from './ui/debug-panel.js';
import { DEBUG_CONFIG } from './config.js';

/**
 * Main application class
 */
class App {
  constructor() {
    // Create global event bus for cross-module communication
    this.eventBus = new EventBus();
    
    // Initialize managers
    this.socketManager = new SocketManager(this.eventBus);
    this.webRTCManager = new WebRTCManager(this.eventBus, this.socketManager);
    this.statusDisplay = new StatusDisplay(this.eventBus);
    this.qrCodeGenerator = new QRCodeGenerator(this.eventBus, this.socketManager);
    this.visualizationManager = new VisualizationManager(this.eventBus);
    this.sceneManager = new SceneManager(this.eventBus);
    this.calibrationManager = new CalibrationManager(this.eventBus);
    this.firstPersonController = new FirstPersonController(this.eventBus, this.sceneManager);
    
    // Create weapon view after scene manager (needs container reference)
    this.weaponView = new WeaponView(this.eventBus, this.sceneManager.getContainer());
    
    // Initialize multiplayer components
    this.gameStateManager = new GameStateManager(this.eventBus, this.socketManager);
    this.playerManager = new PlayerManager(this.eventBus, this.sceneManager);
    
    // Initialize debug panel if debug mode is enabled
    if (DEBUG_CONFIG.ENABLE_MULTIPLAYER_DEBUG) {
      this.debugPanel = new DebugPanel(this.eventBus, this.gameStateManager);
    }
    
    // Setup update loop for game components
    this.setupUpdateLoop();
    
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
          
          this.eventBus.emit('player:local-moved', {
            position: camera.position.clone(),
            rotation: {
              x: camera.quaternion.x,
              y: camera.quaternion.y,
              z: camera.quaternion.z,
              w: camera.quaternion.w
            }
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
      });
      
      this.eventBus.on('multiplayer:room-created', () => {
        // Enable first-person mode if not already enabled
        if (!this.firstPersonController.isEnabled()) {
          this.sceneManager.setFirstPersonMode(true);
          this.firstPersonController.toggleFirstPersonMode();
        }
      });
    }
  }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
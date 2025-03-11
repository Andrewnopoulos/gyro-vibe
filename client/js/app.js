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
      }
    });
  }
}

// Initialize the application when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
});
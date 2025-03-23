import * as THREE from 'three';
import { PLAYER_HEIGHT, LOOK_SPEED, MOVE_SPEED } from '../config.js';

/**
 * Manages first-person mode controls
 */
export class FirstPersonController {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {Object} sceneManager - Scene manager containing camera and scene
   */
  constructor(eventBus, sceneManager) {
    this.eventBus = eventBus;
    this.sceneManager = sceneManager;
    this.camera = sceneManager.getCamera();
    this.container = document.getElementById('phone3d');
    
    // Movement variables
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.moveUp = false;     // New - for God Mode vertical movement
    this.moveDown = false;   // New - for God Mode vertical movement
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.enabled = false;
    
    // God Mode
    this.godMode = false;    // New - God Mode toggle
    this.godModeIndicator = null; // New - UI indicator for God Mode
    
    // Touch control variables
    this.touchActive = false;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.touchSensitivity = 2.5; // Sensitivity multiplier for touch movement
    
    // UI elements
    this.controlsGuide = null;
    
    this.createUI();
    this.setupEventListeners();
    
    // Log successful initialization
    console.log('FirstPersonController initialized');
  }

  /**
   * Create first-person UI elements
   */
  createUI() {
    console.log('FirstPersonController.createUI called');
    
    // Check if container exists
    if (!this.container) {
      console.error('Container element not found! Cannot create UI elements.');
      return;
    }
    
    console.log('Creating UI elements in container:', this.container);
    
    // Add controls guide
    this.controlsGuide = document.createElement('div');
    this.controlsGuide.style.position = 'absolute';
    this.controlsGuide.style.bottom = '10px';
    this.controlsGuide.style.right = '10px';
    this.controlsGuide.style.padding = '10px';
    this.controlsGuide.style.backgroundColor = 'rgba(0,0,0,0.5)';
    this.controlsGuide.style.color = 'white';
    this.controlsGuide.style.fontSize = '12px';
    this.controlsGuide.style.borderRadius = '4px';
    this.controlsGuide.style.zIndex = '1000';
    this.controlsGuide.style.display = 'none'; // Hidden by default
    this.controlsGuide.innerHTML = `
      <strong>Controls:</strong><br>
      W/Arrow Up - Move Forward<br>
      S/Arrow Down - Move Backward<br>
      A/Arrow Left - Move Left<br>
      D/Arrow Right - Move Right<br>
      Space - Use Current Spell<br>
      Q - Flip Page Left<br>
      E - Flip Page Right<br>
      V - Toggle Debug Raycast<br>
      Mouse - Look Around<br>
      <strong>Mobile Controls:</strong><br>
      Touch Drag - Look Around
    `;
    this.controlsGuide.id = 'fp-controls-guide';
    this.container.appendChild(this.controlsGuide);
    console.log('Controls guide added to container');
    
    
    // Create God Mode indicator
    this.godModeIndicator = document.createElement('div');
    this.godModeIndicator.style.position = 'fixed';
    this.godModeIndicator.style.top = '100px'; // Position below rune mode indicator
    this.godModeIndicator.style.left = '50%';
    this.godModeIndicator.style.transform = 'translateX(-50%)';
    this.godModeIndicator.style.padding = '10px 20px';
    this.godModeIndicator.style.backgroundColor = 'rgba(255, 215, 0, 0.8)'; // Gold color
    this.godModeIndicator.style.color = 'black';
    this.godModeIndicator.style.fontSize = '18px';
    this.godModeIndicator.style.fontWeight = 'bold';
    this.godModeIndicator.style.borderRadius = '6px';
    this.godModeIndicator.style.zIndex = '2000';
    this.godModeIndicator.style.display = 'none'; // Hidden by default
    this.godModeIndicator.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.9)';
    this.godModeIndicator.textContent = '🚀 GOD MODE ACTIVE 🚀';
    this.godModeIndicator.id = 'god-mode-indicator';
    
    // Add to document.body
    document.body.appendChild(this.godModeIndicator);
    
    // Create debug visualization canvas for touch paths
    this.debugCanvas = document.createElement('canvas');
    this.debugCanvas.style.position = 'fixed';
    this.debugCanvas.style.bottom = '20px';
    this.debugCanvas.style.right = '20px';
    this.debugCanvas.style.width = '300px';
    this.debugCanvas.style.height = '300px';
    this.debugCanvas.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    this.debugCanvas.style.borderRadius = '8px';
    this.debugCanvas.style.zIndex = '1999';
    this.debugCanvas.style.display = 'none'; // Hidden by default
    this.debugCanvas.style.border = '2px solid rgba(255, 255, 255, 0.5)';
    this.debugCanvas.width = 300; // Actual canvas resolution
    this.debugCanvas.height = 300;
    this.debugCanvas.id = 'rune-debug-canvas';
    
    // Add debug label
    const debugLabel = document.createElement('div');
    debugLabel.style.position = 'absolute';
    debugLabel.style.top = '-30px';
    debugLabel.style.left = '0';
    debugLabel.style.width = '100%';
    debugLabel.style.textAlign = 'center';
    debugLabel.style.color = 'white';
    debugLabel.style.fontFamily = 'Arial, sans-serif';
    debugLabel.style.fontSize = '14px';
    debugLabel.style.fontWeight = 'bold';
    debugLabel.textContent = 'Touch Path Debug';
    this.debugCanvas.appendChild(debugLabel);
    
    // Add to document.body
    document.body.appendChild(this.debugCanvas);
    
    // Get the drawing context
    this.debugContext = this.debugCanvas.getContext('2d');
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    document.addEventListener('keydown', this.onKeyDown.bind(this), false);
    document.addEventListener('keyup', this.onKeyUp.bind(this), false);
    document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
    this.container.addEventListener('click', this.requestPointerLock.bind(this), false);
    
    // Subscribe to touch data events from the mobile device
    this.eventBus.on('sensor:touch-updated', this.onTouchUpdate.bind(this));
    
    // Listen for mobile connection/disconnection events
    this.eventBus.on('mobile:joined', () => {
      // Enable first person mode when mobile connects
      if (!this.enabled) {
        this.toggleFirstPersonMode();
      }
    });
    
    this.eventBus.on('mobile:disconnected', () => {
      // Disable first person mode when mobile disconnects
      if (this.enabled) {
        this.toggleFirstPersonMode();
      }
    });
    
    
    // Listen for God Mode toggle events
    this.eventBus.on('debug:toggle-god-mode', (data) => {
      this.toggleGodMode(data.enabled);
    });
    
    // Provide camera access for spell systems
    this.eventBus.on('camera:get-position', (callback) => {
      if (typeof callback === 'function' && this.camera) {
        callback(this.camera.position.clone());
      }
    });
    
    this.eventBus.on('camera:get-direction', (callback) => {
      if (typeof callback === 'function' && this.camera) {
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.camera.quaternion);
        callback(direction);
      }
    });
  }
  
  /**
   * Toggle God Mode
   * @param {boolean} enabled - Whether God Mode should be enabled
   */
  toggleGodMode(enabled) {
    // Set God Mode state
    this.godMode = enabled !== undefined ? enabled : !this.godMode;
    
    // Update UI indicator
    if (this.godModeIndicator) {
      this.godModeIndicator.style.display = this.godMode ? 'block' : 'none';
    }
    
    // Update controls guide with God Mode instructions if active
    if (this.controlsGuide) {
      if (this.godMode) {
        // Update controls guide to include God Mode keys
        this.controlsGuide.innerHTML = `
          <strong>Controls (GOD MODE):</strong><br>
          W/Arrow Up - Move Forward<br>
          S/Arrow Down - Move Backward<br>
          A/Arrow Left - Move Left<br>
          D/Arrow Right - Move Right<br>
          Q - Move Up<br>
          E - Move Down<br>
          Space - Cast Current Page Spell<br>
          V - Toggle Debug Raycast<br>
          Mouse - Look Around<br>
          <strong>Mobile Controls:</strong><br>
          Touch Drag - Look Around / Draw Runes
        `;
      } else {
        // Restore normal controls guide
        this.controlsGuide.innerHTML = `
          <strong>Controls:</strong><br>
          W/Arrow Up - Move Forward<br>
          S/Arrow Down - Move Backward<br>
          A/Arrow Left - Move Left<br>
          D/Arrow Right - Move Right<br>
          Space - Gravity Gun (pickup/drop objects)<br>
          Q - Flip Page Left<br>
          E - Flip Page Right<br>
          T - Spawn Random Object<br>
          V - Toggle Debug Raycast<br>
          Mouse - Look Around<br>
          <strong>Mobile Controls:</strong><br>
          Touch Drag - Look Around / Draw Runes
        `;
      }
    }
    
    console.log(`God Mode ${this.godMode ? 'enabled' : 'disabled'}`);
  }

  /**
   * Toggle first-person mode
   */
  toggleFirstPersonMode() {
    this.enabled = !this.enabled;
    
    if (this.enabled) {
      // Enable first-person mode
      this.sceneManager.setFirstPersonMode(true);
      
      // Try to get a spawn point from the environment
      if (this.sceneManager.environment && 
          typeof this.sceneManager.environment.getRandomSpawnPoint === 'function') {
        const spawnPoint = this.sceneManager.environment.getRandomSpawnPoint();
        
        // Set position from spawn point
        this.camera.position.set(
          spawnPoint.x,
          PLAYER_HEIGHT, // Use standard player height
          spawnPoint.z
        );
        
        // If spawn point includes rotation, apply it
        if (spawnPoint.rotation !== undefined) {
          const euler = new THREE.Euler(0, spawnPoint.rotation, 0, 'YXZ');
          this.camera.quaternion.setFromEuler(euler);
        }
      } else {
        // Default position if no spawn points available
        this.camera.position.y = PLAYER_HEIGHT;
      }
      
      this.controlsGuide.style.display = 'block';
      this.requestPointerLock();
      this.eventBus.emit('firstperson:enabled');
    } else {
      // Disable first-person mode
      this.sceneManager.setFirstPersonMode(false);
      this.controlsGuide.style.display = 'none';
      document.exitPointerLock();
      this.eventBus.emit('firstperson:disabled');
    }
  }

  /**
   * Update first-person controls
   * @param {number} delta - Time delta in seconds
   */
  update(delta) {
    if (!this.enabled) return;
    
    // Apply damping to slow down movement
    this.velocity.x -= this.velocity.x * 10.0 * delta;
    this.velocity.z -= this.velocity.z * 10.0 * delta;
    
    // God Mode: Add vertical movement
    if (this.godMode) {
      // Add vertical velocity component
      if (!this.velocity.y) this.velocity.y = 0;
      this.velocity.y -= this.velocity.y * 10.0 * delta;
    }
    
    // Set movement direction based on key states
    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveLeft) - Number(this.moveRight);
    
    // God Mode: Add vertical direction
    if (this.godMode) {
      this.direction.y = Number(this.moveUp) - Number(this.moveDown);
    } else {
      this.direction.y = 0;
    }
    
    this.direction.normalize(); // Normalize for consistent movement speed
    
    // Move in the direction the camera is facing
    const movementSpeed = this.godMode ? MOVE_SPEED * 1.5 : MOVE_SPEED; // Faster in God Mode
    
    if (this.moveForward || this.moveBackward) 
      this.velocity.z -= this.direction.z * movementSpeed * delta * 100;
    if (this.moveLeft || this.moveRight) 
      this.velocity.x -= this.direction.x * movementSpeed * delta * 100;
    if (this.godMode && (this.moveUp || this.moveDown))
      this.velocity.y -= this.direction.y * movementSpeed * delta * 100;
    
    // Calculate new camera position based on velocity
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    
    if (this.godMode) {
      // God Mode: Full 3D movement along camera direction
      const forward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      const up = new THREE.Vector3(0, 1, 0);
      
      // Apply movement
      this.camera.position.add(forward.multiplyScalar(-this.velocity.z * delta));
      this.camera.position.add(right.multiplyScalar(-this.velocity.x * delta));
      this.camera.position.add(up.multiplyScalar(this.velocity.y * delta));
      
      // No height constraint in God Mode
    } else {
      // Normal mode: Project movement onto the XZ plane (horizontal movement only)
      const forward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      
      // Apply movement
      this.camera.position.add(forward.multiplyScalar(-this.velocity.z * delta));
      this.camera.position.add(right.multiplyScalar(-this.velocity.x * delta));
      
      // Maintain player height in normal mode
      this.camera.position.y = PLAYER_HEIGHT;
    }
    
    // Determine if player is moving for weapon bob effect
    const isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight || 
                     (this.godMode && (this.moveUp || this.moveDown));
  }


  /**
   * Handle keydown events
   * @param {KeyboardEvent} event - Keyboard event
   */
  onKeyDown(event) {
    if (!this.enabled) return;
    
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveForward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveBackward = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight = true;
        break;
      case 'KeyQ':
        // In God Mode: move up, otherwise flip spellbook page left
        if (this.godMode) {
          this.moveUp = true;
        } else if (!event.repeat) {
          this.eventBus.emit('weapon:flip-left');
        }
        break;
      case 'KeyE':
        // In God Mode: move down, otherwise flip spellbook page right
        if (this.godMode) {
          this.moveDown = true;
        } else if (!event.repeat) {
          this.eventBus.emit('weapon:flip-right');
        }
        break;
      // ShiftLeft case removed - Rune Mode no longer supported
        break;
    }
  }

  /**
   * Handle keyup events
   * @param {KeyboardEvent} event - Keyboard event
   */
  onKeyUp(event) {
    if (!this.enabled) return;
    
    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveForward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveBackward = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight = false;
        break;
      case 'KeyQ':
        if (this.godMode) {
          this.moveUp = false;
        }
        break;
      case 'KeyE':
        if (this.godMode) {
          this.moveDown = false;
        }
        break;
    }
  }

  /**
   * Handle mouse movement
   * @param {MouseEvent} event - Mouse event
   */
  onMouseMove(event) {
    if (!this.enabled || !document.pointerLockElement) return;
    
    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;
    
    // Rotate camera based on mouse movement
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(this.camera.quaternion);
    
    // Apply pitch (up/down) rotation - limit to avoid flipping
    euler.x -= movementY * LOOK_SPEED;
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
    
    // Apply yaw (left/right) rotation
    euler.y -= movementX * LOOK_SPEED;
    
    this.camera.quaternion.setFromEuler(euler);
  }

  /**
   * Request pointer lock for mouse control
   */
  requestPointerLock() {
    if (!this.enabled) return;
    
    this.container.requestPointerLock = this.container.requestPointerLock ||
                                        this.container.mozRequestPointerLock ||
                                        this.container.webkitRequestPointerLock;
    
    if (this.container.requestPointerLock) {
      this.container.requestPointerLock();
    }
  }

  /**
   * Check if first-person mode is enabled
   * @returns {boolean} First-person mode status
   */
  isEnabled() {
    return this.enabled;
  }
  
  
  /**
   * Handle touch updates from the mobile device
   * @param {Object} touchData - Touch data from mobile device
   */
  /**
   * Handle touch updates from the mobile device
   * @param {Object} touchData - Touch data from mobile device
   */
  onTouchUpdate(touchData) {
    if (!this.enabled) return;
    
    // Only process touch events when active
    if (touchData.active) {
      // If this is the first touch event, store the initial position
      if (!this.touchActive) {
        this.lastTouchX = touchData.x;
        this.lastTouchY = touchData.y;
        this.touchActive = true;
        return;
      }
      
      // Calculate touch movement delta (normalized 0-1 coordinates)
      const deltaX = (touchData.x - this.lastTouchX) * this.touchSensitivity;
      const deltaY = (touchData.y - this.lastTouchY) * this.touchSensitivity;
      
      // Update camera rotation - similar to mouse movement
      if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
        // Get current camera orientation
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(this.camera.quaternion);
        
        // Apply yaw (left/right) rotation from X movement
        euler.y -= deltaX;
        
        // Apply pitch (up/down) rotation from Y movement
        euler.x -= deltaY;
        
        // Clamp vertical rotation to avoid flipping
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
        
        // Update camera orientation
        this.camera.quaternion.setFromEuler(euler);
      }
      
      // Update last touch position
      this.lastTouchX = touchData.x;
      this.lastTouchY = touchData.y;
    } else {
      // Touch ended
      this.touchActive = false;
    }
  }
  
  
  /**
   * Clean up resources and event listeners
   */
  dispose() {
    // Remove event listeners
    document.removeEventListener('keydown', this.onKeyDown.bind(this));
    document.removeEventListener('keyup', this.onKeyUp.bind(this));
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));
    
    // Dispose of UI elements
    if (this.controlsGuide && this.controlsGuide.parentNode) {
      this.controlsGuide.parentNode.removeChild(this.controlsGuide);
    }
    
    if (this.godModeIndicator && this.godModeIndicator.parentNode) {
      this.godModeIndicator.parentNode.removeChild(this.godModeIndicator);
    }
  }
}
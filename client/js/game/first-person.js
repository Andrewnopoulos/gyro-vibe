import * as THREE from 'three';
import { PLAYER_HEIGHT, LOOK_SPEED, MOVE_SPEED, PHYSICS } from '../config.js';
import { PhysicsManager } from './physics-manager.js';

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
    this.jump = false;
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.enabled = false;
    
    // Physics variables
    this.isGrounded = true;
    this.canJump = true;
    this.physicsManager = new PhysicsManager(eventBus, sceneManager.getScene());
    
    // Touch control variables
    this.touchActive = false;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.touchSensitivity = 2.5; // Sensitivity multiplier for touch movement
    
    // UI elements
    this.controlsGuide = null;
    
    this.createUI();
    this.setupEventListeners();
  }

  /**
   * Create first-person UI elements
   */
  createUI() {
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
      Space - Jump<br>
      Mouse - Look Around<br>
      <strong>Mobile Controls:</strong><br>
      Touch Drag - Look Around
    `;
    this.controlsGuide.id = 'fp-controls-guide';
    this.container.appendChild(this.controlsGuide);
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
  }

  /**
   * Toggle first-person mode
   */
  toggleFirstPersonMode() {
    this.enabled = !this.enabled;
    
    if (this.enabled) {
      // Enable first-person mode
      this.sceneManager.setFirstPersonMode(true);
      
      // Set initial position and physics state
      this.camera.position.y = PLAYER_HEIGHT;
      this.velocity = new THREE.Vector3(0, 0, 0); // Reset velocity
      this.isGrounded = true; // Start on the ground
      this.canJump = true;    // Allow jumping
      
      // Ensure we're not falling through the ground on start
      // By running a ground check
      setTimeout(() => {
        // Check ground after a short delay to make sure environment is loaded
        this.isGrounded = this.physicsManager.isOnGround(this.camera.position, PLAYER_HEIGHT);
        
        // If not on ground, move player to a known valid position
        if (!this.isGrounded) {
          // Place player at a safe height
          this.camera.position.y = PLAYER_HEIGHT + 0.1;
          
          // Log for debugging
          console.log('Player not initially grounded, adjusting position');
        }
      }, 100);
      
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
    
    // First, ensure we're not already below the floor
    const minHeight = -0.5 + PHYSICS.PLAYER_RADIUS + 0.1;
    if (this.camera.position.y < minHeight) {
      this.camera.position.y = minHeight;
      this.velocity.y = 0;
      this.isGrounded = true;
      this.canJump = true;
      console.log("Emergency position correction applied");
    }
    
    // Check if player is on the ground
    this.isGrounded = this.physicsManager.isOnGround(this.camera.position, PLAYER_HEIGHT);
    
    // Apply damping to slow down movement (different values for air and ground)
    const friction = this.isGrounded ? PHYSICS.GROUND_FRICTION : PHYSICS.AIR_RESISTANCE;
    this.velocity.x -= this.velocity.x * friction * delta;
    this.velocity.z -= this.velocity.z * friction * delta;
    
    // Apply gravity if not on the ground
    if (!this.isGrounded) {
      this.velocity.y -= PHYSICS.GRAVITY * delta;
      
      // Cap fall speed at terminal velocity
      if (this.velocity.y < -PHYSICS.MAX_FALL_SPEED) {
        this.velocity.y = -PHYSICS.MAX_FALL_SPEED;
      }
    } else {
      // Reset vertical velocity when on ground
      this.velocity.y = 0;
      this.canJump = true;
    }
    
    // Process jump
    if (this.jump && this.canJump && this.isGrounded) {
      this.velocity.y = PHYSICS.JUMP_FORCE;
      this.canJump = false;
      this.isGrounded = false;
      console.log("Player jumped");
    }
    
    // Set movement direction based on key states
    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveLeft) - Number(this.moveRight);
    this.direction.normalize(); // Normalize for consistent movement speed
    
    // Move in the direction the camera is facing
    if (this.moveForward || this.moveBackward) {
      this.velocity.z -= this.direction.z * MOVE_SPEED * delta * 100;
    }
    if (this.moveLeft || this.moveRight) {
      this.velocity.x -= this.direction.x * MOVE_SPEED * delta * 100;
    }
    
    // Calculate new camera position based on velocity
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    
    // Project movement onto the XZ plane (horizontal movement only)
    const forward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    
    // Store original position for collision detection
    const originalPosition = this.camera.position.clone();
    
    // Calculate new position after applying velocity
    const newPosition = originalPosition.clone();
    newPosition.add(forward.multiplyScalar(-this.velocity.z * delta));
    newPosition.add(right.multiplyScalar(-this.velocity.x * delta));
    newPosition.y += this.velocity.y * delta; // Apply vertical velocity for jumping/falling
    
    // Check for collision and get adjusted position
    const adjustedPosition = this.physicsManager.collideAndSlide(
      originalPosition,
      newPosition, 
      PHYSICS.PLAYER_RADIUS
    );
    
    // Apply the adjusted position
    this.camera.position.copy(adjustedPosition);
    
    // If we ended up hitting the ground, reset vertical velocity and set grounded state
    if (this.camera.position.y <= minHeight) {
      this.velocity.y = 0;
      this.isGrounded = true;
      this.canJump = true;
    }
    
    // If we're moving up but hit something, stop upward velocity
    if (this.velocity.y > 0 && Math.abs(adjustedPosition.y - newPosition.y) > 0.001) {
      this.velocity.y = 0;
    }
    
    // Emit player position updated event for multiplayer
    this.eventBus.emit('player:position-updated', {
      position: this.camera.position.clone(),
      rotation: this.camera.quaternion.clone()
    });
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
      case 'Space':
        this.jump = true;
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
      case 'Space':
        this.jump = false;
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
      
      // Check for double tap to jump (if touch Y position is in the top half of the screen)
      if (touchData.doubleTap && touchData.y < 0.5 && this.canJump && this.isGrounded) {
        this.jump = true;
        setTimeout(() => {
          this.jump = false;
        }, 100);
      }
    } else {
      // Touch ended
      this.touchActive = false;
    }
  }
}
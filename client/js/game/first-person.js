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
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.enabled = false;
    
    // UI elements
    this.controlsGuide = null;
    this.fpModeBtn = null;
    
    this.createUI();
    this.setupEventListeners();
  }

  /**
   * Create first-person UI elements
   */
  createUI() {
    // Create first-person mode button
    this.fpModeBtn = document.createElement('button');
    this.fpModeBtn.textContent = 'First Person Mode';
    this.fpModeBtn.style.position = 'absolute';
    this.fpModeBtn.style.top = '10px';
    this.fpModeBtn.style.right = '10px';
    this.fpModeBtn.style.padding = '5px 10px';
    this.fpModeBtn.style.backgroundColor = '#4CAF50';
    this.fpModeBtn.style.color = 'white';
    this.fpModeBtn.style.border = 'none';
    this.fpModeBtn.style.borderRadius = '4px';
    this.fpModeBtn.style.cursor = 'pointer';
    this.fpModeBtn.style.zIndex = '1000';
    this.fpModeBtn.onclick = () => this.toggleFirstPersonMode();
    this.container.appendChild(this.fpModeBtn);
    
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
      Mouse - Look Around
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
  }

  /**
   * Toggle first-person mode
   */
  toggleFirstPersonMode() {
    this.enabled = !this.enabled;
    
    if (this.enabled) {
      // Enable first-person mode
      this.sceneManager.setFirstPersonMode(true);
      this.camera.position.y = PLAYER_HEIGHT;
      this.controlsGuide.style.display = 'block';
      this.fpModeBtn.textContent = 'Exit First Person';
      this.fpModeBtn.style.backgroundColor = '#dc3545';
      this.requestPointerLock();
      this.eventBus.emit('firstperson:enabled');
    } else {
      // Disable first-person mode
      this.sceneManager.setFirstPersonMode(false);
      this.controlsGuide.style.display = 'none';
      this.fpModeBtn.textContent = 'First Person Mode';
      this.fpModeBtn.style.backgroundColor = '#4CAF50';
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
    
    // Set movement direction based on key states
    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveLeft) - Number(this.moveRight);
    this.direction.normalize(); // Normalize for consistent movement speed
    
    // Move in the direction the camera is facing
    if (this.moveForward || this.moveBackward) this.velocity.z -= this.direction.z * MOVE_SPEED * delta * 100;
    if (this.moveLeft || this.moveRight) this.velocity.x -= this.direction.x * MOVE_SPEED * delta * 100;
    
    // Calculate new camera position based on velocity
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);
    
    // Project movement onto the XZ plane (horizontal movement only)
    const forward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
    const right = new THREE.Vector3(forward.z, 0, -forward.x);
    
    // Apply movement
    this.camera.position.add(forward.multiplyScalar(-this.velocity.z * delta));
    this.camera.position.add(right.multiplyScalar(-this.velocity.x * delta));
    
    // Maintain player height
    this.camera.position.y = PLAYER_HEIGHT;
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
}
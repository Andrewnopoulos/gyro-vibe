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
    
    // Rune mode variables
    this.runeMode = false;
    
    // Touch control variables
    this.touchActive = false;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.touchSensitivity = 2.5; // Sensitivity multiplier for touch movement
    
    // UI elements
    this.controlsGuide = null;
    this.runeModeIndicator = null;
    
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
      Q - Toggle Rune Mode<br>
      Mouse - Look Around<br>
      <strong>Mobile Controls:</strong><br>
      Touch Drag - Look Around / Draw Runes
    `;
    this.controlsGuide.id = 'fp-controls-guide';
    this.container.appendChild(this.controlsGuide);
    console.log('Controls guide added to container');
    
    // Create a more visible rune mode indicator with fixed positioning
    this.runeModeIndicator = document.createElement('div');
    this.runeModeIndicator.style.position = 'fixed';  // Change to fixed positioning
    this.runeModeIndicator.style.top = '50px';
    this.runeModeIndicator.style.left = '50%';
    this.runeModeIndicator.style.transform = 'translateX(-50%)';  // Center horizontally
    this.runeModeIndicator.style.padding = '10px 20px';
    this.runeModeIndicator.style.backgroundColor = 'rgba(138, 43, 226, 0.8)';  // More vibrant purple
    this.runeModeIndicator.style.color = 'white';
    this.runeModeIndicator.style.fontSize = '18px';
    this.runeModeIndicator.style.fontWeight = 'bold';
    this.runeModeIndicator.style.borderRadius = '6px';
    this.runeModeIndicator.style.zIndex = '2000';  // Higher z-index to ensure visibility
    this.runeModeIndicator.style.display = 'none'; // Hidden by default
    this.runeModeIndicator.style.boxShadow = '0 0 15px rgba(138, 43, 226, 0.9)';
    this.runeModeIndicator.textContent = '✨ RUNE MODE ACTIVE ✨';
    this.runeModeIndicator.id = 'rune-mode-indicator';
    
    // Add to document.body for fixed positioning
    document.body.appendChild(this.runeModeIndicator);
    console.log('Rune mode indicator added to document body');
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
    
    // Listen for rune recognition events
    this.eventBus.on('mobile:rune-cast', this.handleRuneCast.bind(this));
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
   * Toggle rune mode
   */
  toggleRuneMode() {
    this.runeMode = !this.runeMode;
    
    // Update the UI indicator
    if (this.runeModeIndicator) {
      this.runeModeIndicator.style.display = this.runeMode ? 'block' : 'none';
    } else {
      console.error('runeModeIndicator not found in toggleRuneMode!');
    }
    
    // Only emit local event - no need to communicate with the phone
    this.eventBus.emit('runeMode:toggled', { active: this.runeMode });
  }
  
  /**
   * Get rune mode state
   * @returns {boolean} Whether rune mode is active
   */
  isRuneModeActive() {
    return this.runeMode;
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
        // Only toggle on keydown, not on key hold
        if (!event.repeat) {
          this.toggleRuneMode();
        }
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
  
  /**
   * Handle rune cast events from mobile device
   * @param {Object} data - Rune cast data including shape and confidence
   */
  handleRuneCast(data) {
    if (!this.enabled) {
      return;
    }
    
    const { shape, confidence, playerId } = data;
    
    // Create visual and audio feedback based on the rune shape
    this.createRuneCastEffect(shape, confidence);
    
    // Apply rune effect based on shape
    switch (shape.toLowerCase()) {
      case 'circle':
        // Circle rune could create a defensive shield
        this.createShieldEffect();
        break;
        
      case 'triangle':
        // Triangle rune could be an attack/fireball
        this.createFireballEffect();
        break;
        
      default:
        // Generic effect for unrecognized shapes
        this.createGenericRuneEffect();
    }
  }
  
  /**
   * Create visual feedback for rune casting
   * @param {string} shape - The recognized shape
   * @param {number} confidence - Recognition confidence (0-1)
   */
  createRuneCastEffect(shape, confidence) {
    // Create a notification element
    const notification = document.createElement('div');
    notification.style.position = 'absolute';
    notification.style.top = '50%';
    notification.style.left = '50%';
    notification.style.transform = 'translate(-50%, -50%)';
    notification.style.padding = '15px 25px';
    notification.style.borderRadius = '8px';
    notification.style.fontSize = '24px';
    notification.style.fontWeight = 'bold';
    notification.style.textAlign = 'center';
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.3s, transform 0.3s';
    notification.style.zIndex = '2000';
    notification.style.pointerEvents = 'none';
    
    // Set style based on shape
    switch (shape.toLowerCase()) {
      case 'circle':
        notification.style.backgroundColor = 'rgba(0, 200, 255, 0.7)';
        notification.style.color = 'white';
        notification.style.boxShadow = '0 0 20px rgba(0, 200, 255, 0.8)';
        notification.textContent = `⭕ Circle Rune Cast!`;
        break;
        
      case 'triangle':
        notification.style.backgroundColor = 'rgba(255, 100, 0, 0.7)';
        notification.style.color = 'white';
        notification.style.boxShadow = '0 0 20px rgba(255, 100, 0, 0.8)';
        notification.textContent = `🔺 Triangle Rune Cast!`;
        break;
        
      default:
        notification.style.backgroundColor = 'rgba(180, 180, 180, 0.7)';
        notification.style.color = 'white';
        notification.style.boxShadow = '0 0 20px rgba(180, 180, 180, 0.8)';
        notification.textContent = `✨ Rune Cast!`;
    }
    
    // Add confidence display
    const confidenceEl = document.createElement('div');
    confidenceEl.style.fontSize = '16px';
    confidenceEl.style.marginTop = '5px';
    confidenceEl.textContent = `Confidence: ${Math.round(confidence * 100)}%`;
    notification.appendChild(confidenceEl);
    
    // Add to document
    this.container.appendChild(notification);
    
    // Play sound effect if available
    if (window.runeSounds && window.runeSounds[shape.toLowerCase()]) {
      window.runeSounds[shape.toLowerCase()].play();
    } else {
      // Generic sound effect fallback would go here
    }
    
    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translate(-50%, -60%)';
      
      // Remove from DOM after animation
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 2000);
  }
  
  /**
   * Create shield effect for circle rune
   */
  createShieldEffect() {
    // In a real implementation, this would create a shield around the player
    // using Three.js objects in the scene
    
    // For now, just add a quick visual feedback
    const shield = document.createElement('div');
    shield.style.position = 'absolute';
    shield.style.top = '0';
    shield.style.left = '0';
    shield.style.width = '100%';
    shield.style.height = '100%';
    shield.style.border = '20px solid rgba(0, 200, 255, 0.3)';
    shield.style.borderRadius = '50%';
    shield.style.boxSizing = 'border-box';
    shield.style.opacity = '0';
    shield.style.transition = 'opacity 0.5s';
    shield.style.zIndex = '1500';
    shield.style.pointerEvents = 'none';
    
    this.container.appendChild(shield);
    
    // Animate in
    setTimeout(() => {
      shield.style.opacity = '1';
    }, 10);
    
    // Remove after delay
    setTimeout(() => {
      shield.style.opacity = '0';
      
      // Remove from DOM after animation
      setTimeout(() => {
        if (shield.parentNode) {
          shield.parentNode.removeChild(shield);
        }
      }, 500);
    }, 3000);
  }
  
  /**
   * Create fireball effect for triangle rune
   */
  createFireballEffect() {
    // In a real implementation, this would create a projectile using Three.js
    
    // For now, just add a quick visual feedback
    const fireball = document.createElement('div');
    fireball.style.position = 'absolute';
    fireball.style.top = '50%';
    fireball.style.left = '50%';
    fireball.style.width = '50px';
    fireball.style.height = '50px';
    fireball.style.marginTop = '-25px';
    fireball.style.marginLeft = '-25px';
    fireball.style.background = 'radial-gradient(circle, rgba(255,200,0,1) 0%, rgba(255,100,0,1) 70%, rgba(255,0,0,0) 100%)';
    fireball.style.borderRadius = '50%';
    fireball.style.boxShadow = '0 0 20px rgba(255, 100, 0, 0.8)';
    fireball.style.zIndex = '1500';
    fireball.style.pointerEvents = 'none';
    fireball.style.transition = 'transform 1s, opacity 1s';
    fireball.style.opacity = '1';
    
    this.container.appendChild(fireball);
    
    // Animate fireball moving forward
    setTimeout(() => {
      fireball.style.transform = 'scale(0.2) translateZ(-1000px)';
      fireball.style.opacity = '0';
    }, 10);
    
    // Remove after animation
    setTimeout(() => {
      if (fireball.parentNode) {
        fireball.parentNode.removeChild(fireball);
      }
    }, 1000);
  }
  
  /**
   * Create generic effect for unrecognized runes
   */
  createGenericRuneEffect() {
    // Create a simple particle effect
    const particles = [];
    const numParticles = 20;
    
    for (let i = 0; i < numParticles; i++) {
      const particle = document.createElement('div');
      particle.style.position = 'absolute';
      particle.style.top = '50%';
      particle.style.left = '50%';
      particle.style.width = '10px';
      particle.style.height = '10px';
      particle.style.marginTop = '-5px';
      particle.style.marginLeft = '-5px';
      particle.style.background = 'white';
      particle.style.borderRadius = '50%';
      particle.style.boxShadow = '0 0 5px rgba(255, 255, 255, 0.8)';
      particle.style.opacity = '1';
      particle.style.zIndex = '1500';
      particle.style.pointerEvents = 'none';
      
      // Random position and transition
      const angle = Math.random() * Math.PI * 2;
      const distance = 50 + Math.random() * 100;
      const duration = 500 + Math.random() * 1000;
      
      particle.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms ease-out`;
      
      this.container.appendChild(particle);
      particles.push(particle);
      
      // Animate outward
      setTimeout(() => {
        particle.style.transform = `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance}px)`;
        particle.style.opacity = '0';
      }, 10);
    }
    
    // Remove particles after longest animation
    setTimeout(() => {
      particles.forEach(particle => {
        if (particle.parentNode) {
          particle.parentNode.removeChild(particle);
        }
      });
    }, 2000);
  }
  
  /**
   * Handle touch updates from the mobile device
   * @param {Object} touchData - Touch data from mobile device
   */
  /**
   * Collection of touch points for rune drawing
   * @type {Array<{x: number, y: number}>}
   */
  touchPath = [];

  /**
   * Handle touch updates from the mobile device
   * @param {Object} touchData - Touch data from mobile device
   */
  onTouchUpdate(touchData) {
    if (!this.enabled) return;
    
    // Check if we're in rune mode or normal mode
    if (this.runeMode) {
      // Handle touch input for rune drawing instead of camera rotation
      if (touchData.active) {
        // If this is the first touch event in a sequence, start a new path
        if (!this.touchActive) {
          this.touchActive = true;
          this.touchPath = []; // Reset path
          this.touchPath.push({
            x: touchData.x,
            y: touchData.y
          });
        } else {
          // Add point to the path
          this.touchPath.push({
            x: touchData.x,
            y: touchData.y
          });
        }
        
        // Store current position for next comparison
        this.lastTouchX = touchData.x;
        this.lastTouchY = touchData.y;
      } else if (this.touchActive) {
        // Touch ended - analyze the path for shape recognition
        this.touchActive = false;
        
        // Only analyze if we have enough points
        if (this.touchPath.length >= 5) {
          const shape = this.recognizeShape(this.touchPath);
          if (shape.shape !== 'unknown') {
            this.handleRuneCast({
              shape: shape.shape,
              confidence: shape.confidence,
              playerId: 'mobile'
            });
          }
        }
        
        // Clear the path
        this.touchPath = [];
      }
    } else {
      // NORMAL MODE: Process for camera rotation as before
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
  }
  
  /**
   * Recognize shape from touch path
   * @param {Array<{x: number, y: number}>} path - Array of touch points
   * @returns {Object} Recognition result with shape and confidence
   */
  recognizeShape(path) {
    if (path.length < 5) {
      return { shape: 'unknown', confidence: 0 };
    }
    
    // Simple shape recognition algorithm
    // Get center and bounds
    const bounds = this.getShapeBounds(path);
    const { center, radius } = bounds;
    
    // Check if the shape is closed (start and end points are close)
    const startPoint = path[0];
    const endPoint = path[path.length - 1];
    const distance = Math.sqrt(
      Math.pow(endPoint.x - startPoint.x, 2) + 
      Math.pow(endPoint.y - startPoint.y, 2)
    );
    
    // If radius is too small, it's probably just a tap, not a shape
    if (radius < 0.05) {
      return { shape: 'unknown', confidence: 0 };
    }
    
    // Check if shape is closed
    const isClosed = distance < radius * 0.3;
    
    // Calculate circularity: how close the points are to the circle's perimeter
    let circularityScore = 0;
    let triangularityScore = 0;
    
    // Calculate distance from each point to center
    const distances = path.map(point => {
      return Math.sqrt(
        Math.pow(point.x - center.x, 2) + 
        Math.pow(point.y - center.y, 2)
      );
    });
    
    // Average distance (ideal radius)
    const avgRadius = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    
    // Circularity: standard deviation of distances relative to average radius
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgRadius, 2), 0) / distances.length;
    const stdDev = Math.sqrt(variance);
    circularityScore = 1 - (stdDev / avgRadius);
    
    // Triangularity: check for 3 distinct corners
    // Calculate angle changes along the path
    const angles = [];
    const angleThreshold = 0.6; // Threshold for significant angle change
    
    for (let i = 2; i < path.length; i++) {
      const prev = path[i-2];
      const curr = path[i-1];
      const next = path[i];
      
      // Calculate vectors
      const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
      const v2 = { x: next.x - curr.x, y: next.y - curr.y };
      
      // Normalize vectors
      const v1mag = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
      const v2mag = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
      
      if (v1mag > 0 && v2mag > 0) {
        const v1norm = { x: v1.x / v1mag, y: v1.y / v1mag };
        const v2norm = { x: v2.x / v2mag, y: v2.y / v2mag };
        
        // Dot product to get angle
        const dotProduct = v1norm.x * v2norm.x + v1norm.y * v2norm.y;
        const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
        
        // Store significant angles
        if (angle > angleThreshold) {
          angles.push({ index: i-1, angle: angle });
        }
      }
    }
    
    // Simplify angles by merging close ones
    const mergedAngles = [];
    const mergeThreshold = path.length * 0.1; // Minimum distance between corners
    
    for (const angle of angles) {
      if (mergedAngles.length === 0 || 
          angle.index - mergedAngles[mergedAngles.length - 1].index > mergeThreshold) {
        mergedAngles.push(angle);
      }
    }
    
    // Triangle has exactly 3 significant angles that are reasonably evenly spaced
    if (mergedAngles.length === 3 && isClosed) {
      // Check if angles are evenly spaced (roughly)
      const totalPoints = path.length;
      const expectedSpacing = totalPoints / 3;
      
      // Calculate actual spacing between angles
      const spacings = [
        mergedAngles[1].index - mergedAngles[0].index,
        mergedAngles[2].index - mergedAngles[1].index,
        totalPoints - (mergedAngles[2].index - mergedAngles[0].index)
      ];
      
      // Calculate how close the spacings are to the expected spacing
      const spacingDeviation = spacings.reduce((sum, spacing) => 
        sum + Math.abs(spacing - expectedSpacing), 0) / (3 * expectedSpacing);
      
      triangularityScore = 1 - spacingDeviation;
    }
    
    // Shape analysis completed
    
    // Evaluate the scores with the constraint that the shape is closed
    if (isClosed) {
      if (circularityScore > 0.75 && circularityScore > triangularityScore) {
        return { shape: 'circle', confidence: circularityScore };
      } else if (triangularityScore > 0.6 && triangularityScore > circularityScore) {
        return { shape: 'triangle', confidence: triangularityScore };
      } else if (circularityScore > 0.5) {
        return { shape: 'circle', confidence: circularityScore * 0.8 };
      } else if (triangularityScore > 0.4) {
        return { shape: 'triangle', confidence: triangularityScore * 0.8 };
      }
    }
    
    return { shape: 'unknown', confidence: 0.2 };
  }
  
  /**
   * Get shape bounds from touch path
   * @param {Array<{x: number, y: number}>} path - Array of touch points
   * @returns {Object} Center and radius
   */
  getShapeBounds(path) {
    if (!path || path.length === 0) {
      return { center: { x: 0, y: 0 }, radius: 0 };
    }
    
    // Find bounds
    let minX = path[0].x;
    let maxX = path[0].x;
    let minY = path[0].y;
    let maxY = path[0].y;
    
    for (const point of path) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    
    // Calculate center
    const center = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    };
    
    // Calculate radius (half of the maximum dimension)
    const radius = Math.max(maxX - minX, maxY - minY) / 2;
    
    return { center, radius };
  }
}
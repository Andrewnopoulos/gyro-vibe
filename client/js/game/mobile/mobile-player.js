import * as THREE from 'three';

/**
 * MobilePlayer class for airborne third-person player experience
 * Designed for mobile clients connecting to multiplayer sessions
 */
export class MobilePlayer {
  /**
   * @param {THREE.Scene} scene - The 3D scene
   * @param {EventBus} eventBus - Application event bus
   */
  constructor(scene, eventBus) {
    this.scene = scene;
    this.eventBus = eventBus;
    this.playerModel = null;
    this.camera = null;
    this.moveSpeed = 5; // Units per second
    this.turnSpeed = 2; // Radians per second
    this.altitudeChangeSpeed = 2; // Units per second
    
    // Player state
    this.position = new THREE.Vector3(0, 10, 0); // Start at y=10 (in the air)
    this.rotation = new THREE.Euler(0, 0, 0, 'YXZ');
    this.direction = new THREE.Vector3(0, 0, -1); // Forward direction
    this.velocity = new THREE.Vector3();
    
    // Camera offsets
    this.cameraOffset = new THREE.Vector3(0, 3, 10); // Behind and above
    this.cameraLookOffset = new THREE.Vector3(0, 0, -10); // Look ahead of player
    
    // Touch controls
    this.touchActive = false;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.touchDeltaX = 0; // For turning
    this.touchDeltaY = 0; // For altitude change
    
    // Initialize
    this.createPlayerModel();
    this.setupCamera();
    this.setupEventListeners();
  }
  
  /**
   * Create the player model (simple rectangular prism)
   */
  createPlayerModel() {
    // Create a simple geometric airplane-like shape
    const bodyGeometry = new THREE.BoxGeometry(0.8, 0.3, 2);
    const wingGeometry = new THREE.BoxGeometry(3, 0.1, 0.5);
    const tailGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.1);
    
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x3355ff,
      roughness: 0.4,
      metalness: 0.6
    });
    
    const wingMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x33bbff,
      roughness: 0.6,
      metalness: 0.3
    });
    
    // Create meshes
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    const wingMesh = new THREE.Mesh(wingGeometry, wingMaterial);
    const tailMesh = new THREE.Mesh(tailGeometry, wingMaterial);
    
    // Position wing and tail
    wingMesh.position.set(0, 0, 0);
    tailMesh.position.set(0, 0.3, -0.9);
    
    // Create a group to hold all parts
    this.playerModel = new THREE.Group();
    this.playerModel.add(bodyMesh);
    this.playerModel.add(wingMesh);
    this.playerModel.add(tailMesh);
    
    // Set initial position
    this.playerModel.position.copy(this.position);
    
    // Add to scene
    this.scene.add(this.playerModel);
  }
  
  /**
   * Setup third-person camera
   */
  setupCamera() {
    // Create a perspective camera
    this.camera = new THREE.PerspectiveCamera(
      75, // FOV
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    
    // Set initial camera position
    this.updateCameraPosition();
    
    // Add to scene
    this.scene.add(this.camera);
  }
  
  /**
   * Setup event listeners for touch controls
   */
  setupEventListeners() {
    // Listen for dual joystick input from enhanced touch controller
    this.eventBus.on('mobile:move-joystick', this.onMoveJoystick.bind(this));
    this.eventBus.on('mobile:look-joystick', this.onLookJoystick.bind(this));
    this.eventBus.on('mobile:action-start', this.onActionStart.bind(this));
    this.eventBus.on('mobile:action-end', this.onActionEnd.bind(this));
    
    // Listen for gyroscope controls
    this.eventBus.on('mobile:gyro-control', this.onGyroControl.bind(this));
    
    // For backward compatibility - these will be deprecated
    this.eventBus.on('mobile:touch-start', this.onLegacyTouchStart.bind(this));
    this.eventBus.on('mobile:touch-move', this.onLegacyTouchMove.bind(this));
    this.eventBus.on('mobile:touch-end', this.onLegacyTouchEnd.bind(this));
    this.eventBus.on('sensor:gyro-updated', this.onLegacyGyroUpdated.bind(this));
    
    // Animation update
    this.eventBus.on('scene:update', this.update.bind(this));
    
    // Initialize control state
    this.controlState = {
      // Movement joystick (left)
      moveX: 0,      // -1 to 1, left to right
      moveY: 0,      // -1 to 1, forward to backward
      
      // Camera joystick (right)
      lookX: 0,      // -1 to 1, look left to right
      lookY: 0,      // -1 to 1, look up to down
      
      // Action button
      action: false, // true if action button is pressed
      
      // Gyroscope
      gyroEnabled: false,
      gyroData: {
        alpha: 0,
        beta: 0,
        gamma: 0
      },
      
      // Reference angles for gyro calibration
      gyroReference: {
        alpha: 0,
        beta: 0,
        gamma: 0
      },
      
      // Initial orientation when the player joins to use as a baseline
      initialOrientation: {
        alpha: null,
        beta: null,
        gamma: null
      }
    };
  }
  
  /**
   * Handle movement joystick (left stick)
   * @param {Object} data - Joystick data with x,y values from -1 to 1
   */
  onMoveJoystick(data) {
    this.controlState.moveX = data.x;
    this.controlState.moveY = data.y;
  }
  
  /**
   * Handle look joystick (right stick)
   * @param {Object} data - Joystick data with x,y values from -1 to 1
   */
  onLookJoystick(data) {
    this.controlState.lookX = data.x;
    this.controlState.lookY = data.y;
  }
  
  /**
   * Handle action button press
   */
  onActionStart() {
    this.controlState.action = true;
    
    // Fire event for shooting/interaction
    this.eventBus.emit('player:action', { type: 'fire' });
  }
  
  /**
   * Handle action button release
   */
  onActionEnd() {
    this.controlState.action = false;
  }
  
  /**
   * Handle gyroscope data
   * @param {Object} data - Gyroscope orientation data
   */
  onGyroControl(data) {
    this.controlState.gyroEnabled = true;
    this.controlState.gyroData = {
      alpha: data.alpha,
      beta: data.beta,
      gamma: data.gamma
    };
    
    // Set initial reference angles if not set yet
    if (this.controlState.initialOrientation.alpha === null) {
      this.controlState.initialOrientation = {
        alpha: data.alpha,
        beta: data.beta,
        gamma: data.gamma
      };
      
      this.controlState.gyroReference = {
        alpha: data.alpha,
        beta: data.beta,
        gamma: data.gamma
      };
    }
  }
  
  /**
   * For backward compatibility with old control scheme
   * @param {Object} data - Touch data
   */
  onLegacyTouchStart(data) {
    this.touchActive = true;
    this.lastTouchX = data.x;
    this.lastTouchY = data.y;
    this.touchDeltaX = 0;
    this.touchDeltaY = 0;
  }
  
  /**
   * For backward compatibility with old control scheme
   * @param {Object} data - Touch data
   */
  onLegacyTouchMove(data) {
    if (!this.touchActive) return;
    
    // Calculate touch deltas (normalized 0-1 coordinates)
    this.touchDeltaX = (data.x - this.lastTouchX) * 5; // Scale for sensitivity
    this.touchDeltaY = (data.y - this.lastTouchY) * 5; // Scale for sensitivity
    
    // Update last touch position
    this.lastTouchX = data.x;
    this.lastTouchY = data.y;
  }
  
  /**
   * For backward compatibility with old control scheme
   */
  onLegacyTouchEnd() {
    this.touchActive = false;
    this.touchDeltaX = 0;
    this.touchDeltaY = 0;
  }
  
  /**
   * For backward compatibility with old gyro API
   * @param {Object} gyroData - Gyroscope orientation data
   */
  onLegacyGyroUpdated(gyroData) {
    // Forward to new API
    this.onGyroControl(gyroData);
  }
  
  /**
   * Update player position, rotation, and camera
   * @param {Object} data - Update data with delta time
   */
  update(data) {
    const { delta } = data;
    
    // ===== HANDLE CONTROL INPUTS =====
    
    // Check which control method to use (for backward compatibility)
    const useLegacyControls = this.touchActive;
    
    if (useLegacyControls) {
      // Legacy touch controls (gradually phase these out)
      this.handleLegacyControls(delta);
    } else {
      // New dual joystick + gyro controls
      this.handleNewControls(delta);
    }
    
    // Update direction vector from rotation
    this.direction.set(0, 0, -1).applyEuler(this.rotation);
    
    // ===== APPLY PHYSICS AND MOVEMENT =====
    
    // Apply velocity
    this.position.add(this.velocity.clone().multiplyScalar(delta));
    
    // Apply changes to the model if it exists
    if (this.playerModel) {
      this.playerModel.position.copy(this.position);
      this.playerModel.rotation.copy(this.rotation);
    }
    
    // Update camera position to follow player
    this.updateCameraPosition();
    
    // Emit position update for multiplayer
    this.emitPositionUpdate();
  }
  
  /**
   * Handle legacy control scheme
   * @param {number} delta - Time delta since last frame
   */
  handleLegacyControls(delta) {
    // Apply turning based on touch input
    if (Math.abs(this.touchDeltaX) > 0.001) {
      this.rotation.y -= this.touchDeltaX * this.turnSpeed * delta;
      
      // Gradually reduce the touch delta (feels more natural)
      this.touchDeltaX *= 0.9;
    }
    
    // Apply altitude change based on touch input
    if (Math.abs(this.touchDeltaY) > 0.001) {
      // Negative touchDeltaY means swipe up, which should increase altitude
      const altitudeChange = -this.touchDeltaY * this.altitudeChangeSpeed * delta;
      this.position.y += altitudeChange;
      
      // Gradually reduce the touch delta
      this.touchDeltaY *= 0.9;
      
      // Limit minimum and maximum altitude
      this.position.y = Math.max(1, Math.min(20, this.position.y));
    }
    
    // Apply constant forward movement
    this.velocity.copy(
      this.direction.clone().multiplyScalar(this.moveSpeed)
    );
    
    // Make the model bank slightly during turns for visual effect
    if (this.playerModel) {
      if (this.touchDeltaX !== 0) {
        // Bank in the direction of the turn
        this.playerModel.rotation.z = -this.touchDeltaX * 0.5;
      } else {
        // Return to level flight
        this.playerModel.rotation.z *= 0.95;
      }
    }
  }
  
  /**
   * Handle new dual joystick + gyro controls
   * @param {number} delta - Time delta since last frame
   */
  handleNewControls(delta) {
    // ===== MOVEMENT (LEFT JOYSTICK) =====
    
    // Get movement input from left joystick
    const moveX = this.controlState.moveX; // -1 (left) to 1 (right)
    const moveY = this.controlState.moveY; // -1 (forward) to 1 (backward)
    
    // Calculate lateral movement (left/right strafe)
    const lateralDirection = new THREE.Vector3(1, 0, 0);
    lateralDirection.applyEuler(this.rotation);
    
    // Calculate forward/backward movement
    const forwardDirection = this.direction.clone();
    
    // Apply movement based on joystick input
    this.velocity.set(0, 0, 0);
    
    // Strafe left/right
    if (Math.abs(moveX) > 0.05) {
      this.velocity.add(
        lateralDirection.clone().multiplyScalar(moveX * this.moveSpeed)
      );
    }
    
    // Move forward/backward
    if (Math.abs(moveY) > 0.05) {
      // Invert moveY so that up is forward
      this.velocity.add(
        forwardDirection.clone().multiplyScalar(-moveY * this.moveSpeed)
      );
    }
    
    // Apply altitude change based on left joystick
    const altitudeControl = true; // Could be a configurable option
    if (altitudeControl && Math.abs(moveY) > 0.05) {
      const altitudeSpeed = 2; // Units per second
      this.position.y += moveY * altitudeSpeed * delta;
      
      // Limit minimum and maximum altitude
      this.position.y = Math.max(1, Math.min(20, this.position.y));
    }
    
    // ===== LOOK / ROTATION (RIGHT JOYSTICK) =====
    
    // Get look input from right joystick
    const lookX = this.controlState.lookX; // -1 (left) to 1 (right)
    const lookY = this.controlState.lookY; // -1 (up) to 1 (down)
    
    // Apply rotation based on right joystick or gyro
    // Since this.rightJoystick is undefined, we'll just use lookX/lookY to determine if right joystick is active
    const isRightJoystickActive = Math.abs(lookX) > 0.05 || Math.abs(lookY) > 0.05;
    const useGyroForRotation = this.controlState.gyroEnabled && !isRightJoystickActive;
    
    if (!useGyroForRotation) {
      // Use right joystick for rotation
      if (Math.abs(lookX) > 0.05) {
        this.rotation.y -= lookX * this.turnSpeed * delta;
      }
      
      if (Math.abs(lookY) > 0.05) {
        // Limit pitch to prevent flipping over
        const newPitch = this.rotation.x + lookY * this.turnSpeed * delta;
        this.rotation.x = Math.max(-Math.PI/4, Math.min(Math.PI/4, newPitch));
      }
    } else {
      // Use gyroscope for rotation if available and right joystick isn't active
      this.applyGyroRotation(delta);
    }
    
    // Apply banking effect during turns - only if playerModel exists
    if (this.playerModel) {
      const isTurning = Math.abs(lookX) > 0.05 || 
                       (useGyroForRotation && Math.abs(this.controlState.gyroData.gamma) > 5);
      
      if (isTurning) {
        // Bank in the direction of the turn
        const bankAmount = useGyroForRotation 
          ? -this.controlState.gyroData.gamma * 0.01 
          : -lookX * 0.5;
          
        this.playerModel.rotation.z = bankAmount;
      } else {
        // Return to level flight
        this.playerModel.rotation.z *= 0.95;
      }
    }
  }
  
  /**
   * Apply gyroscope data to player rotation
   * @param {number} delta - Time delta
   */
  applyGyroRotation(delta) {
    if (!this.controlState.gyroEnabled) return;
    
    const gyroData = this.controlState.gyroData;
    const reference = this.controlState.gyroReference;
    
    // Convert degrees to radians
    const toRadians = Math.PI / 180;
    
    // Calculate difference from reference orientation
    const diffGamma = (gyroData.gamma - reference.gamma) * toRadians;
    const diffBeta = (gyroData.beta - reference.beta) * toRadians;
    
    // Apply based on device orientation
    const isPortrait = window.innerHeight > window.innerWidth;
    
    if (isPortrait) {
      // Portrait mode - gamma controls yaw, beta controls pitch
      this.rotation.y += diffGamma * this.turnSpeed * delta * 0.1;
      
      // Limit pitch to prevent flipping
      const newPitch = this.rotation.x + diffBeta * this.turnSpeed * delta * 0.1;
      this.rotation.x = Math.max(-Math.PI/4, Math.min(Math.PI/4, newPitch));
    } else {
      // Landscape mode - beta controls yaw, gamma controls pitch
      this.rotation.y += diffBeta * this.turnSpeed * delta * 0.1;
      
      // Limit pitch
      const newPitch = this.rotation.x + diffGamma * this.turnSpeed * delta * 0.1;
      this.rotation.x = Math.max(-Math.PI/4, Math.min(Math.PI/4, newPitch));
    }
    
    // Update reference for relative movement
    this.controlState.gyroReference = { ...gyroData };
  }
  
  /**
   * Update camera position to follow the player
   */
  updateCameraPosition() {
    if (!this.camera) return;
    
    // Calculate camera position behind the player
    const cameraPosition = this.position.clone();
    
    // Apply offset in the direction player is facing
    const offsetVector = this.cameraOffset.clone();
    offsetVector.applyEuler(this.rotation);
    cameraPosition.add(offsetVector);
    
    // Update camera position
    this.camera.position.copy(cameraPosition);
    
    // Make camera look at a point ahead of the player
    const lookAtTarget = this.position.clone();
    const lookOffsetVector = this.cameraLookOffset.clone();
    lookOffsetVector.applyEuler(this.rotation);
    lookAtTarget.add(lookOffsetVector);
    
    this.camera.lookAt(lookAtTarget);
  }
  
  /**
   * Emit position and rotation update for multiplayer synchronization
   */
  emitPositionUpdate() {
    // Create quaternion from euler rotation
    const quaternion = new THREE.Quaternion();
    quaternion.setFromEuler(this.rotation);
    
    this.eventBus.emit('player:local-moved', {
      position: this.position.clone(),
      rotation: {
        x: quaternion.x,
        y: quaternion.y,
        z: quaternion.z,
        w: quaternion.w
      },
      isMobilePlayer: true // Flag to identify mobile players for rendering
    });
  }
  
  /**
   * Get the camera object
   * @returns {THREE.Camera} The third-person camera
   */
  getCamera() {
    return this.camera;
  }
  
  /**
   * Get player model
   * @returns {THREE.Object3D} The player model
   */
  getModel() {
    return this.playerModel;
  }
  
  /**
   * Dispose of all resources
   */
  dispose() {
    if (this.playerModel) {
      // Remove from scene
      this.scene.remove(this.playerModel);
      
      // Dispose geometries and materials
      this.playerModel.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(material => material.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
    }
    
    this.playerModel = null;
  }
}
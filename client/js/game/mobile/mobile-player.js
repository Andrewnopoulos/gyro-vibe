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
    // Listen for touch input from play.html
    this.eventBus.on('mobile:touch-start', this.onTouchStart.bind(this));
    this.eventBus.on('mobile:touch-move', this.onTouchMove.bind(this));
    this.eventBus.on('mobile:touch-end', this.onTouchEnd.bind(this));
    
    // Listen for device orientation updates
    this.eventBus.on('sensor:gyro-updated', this.onGyroUpdated.bind(this));
    
    // Animation update
    this.eventBus.on('scene:update', this.update.bind(this));
  }
  
  /**
   * Handle touch start event
   * @param {Object} data - Touch data
   */
  onTouchStart(data) {
    this.touchActive = true;
    this.lastTouchX = data.x;
    this.lastTouchY = data.y;
    this.touchDeltaX = 0;
    this.touchDeltaY = 0;
  }
  
  /**
   * Handle touch move event
   * @param {Object} data - Touch data
   */
  onTouchMove(data) {
    if (!this.touchActive) return;
    
    // Calculate touch deltas (normalized 0-1 coordinates)
    this.touchDeltaX = (data.x - this.lastTouchX) * 5; // Scale for sensitivity
    this.touchDeltaY = (data.y - this.lastTouchY) * 5; // Scale for sensitivity
    
    // Update last touch position
    this.lastTouchX = data.x;
    this.lastTouchY = data.y;
  }
  
  /**
   * Handle touch end event
   */
  onTouchEnd() {
    this.touchActive = false;
    this.touchDeltaX = 0;
    this.touchDeltaY = 0;
  }
  
  /**
   * Optional: Use gyro data for more intuitive controls
   * @param {Object} gyroData - Gyroscope orientation data
   */
  onGyroUpdated(gyroData) {
    // This could be used for more intuitive controls
    // For now, we'll stick with touch controls
  }
  
  /**
   * Update player position, rotation, and camera
   * @param {Object} data - Update data with delta time
   */
  update(data) {
    const { delta } = data;
    
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
    
    // Update direction vector from rotation
    this.direction.set(0, 0, -1).applyEuler(this.rotation);
    
    // Apply constant forward movement
    this.position.add(
      this.direction.clone().multiplyScalar(this.moveSpeed * delta)
    );
    
    // Apply changes to the model
    this.playerModel.position.copy(this.position);
    this.playerModel.rotation.copy(this.rotation);
    
    // Make the model bank slightly during turns for visual effect
    if (this.touchDeltaX !== 0) {
      // Bank in the direction of the turn
      this.playerModel.rotation.z = -this.touchDeltaX * 0.5;
    } else {
      // Return to level flight
      this.playerModel.rotation.z *= 0.95;
    }
    
    // Update camera position to follow player
    this.updateCameraPosition();
    
    // Emit position update for multiplayer
    this.emitPositionUpdate();
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
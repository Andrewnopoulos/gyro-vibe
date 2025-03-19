import * as THREE from 'three';

/**
 * Controls the gravity gun functionality allowing players to pick up and manipulate physics objects
 */
export class GravityGunController {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {SceneManager} sceneManager - The scene manager
   * @param {WeaponView} weaponView - The weapon view
   */
  constructor(eventBus, sceneManager, weaponView) {
    this.eventBus = eventBus;
    this.sceneManager = sceneManager;
    this.weaponView = weaponView;
    this.camera = sceneManager.getCamera();
    this.scene = sceneManager.getScene();
    this.enabled = false;
    this.isHolding = false;
    this.raycaster = new THREE.Raycaster();
    
    this.maxPickupDistance = 10; // Maximum distance to pick up objects
    this.heldObjectId = null;
    this.highlightedObject = null; // Reference to currently highlighted object
    
    // Debug properties 
    this.debugEnabled = true;
    this.lastRaycastTime = 0;
    this.raycastInterval = 100; // ms between debug logs to avoid spam
    
    // Create debug raycast line for visualization in world space
    this.debugRayLine = null;
    this.showDebugRay = true; // Set to false in production
    this.createDebugRayLine();
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Create a debug ray line to visualize raycasts in the main scene
   */
  createDebugRayLine() {
    if (!this.showDebugRay) return;
    
    // Create a line for debug visualization
    const material = new THREE.LineBasicMaterial({
      color: 0x00ff00, // Bright green for visibility
      transparent: true,
      opacity: 0.7,
      linewidth: 2
    });
    
    // Default points - will be updated in drawDebugRaycast
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -1)
    ];
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    
    // Create line and add to scene
    this.debugRayLine = new THREE.Line(geometry, material);
    this.debugRayLine.name = "DebugRaycast";
    this.scene.add(this.debugRayLine);
    
    // Initially hide it
    this.debugRayLine.visible = false;
  }
  
  /**
   * Set up event listeners for the gravity gun
   */
  setupEventListeners() {
    // Listen for first-person mode toggle
    this.eventBus.on('firstperson:enabled', () => {
      this.enabled = true;
    });
    
    this.eventBus.on('firstperson:disabled', () => {
      this.enabled = false;
      this.dropObject();
    });
    
    // Store bound functions to use for both adding and removing event listeners
    this.boundOnKeyDown = this.onKeyDown.bind(this);
    this.boundOnKeyUp = this.onKeyUp.bind(this);
    
    // Listen for key presses
    document.addEventListener('keydown', this.boundOnKeyDown);
    document.addEventListener('keyup', this.boundOnKeyUp);
    
    // Listen for weapon orientation updates
    this.eventBus.on('sensor:gyro-updated', this.updateOrientation.bind(this));
    
    // Listen for render loop updates to highlight available objects
    this.eventBus.on('scene:update', this.update.bind(this));
    
    // Listen for physics sync events to update held object properties
    this.eventBus.on('physics:object-pickup', this.handleObjectPickup.bind(this));
    this.eventBus.on('physics:object-drop', this.handleObjectDrop.bind(this));
  }
  
  /**
   * Update function called each frame
   * @param {Object} data - Contains delta time
   */
  update(data) {
    if (!this.enabled) return;
    
    // Limit the frequency of raycast updates to avoid performance issues
    const now = Date.now();
    if (now - this.lastRaycastTime < this.raycastInterval) {
      return;
    }
    this.lastRaycastTime = now;
    
    // Check if we're pointing at a physics object (for highlighting)
    const rayResult = this.performRaycast();
    
    // Feedback is now handled in the weapon view through the beam
    if (rayResult.hit && !this.isHolding) {
      // Emit an event for the weapon view to update visual feedback
      this.eventBus.emit('gravityGun:highlight', { targetFound: true });
    } else if (!this.isHolding) {
      // No target found
      this.eventBus.emit('gravityGun:highlight', { targetFound: false });
    }
    
    // If we're holding an object, update its position
    if (this.isHolding) {
      this.updateTargetPosition();
    }
  }
  
  /**
   * Handle keydown events
   * @param {KeyboardEvent} event - The keyboard event
   */
  onKeyDown(event) {
    if (!this.enabled) return;
    
    if (event.code === 'KeyE') {
      // Force a raycast update right before attempting to pick up
      const raycastResult = this.performRaycast();
      
      if (!this.isHolding) {
        this.pickupObject();
      } else {
        this.dropObject();
      }
    }
    
    // Toggle debug raycast visualization with V key
    if (event.code === 'KeyV' && !event.repeat) {
      this.toggleDebugRaycast();
    }
    
    // Spawn random physics object with T key
    if (event.code === 'KeyT') {
      this.spawnRandomObject();
    }
    
    // Add force to held object with WASD keys
    if (this.isHolding) {
      let forceDirection = null;
      
      switch (event.code) {
        case 'KeyW': // Push forward
          forceDirection = new THREE.Vector3(0, 0, -1);
          break;
        case 'KeyS': // Pull back
          forceDirection = new THREE.Vector3(0, 0, 1);
          break;
        case 'KeyA': // Push left
          forceDirection = new THREE.Vector3(-1, 0, 0);
          break;
        case 'KeyD': // Push right
          forceDirection = new THREE.Vector3(1, 0, 0);
          break;
        case 'KeyQ': // Push down
          forceDirection = new THREE.Vector3(0, -1, 0);
          break;
        case 'KeyR': // Push up
          forceDirection = new THREE.Vector3(0, 1, 0);
          break;
      }
      
      if (forceDirection) {
        // Apply direction relative to camera orientation
        forceDirection.applyQuaternion(this.camera.quaternion);
        
        // Scale the force
        forceDirection.multiplyScalar(5);
        
        // Apply force through event
        this.eventBus.emit('gravityGun:apply-force', {
          objectId: this.heldObjectId,
          force: {
            x: forceDirection.x,
            y: forceDirection.y,
            z: forceDirection.z
          }
        });
      }
    }
  }
  
  /**
   * Handle keyup events
   * @param {KeyboardEvent} event - The keyboard event
   */
  onKeyUp(event) {
    if (!this.enabled) return;
    
    // Add additional key handling if needed
  }
  
  /**
   * Update based on gyro orientation
   * @param {Object} gyroData - The gyroscope data
   */
  updateOrientation(gyroData) {
    if (!this.enabled) return;
    
    // If we're holding an object, ensure the visual beam is updated
    if (this.isHolding) {
      this.updateTargetPosition();
    }
  }
  
  /**
   * Perform a raycast from the weapon position
   * @returns {Object} Object with hit boolean and raycast results
   */
  performRaycast() {
    // Get raycast data from the weapon view
    if (!this.weaponView) {
      return { hit: false };
    }
    
    const raycastData = this.weaponView.getRaycastData();
    if (!raycastData) {
      return { hit: false };
    }
    
    // Transform the raycast data from weapon view space to world space
    const mainCamera = this.camera;
    const weaponWorldPosition = this.weaponView.mapToWorldSpace(raycastData.origin, mainCamera);
    
    // Get the direction from the weapon's orientation
    const weaponWorldDirection = this.weaponView.getWorldDirectionFromWeapon(mainCamera.quaternion);
    
    // Draw a debug line in the main scene to visualize the raycast
    this.drawDebugRaycast(weaponWorldPosition, weaponWorldDirection);
    
    // Set up raycaster with max distance
    this.raycaster.set(weaponWorldPosition, weaponWorldDirection);
    this.raycaster.far = this.maxPickupDistance;
    
    // Raycast to find intersected objects
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);

    // Filter out objects without physics
    const physicsIntersects = intersects.filter(intersect => 
      intersect.object.userData && intersect.object.userData.physicsId
    );
    
    if (physicsIntersects.length > 0) {
      // Add visual highlight to the intersected object
      this.highlightIntersectedObject(physicsIntersects[0].object);
      
      return {
        hit: true,
        intersection: physicsIntersects[0],
        weaponPosition: weaponWorldPosition,
        weaponDirection: weaponWorldDirection
      };
    }
    
    return {
      hit: false,
      weaponPosition: weaponWorldPosition,
      weaponDirection: weaponWorldDirection
    };
  }
  
  /**
   * Attempt to pick up an object with the gravity gun
   */
  pickupObject() {
    if (!this.enabled || this.isHolding) return;
    
    const rayResult = this.performRaycast();
    
    if (rayResult.hit) {
      // Get the physics object ID from the userData
      this.heldObjectId = rayResult.intersection.object.userData.physicsId;
      
      // Create ray data for physics system with safety checks
      const ray = {
        origin: rayResult.weaponPosition ? {
          x: rayResult.weaponPosition.x || 0,
          y: rayResult.weaponPosition.y || 0,
          z: rayResult.weaponPosition.z || 0
        } : {x: 0, y: 0, z: 0},
        direction: rayResult.weaponDirection ? {
          x: rayResult.weaponDirection.x || 0,
          y: rayResult.weaponDirection.y || 0,
          z: rayResult.weaponDirection.z || 0
        } : {x: 0, y: 0, z: 0},
        // The collision point in world space is needed by the physics manager
        hitPoint: rayResult.intersection.point ? {
          x: rayResult.intersection.point.x || 0,
          y: rayResult.intersection.point.y || 0,
          z: rayResult.intersection.point.z || 0
        } : {x: 0, y: 0, z: 0}
      };
      
      // Create pickup data with all necessary information
      const pickupData = { 
        ray, 
        sourceId: 'local',
        objectId: this.heldObjectId
      };
      
      // Emit pickup event to physics system
      this.eventBus.emit('gravityGun:pickup', pickupData);
      
      // Set holding state
      this.isHolding = true;
      
      // Make sure the object is highlighted while held
      this.highlightIntersectedObject(rayResult.intersection.object);
    }
  }
  
  /**
   * Drop the currently held object
   */
  dropObject() {
    if (!this.isHolding) return;
    
    // Emit drop event with context
    this.eventBus.emit('gravityGun:drop', {
      objectId: this.heldObjectId,
      playerId: 'local'
    });
    
    // Remove highlight
    this.removeObjectHighlights();
    
    // Reset holding state
    this.isHolding = false;
    this.heldObjectId = null;
  }
  
  /**
   * Update the target position for held objects
   */
  updateTargetPosition() {
    if (!this.isHolding || !this.weaponView) return;
    
    // Get raycast data from the weapon view
    const raycastData = this.weaponView.getRaycastData();
    if (!raycastData) return;
    
    // Transform to world space
    const mainCamera = this.camera;
    const weaponWorldPosition = this.weaponView.mapToWorldSpace(raycastData.origin, mainCamera);
    const weaponWorldDirection = raycastData.direction.clone().applyQuaternion(mainCamera.quaternion);
    
    // Update target position (held 2-4 meters in front of weapon)
    // The physics system will handle the actual movement
    const holdDistance = 3; // meters
    const targetPosition = weaponWorldPosition.clone().add(
      weaponWorldDirection.multiplyScalar(holdDistance)
    );
    
    // Send to physics system
    this.eventBus.emit('gravityGun:update-target', {
      objectId: this.heldObjectId,
      position: targetPosition,
      rotation: mainCamera.quaternion
    });
  }
  
  /**
   * Handle object pickup events (from local or remote players)
   * @param {Object} data - Pickup event data
   */
  handleObjectPickup(data) {
    const { id, playerId } = data;
    
    // If this is our object, update our state
    if (playerId === 'local') {
      this.heldObjectId = id;
      this.isHolding = true;
      
      // Find the object in the scene to highlight it
      this.scene.traverse((object) => {
        if (object.userData && object.userData.physicsId === id) {
          this.highlightIntersectedObject(object);
        }
      });
    }
  }
  
  /**
   * Handle object drop events (from local or remote players)
   * @param {Object} data - Drop event data
   */
  handleObjectDrop(data) {
    const { id, playerId } = data;
    
    // If this is our object, reset our state
    if (playerId === 'local' && this.heldObjectId === id) {
      this.heldObjectId = null;
      this.isHolding = false;
      
      // Remove object highlight when dropped
      this.removeObjectHighlights();
    }
  }
  
  /**
   * Spawn a random physics object in front of the player
   */
  spawnRandomObject() {
    if (!this.enabled) return;
    
    // Get camera position and direction
    const cameraPosition = this.camera.position.clone();
    const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
    
    // Spawn position 3-5 meters in front of the camera, slightly randomized
    const distance = 3 + Math.random() * 2;
    const spawnPosition = cameraPosition.clone().add(
      cameraDirection.clone().multiplyScalar(distance)
    );
    
    // Add some random offset to prevent objects spawning exactly on top of each other
    spawnPosition.x += (Math.random() - 0.5) * 0.5;
    spawnPosition.y += (Math.random() - 0.5) * 0.5;
    spawnPosition.z += (Math.random() - 0.5) * 0.5;
    
    // Generate random properties for the object
    const randomObject = this.generateRandomObjectProps();
    
    // Emit event to create the physics object
    this.eventBus.emit('physics:spawn-object', {
      ...randomObject,
      position: {
        x: spawnPosition.x,
        y: spawnPosition.y,
        z: spawnPosition.z
      }
    });
    
    // Show temporary feedback for object spawning
    if (this.reticle && this.reticle.material) {
      const originalColor = this.reticle.material.color.clone();
      this.reticle.material.color.set(0xffff00); // Yellow flash
      
      // Reset after a short delay
      setTimeout(() => {
        if (this.reticle && this.reticle.material) {
          this.reticle.material.color.copy(originalColor);
        }
      }, 200);
    }
  }
  
  /**
   * Generate random properties for a physics object
   * @returns {Object} Random object properties
   */
  generateRandomObjectProps() {
    // Random shape type
    const shapeTypes = ['box', 'sphere', 'cylinder'];
    const randomShape = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
    
    // Random size (not too large or too small)
    const baseSize = 0.3 + Math.random() * 0.7;
    let size;
    
    if (randomShape === 'box') {
      // Slightly varied dimensions for boxes
      size = {
        x: baseSize * (0.8 + Math.random() * 0.4),
        y: baseSize * (0.8 + Math.random() * 0.4),
        z: baseSize * (0.8 + Math.random() * 0.4)
      };
    } else if (randomShape === 'cylinder') {
      // Cylinders have consistent x/z, but varied height
      size = {
        x: baseSize,
        y: baseSize * (1 + Math.random()),
        z: baseSize
      };
    } else {
      // Spheres are uniform
      size = {
        x: baseSize,
        y: baseSize,
        z: baseSize
      };
    }
    
    // Random mass - heavier objects are less common
    const mass = Math.random() < 0.7 ? 
      0.5 + Math.random() * 1.5 : // Light (70% chance)
      2 + Math.random() * 5;     // Heavy (30% chance)
    
    // Random color - generate a nice color
    const hue = Math.random();
    const saturation = 0.5 + Math.random() * 0.5;
    const lightness = 0.4 + Math.random() * 0.4;
    
    // Convert HSL to RGB hex
    const color = new THREE.Color().setHSL(hue, saturation, lightness);
    
    // Random material properties
    const metallic = Math.random() < 0.3; // 30% chance of metallic
    const restitution = 0.2 + Math.random() * 0.6; // Bounciness
    
    return {
      size,
      mass,
      color: color.getHex(),
      shape: randomShape,
      metallic,
      restitution
    };
  }
  
  /**
   * Highlight an intersected physics object to provide visual feedback
   * @param {THREE.Object3D} object - The intersected object
   */
  highlightIntersectedObject(object) {
    // Remove any existing highlight from previous objects
    this.removeObjectHighlights();
    
    // If the object has a material, store original color and change to highlight color
    if (object.material) {
      // Store original color if not already stored
      if (!object.userData.originalColor) {
        object.userData.originalColor = object.material.color.clone();
      }
      
      // Change to highlight color
      object.material.emissive = new THREE.Color(0x33ff33);
      object.material.emissiveIntensity = 0.5;
      object.material.needsUpdate = true;
      
      // Store reference to highlighted object
      this.highlightedObject = object;
      
      // Clear highlight after a short delay
      setTimeout(() => {
        if (this.highlightedObject === object && !this.isHolding) {
          this.removeObjectHighlights();
        }
      }, 500);
    }
  }
  
  /**
   * Remove highlight from previously highlighted objects
   */
  removeObjectHighlights() {
    if (this.highlightedObject) {
      // Restore original material properties
      if (this.highlightedObject.material) {
        this.highlightedObject.material.emissive = new THREE.Color(0x000000);
        this.highlightedObject.material.emissiveIntensity = 0;
        this.highlightedObject.material.needsUpdate = true;
      }
      
      this.highlightedObject = null;
    }
  }
  
  /**
   * Draw or update the debug raycast visualization in the main scene
   * @param {THREE.Vector3} origin - Origin point of the raycast
   * @param {THREE.Vector3} direction - Direction vector of the raycast
   */
  drawDebugRaycast(origin, direction) {
    if (!this.showDebugRay || !this.debugRayLine) return;
    
    // Make the debug line visible
    this.debugRayLine.visible = true;
    
    // Calculate end point based on direction and max distance
    const endPoint = origin.clone().add(
      direction.clone().multiplyScalar(this.maxPickupDistance)
    );
    
    // Update the line geometry
    const points = [origin, endPoint];
    this.debugRayLine.geometry.dispose();
    this.debugRayLine.geometry = new THREE.BufferGeometry().setFromPoints(points);
  }
  
  /**
   * Toggle the debug raycast visualization
   */
  toggleDebugRaycast() {
    this.showDebugRay = !this.showDebugRay;
    
    if (this.debugRayLine) {
      this.debugRayLine.visible = this.showDebugRay;
    }
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    // Remove any object highlights
    this.removeObjectHighlights();
    
    // Remove debug raycast line
    if (this.debugRayLine && this.debugRayLine.parent) {
      this.debugRayLine.parent.remove(this.debugRayLine);
      if (this.debugRayLine.geometry) {
        this.debugRayLine.geometry.dispose();
      }
      if (this.debugRayLine.material) {
        this.debugRayLine.material.dispose();
      }
      this.debugRayLine = null;
    }
    
    // Remove event listeners
    document.removeEventListener('keydown', this.boundOnKeyDown);
    document.removeEventListener('keyup', this.boundOnKeyUp);
  }
}
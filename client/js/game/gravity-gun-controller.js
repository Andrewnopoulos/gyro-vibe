import * as THREE from 'three';

/**
 * Controls the gravity gun functionality allowing players to pick up and manipulate physics objects
 */
export class GravityGunController {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {SceneManager} sceneManager - The scene manager
   */
  constructor(eventBus, sceneManager) {
    this.eventBus = eventBus;
    this.sceneManager = sceneManager;
    this.camera = sceneManager.getCamera();
    this.scene = sceneManager.getScene();
    this.enabled = false;
    this.isHolding = false;
    this.raycaster = new THREE.Raycaster();
    
    // Visual elements
    this.gravityBeam = null;
    this.reticle = null;
    this.maxPickupDistance = 10; // Maximum distance to pick up objects
    this.heldObjectId = null;
    
    // Visual feedback for player
    this.createReticle();
    
    // Set up event listeners
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners for the gravity gun
   */
  setupEventListeners() {
    // Listen for first-person mode toggle
    this.eventBus.on('firstperson:enabled', () => {
      this.enabled = true;
      if (this.reticle) this.reticle.visible = true;
    });
    
    this.eventBus.on('firstperson:disabled', () => {
      this.enabled = false;
      if (this.reticle) this.reticle.visible = false;
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
   * Create a reticle/crosshair for aiming
   */
  createReticle() {
    // Create a simple crosshair using lines
    const material = new THREE.LineBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.8
    });
    
    const size = 0.01; // Size relative to screen
    const geometry = new THREE.BufferGeometry();
    
    // Create crosshair lines
    const points = [
      // Horizontal line
      new THREE.Vector3(-size, 0, 0),
      new THREE.Vector3(size, 0, 0),
      // Vertical line
      new THREE.Vector3(0, -size, 0),
      new THREE.Vector3(0, size, 0),
      // Center dot outline
      new THREE.Vector3(-size/3, -size/3, 0),
      new THREE.Vector3(size/3, -size/3, 0),
      new THREE.Vector3(size/3, size/3, 0),
      new THREE.Vector3(-size/3, size/3, 0),
      new THREE.Vector3(-size/3, -size/3, 0)
    ];
    
    geometry.setFromPoints(points);
    
    // Create the line
    this.reticle = new THREE.Line(geometry, material);
    
    // Position the reticle in front of the camera so it's always visible
    this.reticle.position.set(0, 0, -0.5);
    
    // Add to camera so it moves with the view
    this.camera.add(this.reticle);
    
    // Initially invisible if not in first person mode
    this.reticle.visible = this.enabled;
  }
  
  /**
   * Update function called each frame
   * @param {Object} data - Contains delta time
   */
  update(data) {
    if (!this.enabled) return;
    
    // Check if we're pointing at a physics object (for highlighting)
    const rayResult = this.performRaycast();
    
    if (rayResult.hit && !this.isHolding) {
      // Change reticle color to indicate a valid target
      if (this.reticle && this.reticle.material) {
        this.reticle.material.color.set(0x00ff00); // Green when over valid object
      }
    } else if (!this.isHolding) {
      // Reset reticle color
      if (this.reticle && this.reticle.material) {
        this.reticle.material.color.set(0x00aaff); // Blue default
      }
    } else {
      // Holding an object - reticle is orange
      if (this.reticle && this.reticle.material) {
        this.reticle.material.color.set(0xff9900); // Orange when holding
      }
    }
  }
  
  /**
   * Handle keydown events
   * @param {KeyboardEvent} event - The keyboard event
   */
  onKeyDown(event) {
    console.log('Key pressed:', event.code, 'Controller enabled:', this.enabled);
    if (!this.enabled) return;
    
    if (event.code === 'KeyE') {
      console.log('E key pressed, isHolding:', this.isHolding);
      if (!this.isHolding) {
        this.pickupObject();
      } else {
        this.dropObject();
      }
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
    // Get the current weapon position and direction
    const weaponPhone = this.getWeaponPosition();
    if (!weaponPhone) return { hit: false };
    
    // Create a ray from the weapon
    const weaponPosition = new THREE.Vector3();
    weaponPhone.getWorldPosition(weaponPosition);
    
    const weaponDirection = new THREE.Vector3(0, 0, -1);
    weaponDirection.applyQuaternion(weaponPhone.quaternion);
    
    // Set up raycaster with max distance
    this.raycaster.set(weaponPosition, weaponDirection);
    this.raycaster.far = this.maxPickupDistance;
    
    // Raycast to find intersected objects
    const intersects = this.raycaster.intersectObjects(this.scene.children, true);
    
    // Debug original intersects
    console.log('Raycast intersects found:', intersects.length);
    if (intersects.length > 0) {
      console.log('First intersect object:', intersects[0].object);
      console.log('userData:', intersects[0].object.userData);
    }

    // Filter out objects without physics
    const physicsIntersects = intersects.filter(intersect => 
      intersect.object.userData && intersect.object.userData.physicsId
    );
    
    console.log('Physics intersects found:', physicsIntersects.length);
    
    if (physicsIntersects.length > 0) {
      console.log('Found physics object with ID:', physicsIntersects[0].object.userData.physicsId);
      return {
        hit: true,
        intersection: physicsIntersects[0],
        weaponPosition,
        weaponDirection
      };
    }
    
    return {
      hit: false,
      weaponPosition,
      weaponDirection
    };
  }
  
  /**
   * Attempt to pick up an object with the gravity gun
   */
  pickupObject() {
    console.log('pickupObject called, enabled:', this.enabled, 'isHolding:', this.isHolding);
    if (!this.enabled || this.isHolding) return;
    
    const rayResult = this.performRaycast();
    console.log('Raycast result:', rayResult);
    
    if (rayResult.hit) {
      console.log('Hit detected, object ID:', rayResult.intersection.object.userData.physicsId);
      
      // Get the physics object ID from the userData
      this.heldObjectId = rayResult.intersection.object.userData.physicsId;
      
      // Create ray data for physics system
      const ray = {
        origin: rayResult.weaponPosition,
        direction: rayResult.weaponDirection
      };
      
      // Emit pickup event to physics system
      console.log('Emitting gravityGun:pickup event with ray:', ray);
      this.eventBus.emit('gravityGun:pickup', { ray, sourceId: 'local' });
      
      // Set holding state
      this.isHolding = true;
      
      // Update reticle to show holding state
      if (this.reticle && this.reticle.material) {
        this.reticle.material.color.set(0xff9900); // Orange when holding
      }
      
      // Start pulsing effect on reticle to indicate active gravity gun
      this.startReticlePulse();
    } else {
      console.log('No hit detected in raycast');
    }
  }
  
  /**
   * Start a pulsing animation on the reticle
   */
  startReticlePulse() {
    if (!this.reticle) return;
    
    // Clear any existing animation
    if (this.reticlePulseAnimation) {
      clearInterval(this.reticlePulseAnimation);
    }
    
    // Create pulsing effect
    let pulseValue = 0;
    let increasing = true;
    
    this.reticlePulseAnimation = setInterval(() => {
      if (!this.isHolding) {
        clearInterval(this.reticlePulseAnimation);
        this.reticlePulseAnimation = null;
        return;
      }
      
      // Update pulse value
      if (increasing) {
        pulseValue += 0.05;
        if (pulseValue >= 1) {
          pulseValue = 1;
          increasing = false;
        }
      } else {
        pulseValue -= 0.05;
        if (pulseValue <= 0.4) {
          pulseValue = 0.4;
          increasing = true;
        }
      }
      
      // Apply scale effect
      const baseScale = 1;
      const scale = baseScale * (1 + pulseValue * 0.3);
      this.reticle.scale.set(scale, scale, scale);
      
      // Apply opacity effect
      if (this.reticle.material) {
        this.reticle.material.opacity = 0.5 + pulseValue * 0.5;
      }
    }, 30);
  }
  
  /**
   * Drop the currently held object
   */
  dropObject() {
    console.log('dropObject called, isHolding:', this.isHolding);
    if (!this.isHolding) return;
    
    // Emit drop event
    console.log('Emitting gravityGun:drop event');
    this.eventBus.emit('gravityGun:drop');
    
    // Reset holding state
    this.isHolding = false;
    this.heldObjectId = null;
    
    // Reset reticle
    if (this.reticle && this.reticle.material) {
      this.reticle.material.color.set(0x00aaff);
      this.reticle.material.opacity = 0.8;
      this.reticle.scale.set(1, 1, 1);
    }
    
    // Clear pulse animation
    if (this.reticlePulseAnimation) {
      clearInterval(this.reticlePulseAnimation);
      this.reticlePulseAnimation = null;
    }
  }
  
  /**
   * Update the target position for held objects
   */
  updateTargetPosition() {
    if (!this.isHolding) return;
    
    // Get weapon position and direction
    const weaponPhone = this.getWeaponPosition();
    if (!weaponPhone) return;
    
    const weaponPosition = new THREE.Vector3();
    weaponPhone.getWorldPosition(weaponPosition);
    
    const weaponDirection = new THREE.Vector3(0, 0, -1);
    weaponDirection.applyQuaternion(weaponPhone.quaternion);
    
    // Update target position (held 2-4 meters in front of weapon)
    // The physics system will handle the actual movement
    const holdDistance = 3; // meters
    const targetPosition = weaponPosition.clone().add(
      weaponDirection.multiplyScalar(holdDistance)
    );
    
    // Send to physics system (it will update the visual beam)
    this.eventBus.emit('gravityGun:update-target', {
      objectId: this.heldObjectId,
      position: targetPosition,
      rotation: weaponPhone.quaternion
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
      
      // Reset reticle
      if (this.reticle && this.reticle.material) {
        this.reticle.material.color.set(0x00aaff);
        this.reticle.material.opacity = 0.8;
        this.reticle.scale.set(1, 1, 1);
      }
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
   * Get the phone model object
   * @returns {THREE.Object3D} The phone model object
   */
  getWeaponPosition() {
    // Get position and rotation of phone model in first person view
    const phoneModel = this.scene.getObjectByName('phoneModel');
    
    if (!phoneModel) {
      console.warn('Phone model not found in scene, falling back to camera');
      // Fallback to camera if phone model not found
      return this.camera;
    }
    
    return phoneModel;
  }
  
  /**
   * Clean up resources
   */
  dispose() {
    // Remove event listeners
    document.removeEventListener('keydown', this.boundOnKeyDown);
    document.removeEventListener('keyup', this.boundOnKeyUp);
    
    // Clear reticle pulse animation
    if (this.reticlePulseAnimation) {
      clearInterval(this.reticlePulseAnimation);
      this.reticlePulseAnimation = null;
    }
    
    // Clean up reticle
    if (this.reticle) {
      this.camera.remove(this.reticle);
      if (this.reticle.geometry) this.reticle.geometry.dispose();
      if (this.reticle.material) this.reticle.material.dispose();
      this.reticle = null;
    }
  }
}
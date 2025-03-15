import * as THREE from 'three';
import { PHYSICS, DEBUG_CONFIG } from '../config.js';

/**
 * Manages physics and collision detection for the game
 */
export class PhysicsManager {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {THREE.Scene} scene - The ThreeJS scene
   */
  constructor(eventBus, scene) {
    this.eventBus = eventBus;
    this.scene = scene;
    this.colliders = [];
    this.ground = null; // Explicit reference to the ground
    this.debugHelpers = [];
    this.raycaster = new THREE.Raycaster();
    
    // Create a debug helper for ground detection
    this.debugRay = new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(0, 0, 0),
      10,
      0xff0000
    );
    
    if (DEBUG_CONFIG.SHOW_COLLISION_HELPERS) {
      this.scene.add(this.debugRay);
    }
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Create a simple floor plane to guarantee there's always a ground
    this.createBackupFloor();
  }
  
  /**
   * Create a backup floor plane to ensure the player always has a surface
   */
  createBackupFloor() {
    const floorGeometry = new THREE.PlaneGeometry(1000, 1000);
    const floorMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide
    });
    
    this.backupFloor = new THREE.Mesh(floorGeometry, floorMaterial);
    this.backupFloor.rotation.x = Math.PI / 2;
    this.backupFloor.position.y = -0.5;
    this.backupFloor.userData.isGround = true;
    this.backupFloor.userData.isBackupFloor = true;
    
    // Add to scene and colliders immediately
    this.scene.add(this.backupFloor);
    this.colliders.push(this.backupFloor);
    
    console.log("Added backup floor for collision safety");
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for environment loaded event to collect colliders
    this.eventBus.on('environment:loaded', (data) => {
      console.log("Environment loaded, collecting colliders...");
      
      // If ground was directly provided, store it
      if (data && data.ground) {
        this.ground = data.ground;
        console.log("Direct ground reference received:", this.ground);
      }
      
      this.collectColliders();
    });
  }
  
  /**
   * Collect all objects in the scene that should be used for collision detection
   */
  collectColliders() {
    // Keep the backup floor but remove other colliders
    this.colliders = this.colliders.filter(c => c.userData && c.userData.isBackupFloor);
    
    // Find all objects that should be used for collision detection
    this.scene.traverse((object) => {
      // Only include mesh objects and exclude certain types if needed
      if (object.isMesh && !object.userData.noCollision) {
        this.colliders.push(object);
        
        // Identify ground objects for special handling
        if (object.userData && object.userData.isGround) {
          this.ground = object;
          console.log("Found ground object during traversal:", object);
        }
        
        // Create debug visualizations if enabled
        if (DEBUG_CONFIG.SHOW_COLLISION_HELPERS) {
          this.createDebugHelper(object);
        }
      }
    });
    
    console.log(`Physics system collected ${this.colliders.length} colliders`);
    if (this.ground) {
      console.log("Ground object registered for collision detection");
    } else {
      console.warn("No explicit ground object found, using backup floor");
    }
  }
  
  /**
   * Create debug visualization for a collider
   * @param {THREE.Object3D} collider - The collider object
   */
  createDebugHelper(collider) {
    // Create wireframe visualization
    const bbox = new THREE.Box3().setFromObject(collider);
    const helper = new THREE.Box3Helper(bbox, 0xff0000);
    this.scene.add(helper);
    this.debugHelpers.push(helper);
  }
  
  /**
   * Simple method to keep player above the ground
   * @param {THREE.Vector3} position - Player position
   * @param {number} playerHeight - Player height
   */
  enforceGroundConstraint(position) {
    // Minimum height is the floor level (y = -0.5) plus half player height
    const minHeight = -0.5 + PHYSICS.PLAYER_RADIUS + 0.1;
    
    if (position.y < minHeight) {
      position.y = minHeight;
      return true; // Ground contact made
    }
    
    return false; // No ground constraint applied
  }
  
  /**
   * Check if a point is colliding with any collidable objects
   * @param {THREE.Vector3} position - The position to check
   * @param {number} radius - The collision radius
   * @returns {boolean} Whether there is a collision
   */
  checkPointCollision(position, radius) {
    // Special case for ground collision
    if (position.y - radius < -0.5) {
      return true;
    }
    
    // Check collisions with scene objects
    for (const collider of this.colliders) {
      // Skip objects that are too far away to collide
      if (collider.position.distanceTo(position) > 20) continue;
      
      // Get the bounding box of the collider
      const bbox = new THREE.Box3().setFromObject(collider);
      
      // Expand the bounding box by the radius
      bbox.expandByScalar(radius);
      
      // Check if the position is inside the expanded bounding box
      if (bbox.containsPoint(position)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Simplified sliding collision that prioritizes keeping the player above ground
   * @param {THREE.Vector3} start - Start position
   * @param {THREE.Vector3} end - End position
   * @param {number} radius - Collision radius
   * @returns {THREE.Vector3} Adjusted end position
   */
  collideAndSlide(start, end, radius) {
    // Create result position
    const result = end.clone();
    
    // First enforce ground constraint (most important)
    const groundContact = this.enforceGroundConstraint(result);
    
    // If we don't have ground contact, check other collisions
    if (!groundContact) {
      // Check if end position collides with anything
      if (this.checkPointCollision(end, radius)) {
        // If collision detected, just return the start position
        // This is a simplified approach that prevents getting stuck
        return start.clone();
      }
    }
    
    return result;
  }
  
  /**
   * Check if the player is standing on the ground
   * @param {THREE.Vector3} position - The player's position
   * @param {number} playerHeight - The player's height
   * @returns {boolean} Whether the player is on the ground
   */
  isOnGround(position, playerHeight) {
    // Simple ground detection based on height
    // If we're very close to the minimum height, we're on the ground
    if (position.y <= (-0.5 + PHYSICS.PLAYER_RADIUS + 0.2)) {
      return true;
    }
    
    // Cast a ray downward from the player's position
    const rayOrigin = position.clone();
    const feetPosition = position.y - playerHeight/2 + PHYSICS.PLAYER_RADIUS;
    
    // Set ray to start from the feet
    rayOrigin.y = feetPosition;
    
    // Set the ray direction downward
    const downDirection = new THREE.Vector3(0, -1, 0);
    
    // Update debug ray if visualizations are enabled
    if (DEBUG_CONFIG.SHOW_COLLISION_HELPERS) {
      this.debugRay.position.copy(rayOrigin);
      this.debugRay.setDirection(downDirection);
      this.debugRay.setLength(PHYSICS.GROUND_CHECK_DISTANCE * 2);
    }
    
    // Cast the ray
    this.raycaster.set(rayOrigin, downDirection);
    const intersects = this.raycaster.intersectObjects(this.colliders);
    
    // If we hit something nearby, we're on the ground
    const onGround = intersects.length > 0 && 
                   intersects[0].distance < PHYSICS.GROUND_CHECK_DISTANCE;
                   
    return onGround;
  }
}
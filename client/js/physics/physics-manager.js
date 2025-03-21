import * as CANNON from 'cannon-es';
import * as THREE from 'three';

export class PhysicsManager {
  /**
   * Creates and manages physics objects using Cannon.js
   * @param {EventBus} eventBus - Application event bus
   * @param {THREE.Scene} scene - Three.js scene
   * @param {SocketManager} socketManager - Socket.IO manager for network communication (optional)
   */
  constructor(eventBus, scene, socketManager = null) {
    this.eventBus = eventBus;
    this.scene = scene;
    this.socketManager = socketManager;
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0); // Earth gravity
    this.physicsBodies = new Map(); // Map of ID -> {body, mesh}
    this.timeStep = 1/60;
    
    // For gravity gun functionality
    this.heldBody = null;
    this.bodyOffset = new CANNON.Vec3(0, 0, 0); // Initialize with zeros
    this.targetPosition = new CANNON.Vec3();
    this.targetRotation = new CANNON.Quaternion();
    this.heldBodyId = null;
    this.holdingPlayerId = null;
    
    this.setupEventListeners();
    this.init();
  }
  
  init() {
    // Initialize physics world
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
    
    // Add ground plane
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0 }); // Mass 0 makes it static
    groundBody.addShape(groundShape);
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2); // Rotate to be horizontal
    this.world.addBody(groundBody);
  }
  
  setupEventListeners() {
    // Listen for update events
    this.eventBus.on('scene:update', this.update.bind(this));
    
    // Listen for physics commands from gravity gun controller
    this.eventBus.on('physics:pickup-object', this.pickupObject.bind(this));
    this.eventBus.on('physics:drop-object', this.dropObject.bind(this));
    this.eventBus.on('physics:update-target', this.updateHeldObjectTarget.bind(this));
    this.eventBus.on('physics:apply-force', this.applyForceToObject.bind(this));
    this.eventBus.on('physics:spawn-object', this.createPhysicsObject.bind(this));
    
    // Multiplayer events
    this.eventBus.on('multiplayer:room-joined', this.handleRoomJoined.bind(this));
    this.eventBus.on('multiplayer:room-left', this.handleRoomLeft.bind(this));
    
    // Sync physics objects
    this.eventBus.on('physics:sync', this.handlePhysicsSync.bind(this));
    
    // Socket events for remote physics if socket manager provided
    if (this.socketManager) {
      this.socketManager.on('physics:object-pickup', this.handleRemoteObjectPickup.bind(this));
      this.socketManager.on('physics:object-drop', this.handleRemoteObjectDrop.bind(this));
      this.socketManager.on('physics:object-created', this.handleRemoteObjectCreated.bind(this));
    }
  }
  
  update(data) {
    const { delta } = data;
    
    // Step the physics simulation
    this.world.step(this.timeStep, delta, 3);
    
    // Update visual objects to match physics bodies
    this.physicsBodies.forEach((physicsObj, id) => {
      const { body, mesh } = physicsObj;
      
      // Update position
      mesh.position.copy(body.position);
      mesh.quaternion.copy(body.quaternion);
      
      // If this is a held object, update its position
      if (this.heldBody === body) {
        this.updateHeldBody();
      }
      
      // Update remote gravity beams for objects held by other players
      if (physicsObj.heldByRemotePlayer && physicsObj.remoteBeam) {
        this.updateRemoteGravityBeam(id, physicsObj.heldByRemotePlayer);
      }
    });
    
    // Emit physics state for multiplayer synchronization
    if (this.shouldEmitSync()) {
      this.emitPhysicsState();
    }
  }
  
  /**
   * Update visual beam effect for remote player holding object
   * @param {string} objectId - ID of the object
   * @param {string} playerId - ID of the player holding
   */
  updateRemoteGravityBeam(objectId, playerId) {
    const physicsObj = this.physicsBodies.get(objectId);
    if (!physicsObj || !physicsObj.remoteBeam) return;
    
    // Get the player's position (if available in the scene)
    let playerPosition = null;
    
    // First try to find remote player by ID
    const playerModel = this.scene.getObjectByName(`player_${playerId}`);
    if (playerModel) {
      playerPosition = new THREE.Vector3();
      playerModel.getWorldPosition(playerPosition);
    } else {
      // Fallback position if player model not found
      playerPosition = new THREE.Vector3(0, 1, 0);
    }
    
    // Get object position
    const objectPosition = this.getPositionFromBody(physicsObj.body);
    
    // Update beam geometry
    this.updateBeamGeometry(physicsObj.remoteBeam, playerPosition, objectPosition);
  }
  
  createPhysicsObject(options = {}) {
    const { 
      position = { x: 0, y: 5, z: 0 },
      size = { x: 1, y: 1, z: 1 },
      mass = 1,
      color = 0x3355ff,
      shape = 'box',
      metallic = false,
      restitution = 0.3,
      friction = 0.5,
      rotation = null,
      id = this.generateId()
    } = options;
    
    // Create physics shape based on type
    let physicsShape;
    if (shape === 'sphere') {
      // Use the average of the dimensions for the radius
      const radius = (size.x + size.y + size.z) / 6; // Divide by 6 since each dimension is halved
      physicsShape = new CANNON.Sphere(radius);
    } else if (shape === 'cylinder') {
      // Create a cylinder along the y-axis
      const radius = Math.max(size.x, size.z) / 2;
      const height = size.y;
      physicsShape = new CANNON.Cylinder(radius, radius, height, 12); // 12 segments
    } else {
      // Default box shape
      physicsShape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
    }
    
    // Create physics body
    const body = new CANNON.Body({ mass });
    body.addShape(physicsShape);
    body.position.set(position.x, position.y, position.z);
    
    // Apply rotation if specified
    if (rotation) {
      // Convert euler angles to quaternion
      if (rotation.x !== undefined && rotation.y !== undefined && rotation.z !== undefined) {
        const quaternion = new CANNON.Quaternion();
        quaternion.setFromEuler(rotation.x, rotation.y, rotation.z);
        body.quaternion.copy(quaternion);
      } 
      // Or use quaternion directly if provided
      else if (rotation.w !== undefined) {
        body.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
      }
    }
    
    // Set material properties
    body.linearDamping = 0.3;
    body.angularDamping = 0.3;
    body.material = new CANNON.Material();
    body.material.friction = friction;
    body.material.restitution = restitution;
    
    // Add body to physics world
    this.world.addBody(body);
    
    // Create visual representation based on shape
    let geometry;
    if (shape === 'sphere') {
      const radius = (size.x + size.y + size.z) / 6;
      geometry = new THREE.SphereGeometry(radius, 16, 16);
    } else if (shape === 'cylinder') {
      const radius = Math.max(size.x, size.z) / 2;
      const height = size.y;
      geometry = new THREE.CylinderGeometry(radius, radius, height, 16);
    } else {
      geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    }
    
    // Create material based on properties
    const material = new THREE.MeshStandardMaterial({ 
      color, 
      roughness: metallic ? 0.2 : 0.6,
      metalness: metallic ? 0.8 : 0.2
    });
    
    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.physicsId = id;
    
    // Add to scene
    this.scene.add(mesh);
    
    // Store reference to both body and mesh with all properties
    this.physicsBodies.set(id, { 
      body, 
      mesh, 
      properties: { 
        size, 
        mass, 
        color,
        shape,
        metallic,
        restitution,
        friction,
        rotation
      } 
    });
    
    // Emit event for multiplayer sync
    this.eventBus.emit('physics:object-created', {
      id,
      position,
      size,
      mass,
      color,
      shape,
      metallic,
      restitution,
      friction,
      rotation
    });
    
    // If socket manager is available, send to other clients
    if (this.socketManager) {
      this.socketManager.emit('physics:object-created', {
        id,
        position,
        size,
        mass,
        color,
        shape,
        metallic,
        restitution,
        friction,
        rotation
      });
    }
    
    return id;
  }
  

  /**
   * Pick up a physics object
   * @param {Object} data - Object pickup data
   */
  pickupObject(data) {
    if (!data) return;
    const { objectId, ray, playerId, holdDistance } = data;

    if (this.heldBody) {
        this.targetPosition.copy(this.heldBody.position); // Set target to current position
    }
    
    // Ensure bodyOffset is always initialized
    if (!this.bodyOffset) {
      this.bodyOffset = new CANNON.Vec3(0, 0, 0);
    }
    
    // Check for existing held object and drop it first if needed
    if (this.heldBody && this.heldBodyId) {
      this.dropObject({ objectId: this.heldBodyId, playerId: this.holdingPlayerId });
    }
    
    // Try direct lookup by ID first (preferred method)
    if (objectId && this.tryPickupById(objectId, playerId)) {
      return; // Successful pickup by ID
    }
    
    // Fallback to raycasting if objectId not found or not provided
    this.tryPickupByRaycast(ray, playerId);
  }
  
  /**
   * Attempt to pick up an object by its ID
   * @param {string} objectId - ID of the object to pick up
   * @param {string} playerId - ID of the player picking up the object
   * @returns {boolean} True if pickup was successful
   */
  tryPickupById(objectId, playerId) {
    if (!this.physicsBodies.has(objectId)) {
      return false;
    }
    
    const entry = this.physicsBodies.get(objectId);
    
    // Don't pick up static bodies
    if (entry.body.mass <= 0) {
      return false;
    }
    
    // Found the body, use it directly
    this.heldBody = entry.body;
    this.heldBodyId = objectId;
    this.holdingPlayerId = playerId || 'local';
    
    // Create a zero offset (center of object)
    if (!this.bodyOffset) {
      this.bodyOffset = new CANNON.Vec3();
    }
    this.bodyOffset.set(0, 0, 0);
    
    // Prepare the body for being held
    this.prepareBodyForHolding(this.heldBody);
    
    // Create visual beam effect
    this.createGravityBeam(this.heldBodyId);
    
    // Emit success event
    this.emitPickupEvent();
    return true;
  }
  
  /**
   * Attempt to pick up an object by raycasting
   * @param {Object} ray - Ray data for raycasting
   * @param {string} playerId - ID of the player picking up the object
   * @returns {boolean} True if pickup was successful
   */
  tryPickupByRaycast(ray, playerId) {
    // Make sure we have ray data before proceeding
    if (!ray || !ray.origin || !ray.direction) {
      return false;
    }
    
    // Convert ray to Cannon.js format
    const origin = new CANNON.Vec3(ray.origin.x || 0, ray.origin.y || 0, ray.origin.z || 0);
    const direction = new CANNON.Vec3(ray.direction.x || 0, ray.direction.y || 0, ray.direction.z || 0);
    
    // Ray cast in physics world
    const result = new CANNON.RaycastResult();
    
    // Scale up the ray length to ensure it can reach objects
    const scaledDirection = direction.clone();
    scaledDirection.scale(20, scaledDirection); // Extend ray to 20 units
    
    this.world.raycastClosest(origin, scaledDirection, { collisionFilterMask: -1, skipBackfaces: true }, result);
    
    if (!result.hasHit) {
      return false;
    }
    
    // Find which body was hit
    const hitBody = result.body;
    
    // Don't pick up static bodies
    if (hitBody.mass <= 0) {
      return false;
    }

    // Store the hit body as the held body
    this.heldBody = hitBody;
    this.heldBodyId = this.getIdFromBody(hitBody);
    this.holdingPlayerId = playerId || 'local';
    
    // Calculate the offset from the hit point
    this.calculateBodyOffset(ray, hitBody, result);
    
    // Prepare the body for being held
    this.prepareBodyForHolding(this.heldBody);
    
    // Create visual beam effect
    this.createGravityBeam(this.heldBodyId);
    
    // Emit success event
    this.emitPickupEvent();
    return true;
  }
  
  /**
   * Calculate the offset from hit point to body center
   * @param {Object} ray - Ray data
   * @param {CANNON.Body} hitBody - The body that was hit
   * @param {CANNON.RaycastResult} result - Raycast result
   */
  calculateBodyOffset(ray, hitBody, result) {
    if (!this.bodyOffset) {
      this.bodyOffset = new CANNON.Vec3();
    }
    
    if (ray.hitPoint) {
      // Use the provided hit point if available
      const hitPoint = new CANNON.Vec3(ray.hitPoint.x, ray.hitPoint.y, ray.hitPoint.z);
      this.bodyOffset.copy(hitPoint);
      this.bodyOffset.vsub(hitBody.position, this.bodyOffset);
    } else {
      // Otherwise use the raycast result
      this.bodyOffset.copy(result.hitPointWorld);
      this.bodyOffset.vsub(hitBody.position, this.bodyOffset);
    }
  }
  
  /**
   * Prepare a physics body for being held (modify gravity, mass)
   * @param {CANNON.Body} body - The body to prepare
   */
  prepareBodyForHolding(body) {
    // Disable gravity
    if (body.gravity) {
      body.gravity.set(0, 0, 0);
    } else {
      body.gravity = new CANNON.Vec3(0, 0, 0);
    }
    
    // Store original mass and reduce for holding
    body.originalMass = body.mass;
    // Use a percentage of original mass (minimum 0.5)
    body.mass = Math.max(0.5, body.originalMass * 0.3);
    body.updateMassProperties();
    
    // Force the body to wake up if it's asleep
    if (body.sleepState === CANNON.Body.SLEEPING) {
      body.wakeUp();
    }
  }
  
  /**
   * Helper method to emit pickup events
   */
  emitPickupEvent() {
    if (!this.heldBody || !this.heldBodyId) return;
    
    // Emit event for local state tracking
    this.eventBus.emit('physics:object-pickup', {
      id: this.heldBodyId,
      playerId: this.holdingPlayerId
    });
    
    // Network sync if in multiplayer mode
    if (this.socketManager) {
      this.socketManager.emit('physics:object-pickup', {
        id: this.heldBodyId,
        playerId: this.holdingPlayerId
      });
    }
  }
  
  updateHeldBody() {
    if (!this.heldBody) return;

    const currentPosition = this.heldBody.position;
    const desiredPosition = this.targetPosition;

    // Calculate displacement
    const displacement = new CANNON.Vec3();
    desiredPosition.vsub(currentPosition, displacement);

    // PD controller constants
    this.k_p = this.k_p !== undefined ? this.k_p : 14.5; // Proportional gain (stiffness)
    this.k_d = this.k_d !== undefined ? this.k_d : 0.5;  // Derivative gain (damping)

    // Calculate force
    const force = new CANNON.Vec3();
    displacement.scale(this.k_p, force); // Proportional force

    // Add damping force
    const dampingForce = new CANNON.Vec3();
    this.heldBody.velocity.scale(-this.k_d, dampingForce);
    force.vadd(dampingForce, force);

    // Compensate for gravity (assuming -9.82 m/s² in y-direction)
    const gravityForce = new CANNON.Vec3(0, this.heldBody.mass * 9.82, 0);
    force.vadd(gravityForce, force);

    // Apply the force
    this.heldBody.applyForce(force, this.heldBody.position);

    // Optional: Reduce angular velocity for stability
    this.heldBody.angularVelocity.scale(0.8, this.heldBody.angularVelocity);
    }
  
  /**
   * Drop the currently held object
   * @param {Object} data - Drop data
   */
  dropObject(data = {}) {
    // If specific objectId is provided, only drop if it matches our held object
    if (data.objectId && this.heldBodyId !== data.objectId) {
      return;
    }
    
    // Can't drop if not holding anything
    if (!this.heldBody) return;
    
    // Restore the body's physics properties
    this.restoreBodyAfterHolding(this.heldBody);
    
    // Get ID for the dropped body and player before clearing references
    const id = this.heldBodyId;
    const currentPlayerId = this.holdingPlayerId;
    
    // Remove visual beam
    this.removeGravityBeam();
    
    // Clear references
    this.heldBody = null;
    this.heldBodyId = null;
    this.holdingPlayerId = null;
    
    // Emit drop events
    this.emitDropEvent(id, currentPlayerId, data.skipNetworkSync);
  }
  
  /**
   * Restore a physics body's properties after it has been held
   * @param {CANNON.Body} body - The body to restore
   */
  restoreBodyAfterHolding(body) {
    // Restore gravity
    body.gravity.set(0, -9.82, 0);
    
    // Restore original mass
    if (body.originalMass !== undefined) {
      body.mass = body.originalMass;
      body.updateMassProperties();
      delete body.originalMass;
    }
  }
  
  /**
   * Emit drop events for local tracking and network sync
   * @param {string} objectId - ID of the dropped object
   * @param {string} playerId - ID of the player dropping the object
   * @param {boolean} skipNetworkSync - If true, don't sync over network
   */
  emitDropEvent(objectId, playerId, skipNetworkSync = false) {
    // Emit event for local state tracking
    this.eventBus.emit('physics:object-drop', { 
      id: objectId,
      playerId: playerId 
    });
    
    // Network sync if in multiplayer mode
    if (this.socketManager && !skipNetworkSync) {
      this.socketManager.emit('physics:object-drop', { 
        id: objectId,
        playerId: playerId
      });
    }
  }
  
  /**
   * Create a visual beam connecting the phone to the held object
   * @param {string} objectId - ID of the held object
   */
  createGravityBeam(objectId) {
    // Remove any existing beam
    this.removeGravityBeam();
    
    const physicsObj = this.physicsBodies.get(objectId);
    if (!physicsObj) {
      return;
    }
    
    // Create a glowy line to represent the gravity beam
    const material = new THREE.LineBasicMaterial({
      color: 0x00aaff,
      transparent: true,
      opacity: 0.7,
      linewidth: 2
    });
    
    // Get the phone model position (source of beam)
    const phoneModel = this.scene.getObjectByName('phoneModel');
    if (!phoneModel) {
      return;
    }
    
    const sourcePosition = new THREE.Vector3();
    phoneModel.getWorldPosition(sourcePosition);
    
    // Get object position for the target end of the beam
    const targetPosition = new THREE.Vector3(
      physicsObj.body.position.x,
      physicsObj.body.position.y,
      physicsObj.body.position.z
    );
    
    // Create initial geometry with actual positions
    const geometry = new THREE.BufferGeometry();
    const points = [sourcePosition, targetPosition];
    geometry.setFromPoints(points);
    
    // Create the line
    this.gravityBeam = new THREE.Line(geometry, material);
    this.scene.add(this.gravityBeam);
  }
  
  /**
   * Update the gravity beam position
   */
  updateGravityBeam() {
    if (!this.gravityBeam || !this.heldBody) return;
    
    // Get phone model position (source of beam)
    const phoneModel = this.scene.getObjectByName('phoneModel');
    if (!phoneModel) return;
    
    const sourcePosition = new THREE.Vector3();
    phoneModel.getWorldPosition(sourcePosition);
    
    // Get target position (held object)
    const targetPosition = this.getPositionFromBody(this.heldBody);
    
    // Update line vertices
    this.updateBeamGeometry(this.gravityBeam, sourcePosition, targetPosition);
  }
  
  /**
   * Remove gravity beam
   */
  removeGravityBeam() {
    this.removeBeam(this.gravityBeam);
    this.gravityBeam = null;
  }
  
  /**
   * Helper function to get position Vector3 from a physics body
   * @param {CANNON.Body} body - Physics body
   * @returns {THREE.Vector3} Position as Vector3
   */
  getPositionFromBody(body) {
    return new THREE.Vector3(
      body.position.x,
      body.position.y,
      body.position.z
    );
  }
  
  /**
   * Update beam geometry between two points
   * @param {THREE.Line} beam - The beam line object
   * @param {THREE.Vector3} source - Source position
   * @param {THREE.Vector3} target - Target position
   */
  updateBeamGeometry(beam, source, target) {
    if (!beam) return;
    
    const points = [source, target];
    beam.geometry.dispose();
    beam.geometry = new THREE.BufferGeometry().setFromPoints(points);
  }
  
  /**
   * Generic beam removal helper
   * @param {THREE.Line} beam - The beam to remove
   */
  removeBeam(beam) {
    if (!beam) return;
    
    this.scene.remove(beam);
    if (beam.geometry) {
      beam.geometry.dispose();
    }
    if (beam.material) {
      beam.material.dispose();
    }
  }
  
  getIdFromBody(body) {
    for (const [id, obj] of this.physicsBodies.entries()) {
      if (obj.body === body) {
        return id;
      }
    }
    return null;
  }
  
  generateId() {
    return 'physics_' + Math.random().toString(36).substr(2, 9);
  }
  
  // Multiplayer synchronization
  shouldEmitSync() {
    // Only emit sync every 100ms to reduce network traffic
    const now = Date.now();
    if (!this.lastSyncTime || now - this.lastSyncTime > 100) {
      this.lastSyncTime = now;
      return true;
    }
    return false;
  }
  
  emitPhysicsState() {
    const objects = [];
    
    this.physicsBodies.forEach((physicsObj, id) => {
      const { body, properties } = physicsObj;
      
      objects.push({
        id,
        position: {
          x: body.position.x,
          y: body.position.y,
          z: body.position.z
        },
        quaternion: {
          x: body.quaternion.x,
          y: body.quaternion.y,
          z: body.quaternion.z,
          w: body.quaternion.w
        },
        velocity: {
          x: body.velocity.x,
          y: body.velocity.y,
          z: body.velocity.z
        },
        angularVelocity: {
          x: body.angularVelocity.x,
          y: body.angularVelocity.y,
          z: body.angularVelocity.z
        },
        properties // Include size, mass, color
      });
    });
    
    // Send only if there are objects to sync
    if (objects.length > 0) {
      this.eventBus.emit('physics:state', { objects });
      
      // Also send directly via socket manager if in a multiplayer session
      const socketManager = this.socketManager;
      if (socketManager) {
        socketManager.emit('physics:state', { objects });
      }
    }
  }
  
  handlePhysicsSync(data) {
    const { objects } = data;
    
    objects.forEach(obj => {
      if (this.physicsBodies.has(obj.id)) {
        // Update existing object
        const physicsObj = this.physicsBodies.get(obj.id);
        
        // Only update if not being controlled locally
        if (this.heldBody !== physicsObj.body) {
          // Update position and rotation
          physicsObj.body.position.set(obj.position.x, obj.position.y, obj.position.z);
          physicsObj.body.quaternion.set(obj.quaternion.x, obj.quaternion.y, obj.quaternion.z, obj.quaternion.w);
          
          // Update velocity
          physicsObj.body.velocity.set(obj.velocity.x, obj.velocity.y, obj.velocity.z);
          physicsObj.body.angularVelocity.set(obj.angularVelocity.x, obj.angularVelocity.y, obj.angularVelocity.z);
        }
      } else {
        // Create new object
        this.createPhysicsObject({
          id: obj.id,
          position: obj.position,
          size: obj.properties.size,
          mass: obj.properties.mass,
          color: obj.properties.color
        });
      }
    });
  }
  
  /**
   * Handle remote player picking up an object
   * @param {Object} data - Pickup data
   */
  handleRemoteObjectPickup(data) {
    const { id, playerId } = data;
    
    // Ignore if this is our own pickup event or if we're already holding the object
    if (playerId === 'local' || (this.heldBodyId === id && this.holdingPlayerId === playerId)) {
      return;
    }
    
    // Get the physics object
    if (!this.physicsBodies.has(id)) {
      return;
    }
    
    const physicsObj = this.physicsBodies.get(id);
    
    // Prepare the body for remote holding (same physics changes as local holding)
    this.prepareBodyForHolding(physicsObj.body);
    
    // Mark as held remotely
    physicsObj.heldByRemotePlayer = playerId;
    
    // Add visual effects to show it's held by another player
    this.createRemoteGravityBeam(id, playerId);
  }
  
  /**
   * Handle remote player dropping an object
   * @param {Object} data - Drop data
   */
  handleRemoteObjectDrop(data) {
    const { id, playerId } = data;
    
    // Ignore if this is our own drop event
    if (playerId === 'local' || this.holdingPlayerId === playerId) {
      return;
    }
    
    // Get the physics object
    if (!this.physicsBodies.has(id)) {
      return;
    }
    
    const physicsObj = this.physicsBodies.get(id);
    
    // Only reset if this object was held by the remote player
    if (physicsObj.heldByRemotePlayer === playerId) {
      // Restore physics properties
      this.restoreBodyAfterHolding(physicsObj.body);
      
      // Mark as no longer held
      physicsObj.heldByRemotePlayer = null;
      
      // Remove visual beam
      this.removeRemoteGravityBeam(id);
    }
  }
  
  /**
   * Handle creation of objects by other clients
   * @param {Object} data - Object creation data
   */
  handleRemoteObjectCreated(data) {
    // Only create if we don't already have this object
    if (!this.physicsBodies.has(data.id)) {
      this.createPhysicsObject({
        id: data.id,
        position: data.position,
        size: data.size,
        mass: data.mass,
        color: data.color
      });
    }
  }
  
  /**
   * Create a visual beam effect for remote player holding an object
   * @param {string} objectId - ID of held object
   * @param {string} playerId - ID of player holding object
   */
  createRemoteGravityBeam(objectId, playerId) {
    // Get the physics object
    const physicsObj = this.physicsBodies.get(objectId);
    if (!physicsObj) return;
    
    // First clean up any existing beam
    if (physicsObj.remoteBeam) {
      this.removeBeam(physicsObj.remoteBeam);
    }
    
    // Create a visual connection to show the object is held remotely
    const material = new THREE.LineBasicMaterial({
      color: 0xff5500,  // Different color for remote beams
      transparent: true,
      opacity: 0.5,
      linewidth: 1
    });
    
    // Create placeholder points (will be updated immediately in updateRemoteGravityBeam)
    const geometry = new THREE.BufferGeometry();
    geometry.setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0)
    ]);
    
    // Create the line
    const beam = new THREE.Line(geometry, material);
    this.scene.add(beam);
    
    // Store reference in the physics object
    physicsObj.remoteBeam = beam;
    physicsObj.heldByRemotePlayer = playerId;
    
    // Update beam with correct positions
    this.updateRemoteGravityBeam(objectId, playerId);
  }
  
  /**
   * Remove visual beam effect for remote held object
   * @param {string} objectId - ID of object
   */
  removeRemoteGravityBeam(objectId) {
    const physicsObj = this.physicsBodies.get(objectId);
    if (!physicsObj || !physicsObj.remoteBeam) return;
    
    this.removeBeam(physicsObj.remoteBeam);
    
    // Clear reference
    physicsObj.remoteBeam = null;
  }
  
  handleRoomJoined() {
    // Clear existing physics objects when joining a room
    this.clearAllObjects();
    
    // Create some initial objects for the room
    this.createInitialObjects();
  }
  
  handleRoomLeft() {
    // Clear all physics objects when leaving a room
    this.clearAllObjects();
  }
  
  clearAllObjects() {
    // Remove all physics bodies and meshes
    this.physicsBodies.forEach((physicsObj) => {
      const { body, mesh } = physicsObj;
      
      // Remove from physics world
      this.world.removeBody(body);
      
      // Remove from scene
      this.scene.remove(mesh);
    });
    
    // Clear map
    this.physicsBodies.clear();
    
    // Clear held body reference
    this.heldBody = null;
  }
  
  /**
   * Apply an external force to a physics object
   * @param {Object} data - Force data containing objectId and force vector
   */
  applyForceToObject(data) {
    const { objectId, force } = data;
    
    if (!objectId || !this.physicsBodies.has(objectId)) return;
    
    const physicsObj = this.physicsBodies.get(objectId);
    const { body } = physicsObj;
    
    // Apply force at center of mass
    const forceVec = new CANNON.Vec3(force.x, force.y, force.z);
    body.applyForce(forceVec, body.position);
    
    // Sync force application to other clients
    if (this.socketManager) {
      this.socketManager.emit('physics:apply-force', {
        id: objectId,
        force: force,
        playerId: 'local'
      });
    }
  }
  
  /**
   * Update the target position for held objects
   * @param {Object} data - Target data
   */
  updateHeldObjectTarget(data) {
    const { objectId, position, rotation } = data;
    
    // Only update if we're holding the specified object
    if (!this.heldBody || !this.heldBodyId || this.heldBodyId !== objectId) {
      return;
    }
    
    // Safety check for targetPosition
    if (!this.targetPosition) {
      this.targetPosition = new CANNON.Vec3();
    }
    
    // Update target position with safety checks
    if (position && position.x !== undefined && position.y !== undefined && position.z !== undefined) {
      this.targetPosition.set(position.x, position.y, position.z);
    }
    
    // If rotation provided, update target rotation with safety checks
    if (rotation && rotation.x !== undefined && rotation.y !== undefined && 
        rotation.z !== undefined && rotation.w !== undefined) {
      // Create quaternion if it doesn't exist
      if (!this.targetRotation) {
        this.targetRotation = new CANNON.Quaternion();
      }
      
      this.targetRotation.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
    
    // Force the held body to wake up if it's asleep
    if (this.heldBody.sleepState === CANNON.Body.SLEEPING) {
      this.heldBody.wakeUp();
    }
  }
  
  createInitialObjects() {
    // Create various physics objects with different sizes, masses, and colors
    
    // Create some cubes at different positions
    this.createPhysicsObject({
      position: { x: 2, y: 3, z: 2 },
      size: { x: 1, y: 1, z: 1 },
      color: 0xff5533
    });
    
    this.createPhysicsObject({
      position: { x: -2, y: 4, z: -2 },
      size: { x: 0.7, y: 0.7, z: 0.7 },
      color: 0x33ff55
    });
    
    this.createPhysicsObject({
      position: { x: 0, y: 6, z: 3 },
      size: { x: 1.2, y: 1.2, z: 1.2 },
      color: 0xffdd33
    });
    
    // Create a sphere
    this.createPhysicsObject({
      position: { x: 3, y: 5, z: -3 },
      size: { x: 0.8, y: 0.8, z: 0.8 },
      color: 0x3399ff,
      shape: 'sphere'
    });
    
    // Create a heavier metallic box
    this.createPhysicsObject({
      position: { x: -3, y: 2, z: 3 },
      size: { x: 0.9, y: 0.9, z: 0.9 },
      mass: 5,
      color: 0x999999,
      metallic: true
    });
    
    // Create a lightweight bouncy ball
    this.createPhysicsObject({
      position: { x: 1, y: 7, z: 1 },
      size: { x: 0.5, y: 0.5, z: 0.5 },
      mass: 0.3,
      color: 0xff99cc,
      shape: 'sphere',
      restitution: 0.8
    });
    
    // Create a larger platform
    this.createPhysicsObject({
      position: { x: 0, y: 0.25, z: 0 },
      size: { x: 10, y: 0.5, z: 10 },
      mass: 0, // Static object
      color: 0x999999
    });
    
    // Create a ramp
    this.createPhysicsObject({
      position: { x: 5, y: 1, z: 0 },
      size: { x: 3, y: 0.2, z: 2 },
      mass: 0, // Static object
      color: 0xaa7744,
      rotation: { x: 0, y: 0, z: Math.PI / 12 } // Slightly tilted
    });
  }
}
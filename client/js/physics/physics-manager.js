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
    
    // Listen for gravity gun events
    this.eventBus.on('gravityGun:pickup', this.pickupObject.bind(this));
    this.eventBus.on('gravityGun:drop', this.dropObject.bind(this));
    this.eventBus.on('gravityGun:apply-force', this.applyForceToObject.bind(this));
    this.eventBus.on('gravityGun:update-target', this.updateHeldObjectTarget.bind(this));
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
    const objectPosition = new THREE.Vector3(
      physicsObj.body.position.x,
      physicsObj.body.position.y,
      physicsObj.body.position.z
    );
    
    // Update beam geometry
    const points = [playerPosition, objectPosition];
    physicsObj.remoteBeam.geometry.dispose();
    physicsObj.remoteBeam.geometry = new THREE.BufferGeometry().setFromPoints(points);
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
  
  pickupObject(data) {
    if (!data) return;
    const { ray, sourceId, objectId } = data || {};
    
    // Ensure bodyOffset is always initialized
    if (!this.bodyOffset) {
      this.bodyOffset = new CANNON.Vec3(0, 0, 0);
    }
    
    // If objectId is provided (from gravity gun controller), try to find the body directly
    if (objectId) {
      // Find the physics body by ID - more reliable than raycasting
      for (const [id, entry] of this.physicsBodies.entries()) {
        if (id === objectId && entry.body.mass > 0) {
          // Found the body, use it directly
          this.heldBody = entry.body;
          this.heldBodyId = id;
          this.holdingPlayerId = sourceId || 'local';
          
          // Create a zero offset (center of object)
          // Make sure bodyOffset is properly initialized before using it
          if (!this.bodyOffset) {
            this.bodyOffset = new CANNON.Vec3();
          }
          this.bodyOffset.set(0, 0, 0);
          
          // Safely disable gravity (ensuring the gravity property exists)
          if (this.heldBody.gravity) {
            this.heldBody.gravity.set(0, 0, 0);
          } else {
            this.heldBody.gravity = new CANNON.Vec3(0, 0, 0);
          }
          
          // Store original mass and reduce for holding
          this.heldBody.originalMass = this.heldBody.mass;
          this.heldBody.mass = 0.1;
          this.heldBody.updateMassProperties();
          
          // Create visual beam effect
          this.createGravityBeam(this.heldBodyId);
          
          // Emit event for multiplayer sync
          this.eventBus.emit('physics:object-pickup', {
            id: this.heldBodyId,
            playerId: this.holdingPlayerId
          });
          
          return;
        }
      }
    }
    
    // Fallback to raycasting if objectId not provided or not found
    
    // Make sure we have ray data before proceeding
    if (!ray || !ray.origin || !ray.direction) {
      return;
    }
    
    // Convert ray to Cannon.js format
    const origin = new CANNON.Vec3(ray.origin.x || 0, ray.origin.y || 0, ray.origin.z || 0);
    const direction = new CANNON.Vec3(ray.direction.x || 0, ray.direction.y || 0, ray.direction.z || 0);
    
    // Ray cast in physics world
    const result = new CANNON.RaycastResult();
    
    // Scale up the ray length to ensure it can reach objects
    const scaledDirection = direction.clone();
    scaledDirection.scale(20, scaledDirection); // Extend ray to 20 units to ensure it reaches
    
    this.world.raycastClosest(origin, scaledDirection, { collisionFilterMask: -1, skipBackfaces: true }, result);
    
    if (result.hasHit) {
      // Find which body was hit
      const hitBody = result.body;
      
      // Don't pick up static bodies
      if (hitBody.mass <= 0) {
        return;
      }
      
      // Store the hit body as the held body
      this.heldBody = hitBody;
      this.heldBodyId = this.getIdFromBody(hitBody);
      this.holdingPlayerId = sourceId || 'local';
      
      // Store the held body ID and player
      
      // Ensure bodyOffset is initialized before using it
      if (!this.bodyOffset) {
        this.bodyOffset = new CANNON.Vec3();
      }
      
      // Store the offset from the hit point
      this.bodyOffset.copy(result.hitPointWorld);
      this.bodyOffset.vsub(hitBody.position, this.bodyOffset);
      
      // Safely disable gravity (ensuring the gravity property exists)
      if (this.heldBody.gravity) {
        this.heldBody.gravity.set(0, 0, 0);
      } else {
        this.heldBody.gravity = new CANNON.Vec3(0, 0, 0);
      }
      
      // Reduce mass while held (makes it easier to move)
      this.heldBody.originalMass = this.heldBody.mass;
      this.heldBody.mass = 0.1;
      this.heldBody.updateMassProperties();
      
      // Create visual beam effect
      this.createGravityBeam(this.heldBodyId);
      
      // Emit event for multiplayer sync
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
  }
  
  updateHeldBody() {
    if (!this.heldBody) return;
    
    // Safety check for bodyOffset
    if (!this.bodyOffset) {
      this.bodyOffset = new CANNON.Vec3(0, 0, 0);
    }
    
    // Get the phone model position and orientation
    const phoneModel = this.scene.getObjectByName('phoneModel');
    if (!phoneModel) return;
    
    // Calculate target position - in front of the phone model
    const phonePosition = new THREE.Vector3();
    phoneModel.getWorldPosition(phonePosition);
    
    const phoneDirection = new THREE.Vector3(0, 0, -1);
    phoneDirection.applyQuaternion(phoneModel.quaternion);
    
    // Position the object 2 units in front of the phone
    const targetPos = phonePosition.clone().add(phoneDirection.multiplyScalar(2));
    
    // Convert to Cannon format
    this.targetPosition.set(targetPos.x, targetPos.y, targetPos.z);
    
    // Apply spring force to move body toward target position
    const force = new CANNON.Vec3();
    this.targetPosition.vsub(this.heldBody.position, force);
    
    // Scale force based on distance (stronger force when further away)
    const distance = force.length();
    force.normalize();
    force.scale(distance * 20, force); // Adjust spring strength here
    
    // Apply force
    this.heldBody.applyForce(force, this.heldBody.position);
    
    // Apply rotation to match phone model
    const targetQuaternion = phoneModel.quaternion.clone();
    const q = new CANNON.Quaternion(
      targetQuaternion.x,
      targetQuaternion.y,
      targetQuaternion.z,
      targetQuaternion.w
    );
    
    // Calculate difference between current and target rotation
    const qDiff = new CANNON.Quaternion();
    q.conjugate(qDiff);
    qDiff.mult(this.heldBody.quaternion, qDiff);
    
    // Convert to axis angle
    const axis = new CANNON.Vec3();
    let angle = qDiff.toAxisAngle(axis);
    
    // Apply torque to rotate toward target
    if (axis.lengthSquared() > 0.001) {
      axis.normalize();
      axis.scale(angle * 10, axis); // Adjust rotation strength here
      this.heldBody.applyTorque(axis);
    }
    
    // Update gravity beam if it exists
    this.updateGravityBeam();
  }
  
  dropObject(data = {}) {
    if (!this.heldBody) return;
    
    // Restore gravity
    this.heldBody.gravity.set(0, -9.82, 0);
    
    // Restore original mass
    if (this.heldBody.originalMass !== undefined) {
      this.heldBody.mass = this.heldBody.originalMass;
      this.heldBody.updateMassProperties();
      delete this.heldBody.originalMass;
    }
    
    // Get ID for the dropped body
    const id = this.heldBodyId;
    
    // Remove visual beam
    this.removeGravityBeam();
    
    // Clear references
    this.heldBody = null;
    this.heldBodyId = null;
    
    // Emit event for multiplayer sync
    this.eventBus.emit('physics:object-drop', { 
      id,
      playerId: this.holdingPlayerId 
    });
    
    // Network sync if in multiplayer mode
    if (this.socketManager && !data.skipNetworkSync) {
      this.socketManager.emit('physics:object-drop', { 
        id,
        playerId: this.holdingPlayerId 
      });
    }
    
    this.holdingPlayerId = null;
  }
  
  // Create a visual beam connecting the phone to the held object
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
  
  // Update the gravity beam position
  updateGravityBeam() {
    if (!this.gravityBeam || !this.heldBody) return;
    
    // Get phone model position (source of beam)
    const phoneModel = this.scene.getObjectByName('phoneModel');
    if (!phoneModel) return;
    
    const sourcePosition = new THREE.Vector3();
    phoneModel.getWorldPosition(sourcePosition);
    
    // Get target position (held object)
    const targetPosition = new THREE.Vector3(
      this.heldBody.position.x,
      this.heldBody.position.y,
      this.heldBody.position.z
    );
    
    // Update line vertices
    const points = [sourcePosition, targetPosition];
    this.gravityBeam.geometry.dispose();
    this.gravityBeam.geometry = new THREE.BufferGeometry().setFromPoints(points);
  }
  
  // Remove gravity beam
  removeGravityBeam() {
    if (this.gravityBeam) {
      this.scene.remove(this.gravityBeam);
      if (this.gravityBeam.geometry) {
        this.gravityBeam.geometry.dispose();
      }
      if (this.gravityBeam.material) {
        this.gravityBeam.material.dispose();
      }
      this.gravityBeam = null;
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
    if (this.physicsBodies.has(id)) {
      const physicsObj = this.physicsBodies.get(id);
      
      // Set held attributes on the object
      physicsObj.body.gravity.set(0, 0, 0);
      physicsObj.body.originalMass = physicsObj.body.mass;
      physicsObj.body.mass = 0.1;
      physicsObj.body.updateMassProperties();
      
      // Mark as held remotely
      physicsObj.heldByRemotePlayer = playerId;
      
      // Add visual effects to show it's held by another player
      this.createRemoteGravityBeam(id, playerId);
    }
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
    if (this.physicsBodies.has(id)) {
      const physicsObj = this.physicsBodies.get(id);
      
      // Only reset if this object was held by the remote player
      if (physicsObj.heldByRemotePlayer === playerId) {
        // Restore gravity
        physicsObj.body.gravity.set(0, -9.82, 0);
        
        // Restore original mass
        if (physicsObj.body.originalMass !== undefined) {
          physicsObj.body.mass = physicsObj.body.originalMass;
          physicsObj.body.updateMassProperties();
          delete physicsObj.body.originalMass;
        }
        
        // Mark as no longer held
        physicsObj.heldByRemotePlayer = null;
        
        // Remove visual beam
        this.removeRemoteGravityBeam(id);
      }
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
    
    // Create a visual connection to show the object is held remotely
    const material = new THREE.LineBasicMaterial({
      color: 0xff5500,  // Different color for remote beams
      transparent: true,
      opacity: 0.5,
      linewidth: 1
    });
    
    // Create initial geometry (will be updated each frame)
    const geometry = new THREE.BufferGeometry();
    const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 0)
    ];
    geometry.setFromPoints(points);
    
    // Create the line
    const beam = new THREE.Line(geometry, material);
    this.scene.add(beam);
    
    // Store reference in the physics object
    physicsObj.remoteBeam = beam;
    physicsObj.heldByRemotePlayer = playerId;
  }
  
  /**
   * Remove visual beam effect for remote held object
   * @param {string} objectId - ID of object
   */
  removeRemoteGravityBeam(objectId) {
    const physicsObj = this.physicsBodies.get(objectId);
    if (!physicsObj || !physicsObj.remoteBeam) return;
    
    // Remove beam from scene
    this.scene.remove(physicsObj.remoteBeam);
    
    // Dispose resources
    if (physicsObj.remoteBeam.geometry) {
      physicsObj.remoteBeam.geometry.dispose();
    }
    if (physicsObj.remoteBeam.material) {
      physicsObj.remoteBeam.material.dispose();
    }
    
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
   * @param {Object} data - Force data
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
   * Update the target position for held objects (from gravity gun)
   * @param {Object} data - Target data
   */
  updateHeldObjectTarget(data) {
    const { objectId, position, rotation } = data;
    
    if (!this.heldBody || !this.heldBodyId || this.heldBodyId !== objectId) return;
    
    // Update target position for spring physics
    this.targetPosition.set(position.x, position.y, position.z);
    
    // If rotation provided, update target rotation
    if (rotation) {
      this.targetRotation = new CANNON.Quaternion(
        rotation.x,
        rotation.y,
        rotation.z,
        rotation.w
      );
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
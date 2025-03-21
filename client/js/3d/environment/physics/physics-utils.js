import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Physics utility functions for the environment
 */
export class PhysicsUtils {
  /**
   * @param {PhysicsManager} physicsManager - Physics manager for collision bodies
   * @param {Object} materials - Material definitions
   */
  constructor(physicsManager, materials) {
    this.physicsManager = physicsManager;
    this.materials = materials;
  }

  /**
   * Add physics box to object
   * @param {THREE.Mesh} mesh - Visual mesh
   * @param {number} mass - Physics mass (0 for static)
   */
  addPhysicsBox(mesh, mass) {
    if (!this.physicsManager) return;
    
    // Get dimensions from mesh geometry
    const size = new THREE.Vector3();
    mesh.geometry.computeBoundingBox();
    mesh.geometry.boundingBox.getSize(size);
    
    // Create physics shape
    const shape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
    
    // Create body
    const body = new CANNON.Body({
      mass: mass,
      position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
      quaternion: new CANNON.Quaternion().setFromEuler(
        mesh.rotation.x,
        mesh.rotation.y, 
        mesh.rotation.z
      )
    });
    body.addShape(shape);
    
    // Generate a unique ID for this object
    const id = `physics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Always add the physicsId to the mesh userData, whether static or not
    mesh.userData.physicsId = id;
    
    // Add to physics world if available
    if (this.physicsManager.world) {
      this.physicsManager.world.addBody(body);
    }
    
    // Add to the physicsBodies map in the physics manager if available
    if (this.physicsManager.physicsBodies) {
      this.physicsManager.physicsBodies.set(id, {
      body: body,
      mesh: mesh,
      properties: {
        size: { x: size.x, y: size.y, z: size.z },
        mass: mass,
        color: mesh.material.color.getHex(),
        shape: 'box',
        metallic: false,
        restitution: mass > 0 ? 0.3 : this.materials.stone.physics.restitution,
        friction: mass > 0 ? 0.5 : this.materials.stone.physics.friction
      }
    });
    }
    
    return { body, id };
  }

  /**
   * Add a custom physics shape to object
   * @param {THREE.Mesh} mesh - Visual mesh
   * @param {CANNON.Shape} shape - Physics shape
   * @param {number} mass - Physics mass (0 for static)
   */
  addPhysicsShape(mesh, shape, mass) {
    if (!this.physicsManager) return;
    
    // Create body
    const body = new CANNON.Body({
      mass: mass,
      position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
      quaternion: new CANNON.Quaternion().setFromEuler(
        mesh.rotation.x,
        mesh.rotation.y, 
        mesh.rotation.z
      )
    });
    body.addShape(shape);
    
    // Generate a unique ID for this object
    const id = `physics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Always add the physicsId to the mesh userData, whether static or not
    mesh.userData.physicsId = id;
    
    // Add to physics world if available
    if (this.physicsManager.world) {
      this.physicsManager.world.addBody(body);
    }
    
    // Get bounding box for size estimate
    const size = new THREE.Vector3();
    mesh.geometry.computeBoundingBox();
    mesh.geometry.boundingBox.getSize(size);
    
    // Set material properties based on object type
    let restitution = 0.3;
    let friction = 0.5;
    
    // If it's a static object, use appropriate material properties
    if (mass === 0) {
      // Try to determine what material this object is made of based on color
      // Default to stone properties if we can't determine
      restitution = this.materials.stone.physics.restitution;
      friction = this.materials.stone.physics.friction;
    }
    
    // Add to the physicsBodies map in the physics manager if available
    if (this.physicsManager.physicsBodies) {
      this.physicsManager.physicsBodies.set(id, {
      body: body,
      mesh: mesh,
      properties: {
        size: { x: size.x, y: size.y, z: size.z },
        mass: mass,
        color: mesh.material.color ? mesh.material.color.getHex() : 0x808080,
        shape: shape instanceof CANNON.Cylinder ? 'cylinder' : 'box',
        metallic: false,
        restitution: restitution,
        friction: friction
      }
    });
    }
    
    return { body, id };
  }

  /**
   * Add a hollow physics shape (like a cylinder with a hole)
   * @param {THREE.Mesh} mesh - Visual mesh
   * @param {CANNON.Shape} outerShape - Outer physics shape
   * @param {CANNON.Shape} innerShape - Inner physics shape to subtract
   * @param {number} mass - Physics mass (0 for static)
   */
  addPhysicsShapeWithHollow(mesh, outerShape, innerShape, mass) {
    if (!this.physicsManager) return;
    
    // For static bodies, we can use multiple shapes to create a hollow effect
    // For simplicity we're using separate shapes for walls
    
    // Create body
    const body = new CANNON.Body({
      mass: mass,
      position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z)
    });
    
    // Add the outer shape
    body.addShape(outerShape);
    
    // Generate a unique ID for this object
    const id = `physics_hollow_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Always add the physicsId to the mesh userData, whether static or not
    mesh.userData.physicsId = id;
    
    // Add the inner shape as a separate body for simplicity
    let innerBody = null;
    if (innerShape) {
      innerBody = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z)
      });
      innerBody.addShape(innerShape);
      innerBody.collisionResponse = false; // Don't respond to collisions
      if (this.physicsManager.world) {
        this.physicsManager.world.addBody(innerBody);
      }
    }
    
    // Add to physics world if available
    if (this.physicsManager.world) {
      this.physicsManager.world.addBody(body);
    }
    
    // Get bounding box for size estimate
    const size = new THREE.Vector3();
    mesh.geometry.computeBoundingBox();
    mesh.geometry.boundingBox.getSize(size);
    
    // Add to the physicsBodies map in the physics manager if available
    if (this.physicsManager.physicsBodies) {
      this.physicsManager.physicsBodies.set(id, {
        body: body,
        mesh: mesh,
        innerBody: innerBody, // Keep reference to inner body
      properties: {
        size: { x: size.x, y: size.y, z: size.z },
        mass: mass,
        color: mesh.material.color ? mesh.material.color.getHex() : 0x808080,
        shape: outerShape instanceof CANNON.Cylinder ? 'cylinder' : 'box',
        metallic: false,
        restitution: this.materials.stone.physics.restitution,
        friction: this.materials.stone.physics.friction,
        isHollow: true
      }
    });
    }
    
    return { body, innerBody, id };
  }

  /**
   * Create hollow building physics using walls instead of a single box
   * @param {THREE.Mesh} mesh - Building mesh
   * @param {number} width - Building width
   * @param {number} height - Building height
   * @param {number} depth - Building depth
   * @param {number} rotation - Building rotation
   */
  createHollowBuildingPhysics(mesh, width, height, depth, rotation = 0) {
    if (!this.physicsManager) return;
    
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const wallThickness = 0.3; // Wall thickness
    
    // Create a body for the building
    const buildingBody = new CANNON.Body({
      mass: 0, // Static
      position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z)
    });
    
    // Apply rotation if specified
    if (rotation !== 0) {
      const q = new CANNON.Quaternion();
      q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotation);
      buildingBody.quaternion.copy(q);
    }
    
    // Front wall
    const frontWall = new CANNON.Box(new CANNON.Vec3(halfWidth, height/2, wallThickness/2));
    buildingBody.addShape(frontWall, new CANNON.Vec3(0, 0, halfDepth - wallThickness/2));
    
    // Back wall
    const backWall = new CANNON.Box(new CANNON.Vec3(halfWidth, height/2, wallThickness/2));
    buildingBody.addShape(backWall, new CANNON.Vec3(0, 0, -halfDepth + wallThickness/2));
    
    // Left wall
    const leftWall = new CANNON.Box(new CANNON.Vec3(wallThickness/2, height/2, halfDepth - wallThickness));
    buildingBody.addShape(leftWall, new CANNON.Vec3(-halfWidth + wallThickness/2, 0, 0));
    
    // Right wall
    const rightWall = new CANNON.Box(new CANNON.Vec3(wallThickness/2, height/2, halfDepth - wallThickness));
    buildingBody.addShape(rightWall, new CANNON.Vec3(halfWidth - wallThickness/2, 0, 0));
    
    // Add floor (bottom)
    const floorWall = new CANNON.Box(new CANNON.Vec3(halfWidth - wallThickness, wallThickness/2, halfDepth - wallThickness));
    buildingBody.addShape(floorWall, new CANNON.Vec3(0, -height/2 + wallThickness/2, 0));
    
    // Add roof (top)
    const roofWall = new CANNON.Box(new CANNON.Vec3(halfWidth - wallThickness, wallThickness/2, halfDepth - wallThickness));
    buildingBody.addShape(roofWall, new CANNON.Vec3(0, height/2 - wallThickness/2, 0));
    
    // Set up material properties
    buildingBody.material = new CANNON.Material();
    buildingBody.material.friction = this.materials.stone.physics.friction;
    buildingBody.material.restitution = this.materials.stone.physics.restitution;
    
    // Add to physics world if available
    if (this.physicsManager.world) {
      this.physicsManager.world.addBody(buildingBody);
    }
    
    // Generate a unique ID for this building
    const id = `building_${mesh.position.x}_${mesh.position.y}_${mesh.position.z}`;
    
    // Add this ID to the mesh's userData so it can be detected by raycasting
    mesh.userData.physicsId = id;
    
    // Also register with physics manager for proper interaction
    const size = new THREE.Vector3(width, height, depth);
    if (this.physicsManager.physicsBodies) {
      this.physicsManager.physicsBodies.set(id, {
      body: buildingBody,
      mesh: mesh,
      properties: {
        size: { x: size.x, y: size.y, z: size.z },
        mass: 0,
        color: mesh.material.color ? mesh.material.color.getHex() : 0x808080,
        shape: 'box',
        metallic: false,
        restitution: this.materials.stone.physics.restitution,
        friction: this.materials.stone.physics.friction
      }
    });
    }
    
    return { body: buildingBody, id };
  }
}
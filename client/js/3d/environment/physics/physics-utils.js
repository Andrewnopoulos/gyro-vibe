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
    this.debugWireframes = new Map(); // Map of physicsId -> debug wireframe mesh
    this.debugMode = false; // Debug mode flag
    
    // Create physics materials and contacts
    if (this.physicsManager && this.physicsManager.world) {
      this.setupPhysicsMaterials();
    }
  }
  
  /**
   * Set up physics materials and contact properties for environment objects
   */
  setupPhysicsMaterials() {
    // Create a default material for environment objects
    this.physicsMaterial = new CANNON.Material('environmentMaterial');
    
    // Get default material from physics manager (used by spawned objects)
    const defaultMaterial = this.physicsManager.world.defaultMaterial;
    
    // Create contact between environment objects and default physics objects
    const contactMaterial = new CANNON.ContactMaterial(
      this.physicsMaterial,
      defaultMaterial,
      {
        friction: 0.4,
        restitution: 0.3,
        contactEquationStiffness: 1e7,
        contactEquationRelaxation: 3
      }
    );
    
    // Add the contact material to the world
    this.physicsManager.world.addContactMaterial(contactMaterial);
  }
  
  /**
   * Toggle physics debug wireframe mode
   * @param {boolean} enabled - Whether debug wireframes should be shown
   */
  toggleDebugMode(enabled) {
    this.debugMode = enabled;
    
    if (this.physicsManager && this.physicsManager.physicsBodies) {
      // Process all physics bodies
      this.physicsManager.physicsBodies.forEach((physicsObj, id) => {
        if (this.debugMode) {
          // Create wireframes for all existing physics bodies
          this.createDebugWireframe(physicsObj, id);
          
          // Hide the original mesh
          if (physicsObj.mesh) {
            // Store original visibility state
            physicsObj.originalVisibility = physicsObj.mesh.visible;
            // physicsObj.mesh.visible = false;
          }
        } else {
          // Remove wireframes
          this.removeDebugWireframe(id);
          
          // Restore the original mesh visibility
          if (physicsObj.mesh) {
            // Restore to original visibility or default to visible
            physicsObj.mesh.visible = 
              physicsObj.originalVisibility !== undefined ? 
              physicsObj.originalVisibility : true;
          }
        }
      });
    }
    
    if (!this.debugMode) {
      // Make sure we clean up all wireframes
      this.removeAllDebugWireframes();
    }
  }
  
  /**
   * Create debug wireframe for a physics body
   * @param {Object} physicsObj - Physics object containing body and mesh
   * @param {string} id - Unique ID for the physics body
   */
  createDebugWireframe(physicsObj, id) {
    if (!this.debugMode || !physicsObj || !physicsObj.body || !this.physicsManager.scene) return;
    
    // Remove any existing wireframe for this object
    this.removeDebugWireframe(id);
    
    const body = physicsObj.body;
    const wireframeGroup = new THREE.Group();
    
    // Process each shape in the body
    body.shapes.forEach((shape, shapeIndex) => {
      let wireframe;
      
      // Get shape offset and orientation
      const shapePosition = body.shapeOffsets[shapeIndex] || new CANNON.Vec3();
      const shapeQuaternion = body.shapeOrientations[shapeIndex] || new CANNON.Quaternion();
      
      // Create wireframe based on shape type
      if (shape instanceof CANNON.Box) {
        // Box wireframe
        const width = shape.halfExtents.x * 2;
        const height = shape.halfExtents.y * 2;
        const depth = shape.halfExtents.z * 2;
        
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshBasicMaterial({ 
          color: 0x00ff00, 
          wireframe: true,
          transparent: true,
          opacity: 0.7 // Higher opacity for better visibility now that the original mesh is hidden
        });
        
        wireframe = new THREE.Mesh(geometry, material);
      } 
      else if (shape instanceof CANNON.Sphere) {
        // Sphere wireframe
        const geometry = new THREE.SphereGeometry(shape.radius, 16, 8);
        const material = new THREE.MeshBasicMaterial({ 
          color: 0x0000ff, 
          wireframe: true,
          transparent: true,
          opacity: 0.7 // Higher opacity for better visibility
        });
        
        wireframe = new THREE.Mesh(geometry, material);
      } 
      else if (shape instanceof CANNON.Cylinder) {
        // Cylinder wireframe
        const geometry = new THREE.CylinderGeometry(
          shape.radiusTop, 
          shape.radiusBottom, 
          shape.height, 
          16
        );
        const material = new THREE.MeshBasicMaterial({ 
          color: 0xff0000, 
          wireframe: true,
          transparent: true,
          opacity: 0.7 // Higher opacity for better visibility
        });
        
        wireframe = new THREE.Mesh(geometry, material);
        
        // Adjust rotation to match Cannon.js cylinder orientation
        wireframe.rotation.x = Math.PI / 2;
      }
      else if (shape instanceof CANNON.Plane) {
        // Plane wireframe (thin box with large dimensions)
        const geometry = new THREE.PlaneGeometry(100, 100, 8, 8);
        const material = new THREE.MeshBasicMaterial({ 
          color: 0xffff00, 
          wireframe: true,
          transparent: true,
          opacity: 0.7, // Higher opacity for better visibility
          side: THREE.DoubleSide
        });
        
        wireframe = new THREE.Mesh(geometry, material);
      }
      
      // If we created a wireframe for this shape
      if (wireframe) {
        // Position and rotate wireframe according to shape offset and orientation
        wireframe.position.copy(shapePosition);
        wireframe.quaternion.copy(shapeQuaternion);
        
        // Add to group
        wireframeGroup.add(wireframe);
      }
    });
    
    // Position the entire wireframe group at the body's position
    wireframeGroup.position.copy(body.position);
    wireframeGroup.quaternion.copy(body.quaternion);
    
    // Add to scene
    this.physicsManager.scene.add(wireframeGroup);
    
    // Store reference
    this.debugWireframes.set(id, wireframeGroup);
  }
  
  /**
   * Update debug wireframe position and rotation to match physics body
   * @param {string} id - ID of the physics body
   */
  updateDebugWireframe(id) {
    if (!this.debugMode || !this.debugWireframes.has(id) || !this.physicsManager.physicsBodies.has(id)) return;
    
    const wireframe = this.debugWireframes.get(id);
    const physicsObj = this.physicsManager.physicsBodies.get(id);
    
    // Update position and rotation
    wireframe.position.copy(physicsObj.body.position);
    wireframe.quaternion.copy(physicsObj.body.quaternion);
  }
  
  /**
   * Remove debug wireframe for a specific physics body
   * @param {string} id - ID of the physics body
   */
  removeDebugWireframe(id) {
    if (!this.debugWireframes.has(id)) return;
    
    const wireframe = this.debugWireframes.get(id);
    
    // Remove from scene
    if (this.physicsManager.scene) {
      this.physicsManager.scene.remove(wireframe);
    }
    
    // Dispose geometries and materials
    wireframe.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) {
        if (Array.isArray(child.material)) {
          child.material.forEach(material => material.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
    
    // Remove from map
    this.debugWireframes.delete(id);
  }
  
  /**
   * Remove all debug wireframes
   */
  removeAllDebugWireframes() {
    // Get all ids in a separate array to avoid modification during iteration
    const allIds = Array.from(this.debugWireframes.keys());
    
    // Remove each wireframe
    allIds.forEach(id => {
      this.removeDebugWireframe(id);
    });
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
      ),
      material: this.physicsMaterial // Use the environment material
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
      const physicsObj = {
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
      };
      
      this.physicsManager.physicsBodies.set(id, physicsObj);
      
      // Handle debug mode
      if (this.debugMode) {
        // Create debug wireframe
        this.createDebugWireframe(physicsObj, id);
        
        // Hide the original mesh
        if (mesh) {
          physicsObj.originalVisibility = mesh.visible;
          mesh.visible = false;
        }
      }
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
    console.log("checking this.physicsmanager link");
    if (!this.physicsManager) return;
    console.log("success!!");
    // Create body
    const body = new CANNON.Body({
      mass: mass,
      position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
      quaternion: new CANNON.Quaternion().setFromEuler(
        mesh.rotation.x,
        mesh.rotation.y, 
        mesh.rotation.z
      ),
      material: this.physicsMaterial // Use the environment material
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

    console.log("hello there")
    
    // Add to the physicsBodies map in the physics manager if available
    if (this.physicsManager.physicsBodies) {
      const physicsObj = {
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
      };
      
      this.physicsManager.physicsBodies.set(id, physicsObj);
      
      // Handle debug mode
      if (this.debugMode) {
        // Create debug wireframe
        this.createDebugWireframe(physicsObj, id);
        
        // Hide the original mesh
        if (mesh) {
          physicsObj.originalVisibility = mesh.visible;
          mesh.visible = false;
        }
      }
    }

    console.log('Added body at:', body.position, 'Total bodies:', this.physicsManager.world.bodies.length);
    
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
      position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
      material: this.physicsMaterial // Use the environment material
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
        position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
        material: this.physicsMaterial // Use the environment material
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
      const physicsObj = {
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
      };
      
      this.physicsManager.physicsBodies.set(id, physicsObj);
      
      // Handle debug mode
      if (this.debugMode) {
        // Create debug wireframe
        this.createDebugWireframe(physicsObj, id);
        
        // Hide the original mesh
        if (mesh) {
          physicsObj.originalVisibility = mesh.visible;
          mesh.visible = false;
        }
        
        // Also create debug wireframe for inner body if it exists
        if (innerBody) {
          const innerPhysicsObj = {
            body: innerBody,
            mesh: mesh
          };
          
          // Use a different ID for the inner wireframe
          const innerId = `${id}_inner`;
          this.createDebugWireframe(innerPhysicsObj, innerId);
        }
      }
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
      position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
      material: this.physicsMaterial // Use the environment material
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
    
    // Set material properties (using environment material which already has contact defined)
    if (!buildingBody.material) {
      buildingBody.material = this.physicsMaterial;
    }
    
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
      const physicsObj = {
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
      };
      
      this.physicsManager.physicsBodies.set(id, physicsObj);
      
      // Handle debug mode
      if (this.debugMode) {
        // Create debug wireframe
        this.createDebugWireframe(physicsObj, id);
        
        // Hide the original mesh
        if (mesh) {
          physicsObj.originalVisibility = mesh.visible;
          mesh.visible = false;
        }
      }
    }
    
    return { body: buildingBody, id };
  }
  
  /**
   * Update all debug wireframes to match their physics bodies
   * Should be called in the update loop when debug mode is active
   */
  updateDebugWireframes() {
    if (!this.debugMode) return;
    
    // Update all wireframes to match their physics bodies
    for (const [id, wireframe] of this.debugWireframes.entries()) {
      this.updateDebugWireframe(id);
    }
  }
}
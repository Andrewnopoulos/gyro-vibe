import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Creates market stalls for the village
 */
export class MarketStalls {
  /**
   * @param {THREE.Scene} scene - The scene to add market stalls to
   * @param {Object} materials - Material definitions
   * @param {PhysicsUtils} physicsUtils - Physics utilities
   */
  constructor(scene, materials, physicsUtils) {
    this.scene = scene;
    this.materials = materials;
    this.physicsUtils = physicsUtils;
  }

  /**
   * Create a market stall at the specified position
   * @param {Object} position - Position {x, z}
   * @returns {Object} The created market stall objects
   */
  createMarketStall(position) {
    // Create base platform
    const baseGeometry = new THREE.BoxGeometry(3, 0.2, 2);
    const base = new THREE.Mesh(baseGeometry, this.materials.wood.visual);
    base.position.set(position.x, 0.1, position.z);
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);
    
    // Create posts at corners
    const postGeometry = new THREE.BoxGeometry(0.2, 2, 0.2);
    const posts = [];
    
    for (let x = -1; x <= 1; x += 2) {
      for (let z = -1; z <= 1; z += 2) {
        const post = new THREE.Mesh(postGeometry, this.materials.wood.visual);
        post.position.set(
          position.x + x * 1.4,
          1,
          position.z + z * 0.9
        );
        post.castShadow = true;
        post.receiveShadow = true;
        this.scene.add(post);
        posts.push(post);
      }
    }
    
    // Create roof
    const roofGeometry = new THREE.BoxGeometry(3.6, 0.2, 2.6);
    const roof = new THREE.Mesh(roofGeometry, this.materials.thatch.visual);
    roof.position.set(position.x, 2.1, position.z);
    roof.castShadow = true;
    roof.receiveShadow = true;
    this.scene.add(roof);
    
    // Create counter
    const counterGeometry = new THREE.BoxGeometry(2.8, 0.4, 0.8);
    const counter = new THREE.Mesh(counterGeometry, this.materials.wood.visual);
    counter.position.set(position.x, 0.7, position.z + 0.5);
    counter.castShadow = true;
    counter.receiveShadow = true;
    this.scene.add(counter);
    
    // Add a random item on the counter
    let randomItem = null;
    if (Math.random() > 0.5) {
      // Create a basket
      const basketGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.3, 8);
      const basket = new THREE.Mesh(basketGeometry, this.materials.thatch.visual);
      basket.position.set(position.x + 0.7, 1, position.z + 0.5);
      basket.castShadow = true;
      basket.receiveShadow = true;
      this.scene.add(basket);
      randomItem = basket;
    } else {
      // Create a box/crate
      const crateGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      const crate = new THREE.Mesh(crateGeometry, this.materials.wood.visual);
      crate.position.set(position.x - 0.7, 1, position.z + 0.5);
      crate.castShadow = true;
      crate.receiveShadow = true;
      this.scene.add(crate);
      randomItem = crate;
    }
    
    // Add physics if available
    if (this.physicsUtils) {
      // Create a compound body for the entire stall
      const stallBody = new CANNON.Body({
        mass: 0, // Static
        position: new CANNON.Vec3(position.x, 0, position.z)
      });
      
      // Base platform
      const baseShape = new CANNON.Box(new CANNON.Vec3(3/2, 0.2/2, 2/2));
      stallBody.addShape(baseShape, new CANNON.Vec3(0, 0.1, 0));
      
      // Posts
      const postShape = new CANNON.Box(new CANNON.Vec3(0.2/2, 2/2, 0.2/2));
      for (let x = -1; x <= 1; x += 2) {
        for (let z = -1; z <= 1; z += 2) {
          stallBody.addShape(
            postShape, 
            new CANNON.Vec3(x * 1.4, 1, z * 0.9)
          );
        }
      }
      
      // Roof
      const roofShape = new CANNON.Box(new CANNON.Vec3(3.6/2, 0.2/2, 2.6/2));
      stallBody.addShape(roofShape, new CANNON.Vec3(0, 2.1, 0));
      
      // Counter
      const counterShape = new CANNON.Box(new CANNON.Vec3(2.8/2, 0.4/2, 0.8/2));
      stallBody.addShape(counterShape, new CANNON.Vec3(0, 0.7, 0.5));
      
      // Set up material properties
      stallBody.material = new CANNON.Material();
      stallBody.material.friction = this.materials.wood.physics.friction;
      stallBody.material.restitution = this.materials.wood.physics.restitution;
      
      if (this.physicsUtils.physicsManager && this.physicsUtils.physicsManager.world) {
        this.physicsUtils.physicsManager.world.addBody(stallBody);
      
        // Register with physics system
        const id = `stall_${position.x}_${position.z}`;
        base.userData.physicsId = id;
      
        if (this.physicsUtils.physicsManager.physicsBodies) {
          this.physicsUtils.physicsManager.physicsBodies.set(id, {
        body: stallBody,
        mesh: base,
        properties: {
          size: { x: 3, y: 2.1, z: 2 },
          mass: 0,
          color: this.materials.wood.visual.color.getHex(),
          shape: 'box',
          metallic: false,
          restitution: this.materials.wood.physics.restitution,
          friction: this.materials.wood.physics.friction
        }
      });
        }
      }
      
      // Add physics for the random item - make it interactive
      if (randomItem) {
        if (randomItem.geometry.type === 'CylinderGeometry') {
          // Basket
          const shape = new CANNON.Cylinder(0.3, 0.4, 0.3, 8);
          this.physicsUtils.addPhysicsShape(randomItem, shape, 1);
        } else {
          // Crate
          this.physicsUtils.addPhysicsBox(randomItem, 1.5);
        }
      }
    }
    
    return {
      base,
      posts,
      roof,
      counter,
      randomItem
    };
  }
}
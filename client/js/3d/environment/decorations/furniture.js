import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Creates furniture and small decorative elements
 */
export class Furniture {
  /**
   * @param {THREE.Scene} scene - The scene to add furniture to
   * @param {Object} materials - Material definitions
   * @param {PhysicsUtils} physicsUtils - Physics utilities
   */
  constructor(scene, materials, physicsUtils) {
    this.scene = scene;
    this.materials = materials;
    this.physicsUtils = physicsUtils;
  }

  /**
   * Create a wooden bench
   * @param {Object} position - Position {x, z}
   * @param {number} rotation - Rotation in radians
   * @returns {Object} The created bench objects
   */
  createBench(position, rotation) {
    // Create seat
    const seatGeometry = new THREE.BoxGeometry(1.8, 0.1, 0.6);
    const seat = new THREE.Mesh(seatGeometry, this.materials.wood.visual);
    seat.position.set(position.x, 0.4, position.z);
    seat.rotation.y = rotation;
    seat.castShadow = true;
    seat.receiveShadow = true;
    this.scene.add(seat);

    // Create legs
    const legGeometry = new THREE.BoxGeometry(0.1, 0.4, 0.1);
    const legs = [];

    for (let x = -1; x <= 1; x += 2) {
      for (let z = -1; z <= 1; z += 2) {
        // Calculate offset based on rotation
        const offsetX = x * 0.8;
        const offsetZ = z * 0.25;

        // Apply rotation to offset
        const rotatedOffsetX = offsetX * Math.cos(rotation) - offsetZ * Math.sin(rotation);
        const rotatedOffsetZ = offsetX * Math.sin(rotation) + offsetZ * Math.cos(rotation);

        const leg = new THREE.Mesh(legGeometry, this.materials.wood.visual);
        leg.position.set(
          position.x + rotatedOffsetX,
          0.2,
          position.z + rotatedOffsetZ
        );
        leg.castShadow = true;
        leg.receiveShadow = true;
        this.scene.add(leg);
        legs.push(leg);
      }
    }

    // Create backrest (only for two legs)
    const backrestGeometry = new THREE.BoxGeometry(1.8, 0.6, 0.1);
    const backrest = new THREE.Mesh(backrestGeometry, this.materials.wood.visual);

    // Position based on rotation
    const backOffsetZ = 0.25;
    const rotatedBackOffsetX = -backOffsetZ * Math.sin(rotation);
    const rotatedBackOffsetZ = backOffsetZ * Math.cos(rotation);

    backrest.position.set(
      position.x + rotatedBackOffsetX,
      0.75,
      position.z + rotatedBackOffsetZ
    );
    backrest.rotation.y = rotation;
    backrest.castShadow = true;
    backrest.receiveShadow = true;
    this.scene.add(backrest);

    // Add physics if available
    if (this.physicsUtils) {
      // Create a compound body for the bench
      // For simplicity we'll use a single box for collision
      const rotationQuat = new CANNON.Quaternion();
      rotationQuat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotation);

      const benchShape = new CANNON.Box(new CANNON.Vec3(0.9, 0.4, 0.3));
      const benchBody = new CANNON.Body({
        mass: 0, // Static
        position: new CANNON.Vec3(position.x, 0.4, position.z),
        quaternion: rotationQuat
      });
      benchBody.addShape(benchShape);

      benchBody.material = new CANNON.Material();
      benchBody.material.friction = this.materials.wood.physics.friction;
      benchBody.material.restitution = this.materials.wood.physics.restitution;

      if (this.physicsUtils.physicsManager && this.physicsUtils.physicsManager.world) {
        this.physicsUtils.physicsManager.world.addBody(benchBody);

        // Register with physics system
        const id = `bench_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        seat.userData.physicsId = id;

        if (this.physicsUtils.physicsManager.physicsBodies) {
          this.physicsUtils.physicsManager.physicsBodies.set(id, {
            body: benchBody,
            mesh: seat,
            properties: {
              size: { x: 1.8, y: 0.6, z: 0.6 },
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

      return {
        seat,
        legs,
        backrest
      };
    }
  }

  /**
   * Create a haystack
   * @param {Object} position - Position {x, z}
   * @returns {Object} The created haystack mesh
   */
  createHaystack(position) {
    // Base cylinder
    const baseGeometry = new THREE.CylinderGeometry(1.5, 2, 1.5, 16);
    const base = new THREE.Mesh(baseGeometry, this.materials.thatch.visual);
    base.position.set(position.x, 0.75, position.z);
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);

    // Top cone
    const topGeometry = new THREE.ConeGeometry(1.5, 1, 16);
    const top = new THREE.Mesh(topGeometry, this.materials.thatch.visual);
    top.position.set(position.x, 1.75, position.z);
    top.castShadow = true;
    top.receiveShadow = true;
    this.scene.add(top);

    // Add physics
    if (this.physicsUtils) {
      // Use simplified collision (one cylinder)
      const haystackShape = new CANNON.Cylinder(1.5, 2, 2.5, 16);
      const haystackBody = new CANNON.Body({
        mass: 0, // Static
        position: new CANNON.Vec3(position.x, 1.25, position.z),
        shape: haystackShape
      });

      haystackBody.material = new CANNON.Material();
      haystackBody.material.friction = this.materials.thatch.physics.friction;
      haystackBody.material.restitution = this.materials.thatch.physics.restitution;

      if (this.physicsUtils.physicsManager && this.physicsUtils.physicsManager.world) {
        this.physicsUtils.physicsManager.world.addBody(haystackBody);

        // Register with physics system
        const id = `haystack_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        base.userData.physicsId = id;

        if (this.physicsUtils.physicsManager.physicsBodies) {
          this.physicsUtils.physicsManager.physicsBodies.set(id, {
            body: haystackBody,
            mesh: base,
            properties: {
              size: { x: 3, y: 2.5, z: 3 },
              mass: 0,
              color: this.materials.thatch.visual.color.getHex(),
              shape: 'cylinder',
              metallic: false,
              restitution: this.materials.thatch.physics.restitution,
              friction: this.materials.thatch.physics.friction
            }
          });
        }

        return { base, top };
      }
    }
  }
}

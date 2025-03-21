import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Creates a medieval village well
 */
export class Well {
  /**
   * @param {THREE.Scene} scene - The scene to add the well to
   * @param {Object} materials - Material definitions
   * @param {PhysicsUtils} physicsUtils - Physics utilities
   * @param {Map} objects - Map to store references to created objects
   */
  constructor(scene, materials, physicsUtils, objects) {
    this.scene = scene;
    this.materials = materials;
    this.physicsUtils = physicsUtils;
    this.objects = objects;
  }

  /**
   * Create a well at the specified position
   * @param {Object} position - Position {x, z}
   * @returns {Object} The created well objects
   */
  create(position) {
    // Create base
    const baseGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 16);
    const base = new THREE.Mesh(baseGeometry, this.materials.stone.visual);
    base.position.set(position.x, 0.25, position.z);
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);
    
    // Create wall
    const wallGeometry = new THREE.CylinderGeometry(1.2, 1.2, 1, 16);
    const wallMaterial = this.materials.stone.visual;
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    wall.position.set(position.x, 1, position.z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.scene.add(wall);
    
    // Create roof structure
    this.createRoofStructure(position);
    
    // Create bucket
    this.createBucket(position);
    
    // Add physics if available
    if (this.physicsUtils) {
      // Base
      const baseShape = new CANNON.Cylinder(1.5, 1.5, 0.5, 16);
      this.physicsUtils.addPhysicsShape(base, baseShape, 0);
      
      // Wall (use a compound shape for the hollow cylinder)
      const wallShape = new CANNON.Cylinder(1.2, 1.2, 1, 16);
      const innerShape = new CANNON.Cylinder(1.0, 1.0, 1.1, 16);
      this.physicsUtils.addPhysicsShapeWithHollow(wall, wallShape, innerShape, 0);
    }
    
    // Store well reference
    this.objects.set('well', { base, wall });
    
    return { base, wall };
  }

  /**
   * Create the roof structure for the well
   * @param {Object} position - Position {x, z}
   */
  createRoofStructure(position) {
    // Vertical beams
    const beam1Geometry = new THREE.BoxGeometry(0.2, 3, 0.2);
    const beam1 = new THREE.Mesh(beam1Geometry, this.materials.wood.visual);
    beam1.position.set(position.x + 1.3, 1.5, position.z);
    beam1.castShadow = true;
    beam1.receiveShadow = true;
    this.scene.add(beam1);
    
    const beam2Geometry = new THREE.BoxGeometry(0.2, 3, 0.2);
    const beam2 = new THREE.Mesh(beam2Geometry, this.materials.wood.visual);
    beam2.position.set(position.x - 1.3, 1.5, position.z);
    beam2.castShadow = true;
    beam2.receiveShadow = true;
    this.scene.add(beam2);
    
    // Horizontal beam
    const crossBeamGeometry = new THREE.BoxGeometry(3, 0.2, 0.2);
    const crossBeam = new THREE.Mesh(crossBeamGeometry, this.materials.wood.visual);
    crossBeam.position.set(position.x, 2.9, position.z);
    crossBeam.castShadow = true;
    crossBeam.receiveShadow = true;
    this.scene.add(crossBeam);
    
    // Roof
    const roofGeometry = new THREE.ConeGeometry(1.5, 0.8, 4);
    const roof = new THREE.Mesh(roofGeometry, this.materials.thatch.visual);
    roof.position.set(position.x, 3.5, position.z);
    roof.rotation.y = Math.PI / 4; // Rotate 45 degrees
    roof.castShadow = true;
    roof.receiveShadow = true;
    this.scene.add(roof);
    
    // Add physics if available
    if (this.physicsUtils) {
      // Beams
      this.physicsUtils.addPhysicsBox(beam1, 0);
      this.physicsUtils.addPhysicsBox(beam2, 0);
      this.physicsUtils.addPhysicsBox(crossBeam, 0);
      
      // Roof
      const roofShape = new CANNON.Cylinder(0.1, 1.5, 0.8, 4);
      this.physicsUtils.addPhysicsShape(roof, roofShape, 0);
    }
  }

  /**
   * Create the bucket for the well
   * @param {Object} position - Position {x, z}
   */
  createBucket(position) {
    // Bucket
    const bucketGeometry = new THREE.CylinderGeometry(0.3, 0.2, 0.4, 8);
    const bucket = new THREE.Mesh(bucketGeometry, this.materials.wood.visual);
    bucket.position.set(position.x, 1.7, position.z);
    bucket.castShadow = true;
    bucket.receiveShadow = true;
    this.scene.add(bucket);
    
    // Rope
    const ropeGeometry = new THREE.BoxGeometry(0.05, 1.2, 0.05);
    const ropeMaterial = new THREE.MeshStandardMaterial({ color: 0x7a6a5a });
    const rope = new THREE.Mesh(ropeGeometry, ropeMaterial);
    rope.position.set(position.x, 2.3, position.z);
    this.scene.add(rope);
    
    // Add physics if available
    if (this.physicsUtils) {
      // Bucket (interactive)
      const bucketShape = new CANNON.Cylinder(0.3, 0.2, 0.4, 8);
      this.physicsUtils.addPhysicsShape(bucket, bucketShape, 0.5);
    }
  }
}
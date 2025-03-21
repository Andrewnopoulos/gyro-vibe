import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Creates corner towers for the village walls
 */
export class Towers {
  /**
   * @param {THREE.Scene} scene - The scene to add towers to
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
   * Create a tower at the specified position
   * @param {Object} position - Position {x, z}
   * @param {number} height - Tower height
   * @returns {Object} The created tower objects
   */
  create(position, height) {
    // Base parameters
    const towerRadius = 3;
    const wallThickness = 0.8;
    
    // Create tower base (cylinder)
    const towerGeometry = new THREE.CylinderGeometry(towerRadius, towerRadius + 0.5, height, 16);
    const tower = new THREE.Mesh(towerGeometry, this.materials.stone.visual);
    tower.position.set(position.x, height/2, position.z);
    tower.castShadow = true;
    tower.receiveShadow = true;
    this.scene.add(tower);
    
    // Create crenellations on top
    this.addCrenellations(tower, towerRadius, height);
    
    // Create roof
    const roofHeight = 3;
    const roofGeometry = new THREE.ConeGeometry(towerRadius + 0.3, roofHeight, 16);
    const roof = new THREE.Mesh(roofGeometry, this.materials.thatch.visual);
    roof.position.set(position.x, height + roofHeight/2, position.z);
    roof.castShadow = true;
    roof.receiveShadow = true;
    this.scene.add(roof);
    
    // Add physics if available
    if (this.physicsUtils) {
      // Make the tower hollow for the physics
      const outerTowerShape = new CANNON.Cylinder(towerRadius, towerRadius + 0.5, height, 16);
      const innerTowerShape = new CANNON.Cylinder(towerRadius - wallThickness, (towerRadius + 0.5) - wallThickness, height + 0.2, 16);
      
      this.physicsUtils.addPhysicsShapeWithHollow(tower, outerTowerShape, innerTowerShape, 0);
      
      // Add roof physics
      const roofShape = new CANNON.Cylinder(0.1, towerRadius + 0.3, roofHeight, 16);
      this.physicsUtils.addPhysicsShape(roof, roofShape, 0);
    }
    
    // Store tower reference
    const towerKey = `tower_${position.x}_${position.z}`;
    this.objects.set(towerKey, { tower, roof });
    
    return { tower, roof };
  }

  /**
   * Add crenellations to the top of the tower
   * @param {THREE.Mesh} tower - The tower to add crenellations to
   * @param {number} radius - Tower radius
   * @param {number} height - Tower height
   */
  addCrenellations(tower, radius, height) {
    const crenel = {
      width: 0.5,
      height: 0.8,
      depth: 0.5
    };
    
    // Create a group for crenellations
    const crenelGroup = new THREE.Group();
    
    // Calculate number of crenels based on radius
    const circumference = 2 * Math.PI * radius;
    const numCrenels = Math.floor(circumference / 1.2);
    const angleStep = (2 * Math.PI) / numCrenels;
    
    // Create crenels
    for (let i = 0; i < numCrenels; i++) {
      const angle = i * angleStep;
      
      const crenelGeometry = new THREE.BoxGeometry(crenel.width, crenel.height, crenel.depth);
      const crenelMesh = new THREE.Mesh(crenelGeometry, this.materials.stone.visual);
      
      // Position around the top of the tower
      crenelMesh.position.set(
        Math.sin(angle) * radius,
        height/2 + crenel.height/2,
        Math.cos(angle) * radius
      );
      
      // Rotate to face outward
      crenelMesh.rotation.y = -angle;
      
      crenelMesh.castShadow = true;
      crenelMesh.receiveShadow = true;
      
      crenelGroup.add(crenelMesh);
    }
    
    // Add crenellations to tower
    tower.add(crenelGroup);
  }
}
import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Creates trees for the environment
 */
export class Trees {
  /**
   * @param {THREE.Scene} scene - The scene to add trees to
   * @param {Object} materials - Material definitions
   * @param {PhysicsUtils} physicsUtils - Physics utilities
   */
  constructor(scene, materials, physicsUtils) {
    this.scene = scene;
    this.materials = materials;
    this.physicsUtils = physicsUtils;
  }

  /**
   * Create trees around the village
   */
  create() {
    const treePositions = [
      { x: -25, z: -25 },
      { x: -22, z: 20 },
      { x: 22, z: -18 },
      { x: 28, z: 25 },
      { x: -15, z: -30 },
      { x: 30, z: 0 },
      { x: -35, z: -5 },
      { x: 18, z: 30 }
    ];
    
    const trees = [];
    
    treePositions.forEach(pos => {
      // Randomize position slightly
      const offsetX = (Math.random() - 0.5) * 5;
      const offsetZ = (Math.random() - 0.5) * 5;
      
      const tree = this.createTree({
        x: pos.x + offsetX,
        z: pos.z + offsetZ
      });
      
      trees.push(tree);
    });
    
    return trees;
  }

  /**
   * Create a single tree
   * @param {Object} position - Position {x, z}
   * @returns {Object} The created tree meshes
   */
  createTree(position) {
    // Create trunk
    const trunkHeight = 3 + Math.random() * 2;
    const trunkGeometry = new THREE.CylinderGeometry(0.4, 0.5, trunkHeight, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 1.0,
      metalness: 0.0
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.set(position.x, trunkHeight/2, position.z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    this.scene.add(trunk);
    
    // Create foliage (multiple layers of cones)
    const foliageMeshes = [];
    const foliageColor = 0x2d4c1e;
    const foliageLayers = 2 + Math.floor(Math.random() * 3);
    const foliageHeight = 5;
    const layerHeight = foliageHeight / foliageLayers;
    
    for (let i = 0; i < foliageLayers; i++) {
      const radius = 1.8 - (i * 0.3);
      const geometryFoliage = new THREE.ConeGeometry(radius, layerHeight, 8);
      const materialFoliage = new THREE.MeshStandardMaterial({
        color: foliageColor,
        roughness: 0.8,
        metalness: 0.0
      });
      const foliage = new THREE.Mesh(geometryFoliage, materialFoliage);
      
      // Position each layer
      const layerY = trunkHeight - 0.5 + (i * layerHeight) + layerHeight/2;
      foliage.position.set(position.x, layerY, position.z);
      foliage.castShadow = true;
      foliage.receiveShadow = true;
      this.scene.add(foliage);
      
      foliageMeshes.push(foliage);
    }
    
    // Add physics if available
    if (this.physicsUtils) {
      // Create trunk physics
      const trunkShape = new CANNON.Cylinder(0.4, 0.5, trunkHeight, 8);
      this.physicsUtils.addPhysicsShape(trunk, trunkShape, 0);
      
      // Create simplified foliage physics (one cone for collision)
      const foliageShape = new CANNON.Cylinder(0.2, 1.8, foliageHeight, 8);
      const foliageMesh = {
        position: new THREE.Vector3(position.x, trunkHeight + foliageHeight/2, position.z),
        geometry: { boundingBox: new THREE.Box3().setFromCenterAndSize(
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(3.6, foliageHeight, 3.6)
        )}
      };
      this.physicsUtils.addPhysicsShape(trunk, foliageShape, 0);
    }
    
    return {
      trunk,
      foliage: foliageMeshes,
      position
    };
  }
}
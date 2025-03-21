import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BuildingUtils } from './common.js';

/**
 * Creates medieval houses
 */
export class Houses {
  /**
   * @param {THREE.Scene} scene - The scene to add houses to
   * @param {Object} materials - Material definitions
   * @param {PhysicsUtils} physicsUtils - Physics utilities
   * @param {Map} objects - Map to store references to created objects
   */
  constructor(scene, materials, physicsUtils, objects) {
    this.scene = scene;
    this.materials = materials;
    this.physicsUtils = physicsUtils;
    this.objects = objects;
    this.buildingUtils = new BuildingUtils(scene, materials, physicsUtils);
  }

  /**
   * Create houses at various positions
   */
  create() {
    // House positions
    const housePositions = [
      { x: 10, z: -10, size: 'medium', rotation: Math.PI / 6 },
      { x: -10, z: -10, size: 'large', rotation: -Math.PI / 8 },
      { x: -15, z: -2, size: 'small', rotation: Math.PI / 2 },
      { x: 15, z: -5, size: 'medium', rotation: Math.PI / 4 }
    ];
    
    // Create houses at each position with variation
    housePositions.forEach((pos, index) => {
      const house = this.createHouse(pos);
      this.objects.set(`house_${index}`, house);
    });
  }

  /**
   * Create a house at the specified position
   * @param {Object} options - House options
   * @returns {Object} The created house objects
   */
  createHouse({ x, z, size = 'medium', rotation = 0 }) {
    // Size variations
    const sizes = {
      small: { width: 5, depth: 5, height: 3, roofHeight: 2 },
      medium: { width: 6, depth: 7, height: 3.5, roofHeight: 2.5 },
      large: { width: 8, depth: 9, height: 4, roofHeight: 3 }
    };
    
    // Get dimensions based on size
    const dimensions = sizes[size] || sizes.medium;
    
    // Pick materials based on variations
    const wallMaterial = Math.random() > 0.5 ? this.materials.wood : this.materials.stone;
    
    // Create the house
    const house = this.buildingUtils.createBasicBuilding({
      position: { x, z },
      width: dimensions.width,
      depth: dimensions.depth,
      height: dimensions.height,
      roofHeight: dimensions.roofHeight,
      roofType: 'pitched',
      wallMaterial: wallMaterial,
      roofMaterial: this.materials.thatch,
      rotation: rotation
    });
    
    // Add a chimney to some houses
    if (Math.random() > 0.3) {
      this.addChimney(house.group, dimensions);
    }
    
    return house;
  }

  /**
   * Add a chimney to a house
   * @param {THREE.Group} houseGroup - The house group to add the chimney to
   * @param {Object} dimensions - House dimensions
   */
  addChimney(houseGroup, dimensions) {
    // Create chimney
    const chimneyWidth = 0.8;
    const chimneyHeight = 2;
    const chimneyGeometry = new THREE.BoxGeometry(chimneyWidth, chimneyHeight, chimneyWidth);
    const chimney = new THREE.Mesh(chimneyGeometry, this.materials.stone.visual);
    
    // Position on the side of the roof
    const offsetX = dimensions.width * 0.3;
    const offsetZ = dimensions.depth * 0.25;
    const chimneyX = (Math.random() > 0.5) ? offsetX : -offsetX;
    const chimneyZ = (Math.random() > 0.5) ? offsetZ : -offsetZ;
    
    chimney.position.set(
      chimneyX,
      dimensions.height + chimneyHeight/2,
      chimneyZ
    );
    
    chimney.castShadow = true;
    chimney.receiveShadow = true;
    houseGroup.add(chimney);
    
    // Add physics if available
    if (this.physicsUtils) {
      this.physicsUtils.addPhysicsBox(chimney, 0);
    }
  }
}
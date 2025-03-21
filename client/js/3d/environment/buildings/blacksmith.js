import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BuildingUtils } from './common.js';

/**
 * Creates a medieval blacksmith building
 */
export class Blacksmith {
  /**
   * @param {THREE.Scene} scene - The scene to add the blacksmith to
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
   * Create a blacksmith at the specified position
   * @param {Object} position - Position {x, z}
   * @returns {Object} The created blacksmith objects
   */
  create(position) {
    // Main building
    const blacksmith = this.buildingUtils.createBasicBuilding({
      position: position,
      width: 7,
      depth: 8,
      height: 4,
      roofHeight: 2.5,
      roofType: 'pitched',
      wallMaterial: this.materials.stone,
      roofMaterial: this.materials.thatch,
      rotation: -Math.PI / 6 // Slightly rotated
    });
    
    // Add forge
    this.addForge(blacksmith.group, position);
    
    // Add anvil
    this.addAnvil(blacksmith.group, position);
    
    // Store references
    this.objects.set('blacksmith', blacksmith);
    
    return blacksmith;
  }

  /**
   * Add a forge to the blacksmith
   * @param {THREE.Group} smithGroup - The blacksmith group to add the forge to
   * @param {Object} position - Base position of the blacksmith
   */
  addForge(smithGroup, position) {
    // Create forge base
    const forgeBaseGeometry = new THREE.BoxGeometry(2, 1, 2);
    const forgeBase = new THREE.Mesh(forgeBaseGeometry, this.materials.stone.visual);
    forgeBase.position.set(2, 0.5, 3);
    forgeBase.castShadow = true;
    forgeBase.receiveShadow = true;
    smithGroup.add(forgeBase);
    
    // Create fire pit with glowing embers
    const firePitGeometry = new THREE.BoxGeometry(1, 0.2, 1);
    const firePitMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x222222, 
      roughness: 0.9, 
      metalness: 0.2,
      emissive: 0xff4400,
      emissiveIntensity: 0.5
    });
    const firePit = new THREE.Mesh(firePitGeometry, firePitMaterial);
    firePit.position.set(2, 1.1, 3);
    smithGroup.add(firePit);
    
    // Add chimney
    const chimneyGeometry = new THREE.BoxGeometry(1, 4, 1);
    const chimney = new THREE.Mesh(chimneyGeometry, this.materials.stone.visual);
    chimney.position.set(2, 3, 3.5);
    chimney.castShadow = true;
    chimney.receiveShadow = true;
    smithGroup.add(chimney);
    
    // Add physics if available
    if (this.physicsUtils) {
      this.physicsUtils.addPhysicsBox(forgeBase, 0);
      this.physicsUtils.addPhysicsBox(chimney, 0);
    }
  }

  /**
   * Add an anvil to the blacksmith
   * @param {THREE.Group} smithGroup - The blacksmith group to add the anvil to
   * @param {Object} position - Base position of the blacksmith
   */
  addAnvil(smithGroup, position) {
    // Create anvil base
    const anvilBaseGeometry = new THREE.BoxGeometry(0.6, 1, 0.6);
    const anvilBase = new THREE.Mesh(anvilBaseGeometry, this.materials.wood.visual);
    anvilBase.position.set(0, 0.5, 3);
    anvilBase.castShadow = true;
    anvilBase.receiveShadow = true;
    smithGroup.add(anvilBase);
    
    // Create anvil top
    const anvilTopGeometry = new THREE.BoxGeometry(1.2, 0.3, 0.4);
    const anvilMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x333333, 
      roughness: 0.3, 
      metalness: 0.8 
    });
    const anvilTop = new THREE.Mesh(anvilTopGeometry, anvilMaterial);
    anvilTop.position.set(0, 1.15, 3);
    anvilTop.castShadow = true;
    anvilTop.receiveShadow = true;
    smithGroup.add(anvilTop);
    
    // Add physics if available
    if (this.physicsUtils) {
      this.physicsUtils.addPhysicsBox(anvilBase, 0);
      this.physicsUtils.addPhysicsBox(anvilTop, 0);
    }
  }
}
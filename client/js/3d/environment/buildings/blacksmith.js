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
      // SIMPLIFIED APPROACH: Create clones with the correct world positions and use the standard methods
      
      // Calculate rotated positions
      const rotationY = -Math.PI / 6; // Same as blacksmith rotation
      const forgeRelativeX = 2;
      const forgeRelativeZ = 3;
      const chimneyRelativeX = 2;
      const chimneyRelativeZ = 3.5;
      
      // Calculate world positions using rotation matrix
      const forgeWorldX = position.x + forgeRelativeX * Math.cos(rotationY) - forgeRelativeZ * Math.sin(rotationY);
      const forgeWorldZ = position.z + forgeRelativeX * Math.sin(rotationY) + forgeRelativeZ * Math.cos(rotationY);
      
      const chimneyWorldX = position.x + chimneyRelativeX * Math.cos(rotationY) - chimneyRelativeZ * Math.sin(rotationY);
      const chimneyWorldZ = position.z + chimneyRelativeX * Math.sin(rotationY) + chimneyRelativeZ * Math.cos(rotationY);
      
      // Handle forge physics
      const worldForge = forgeBase.clone();
      worldForge.position.set(forgeWorldX, 0.5, forgeWorldZ);
      worldForge.rotation.y = rotationY;
      
      // Add to scene temporarily
      const originalForge = forgeBase;
      this.scene.add(worldForge);
      
      // Use standard method for the forge
      this.physicsUtils.addPhysicsBox(worldForge, 0);
      
      // Copy the physics ID to the original mesh
      if (worldForge.userData && worldForge.userData.physicsId) {
        originalForge.userData.physicsId = worldForge.userData.physicsId;
      }
      
      // Remove the temporary mesh
      this.scene.remove(worldForge);
      
      // Handle chimney physics
      const worldChimney = chimney.clone();
      worldChimney.position.set(chimneyWorldX, 3, chimneyWorldZ);
      worldChimney.rotation.y = rotationY;
      
      // Add to scene temporarily
      const originalChimney = chimney;
      this.scene.add(worldChimney);
      
      // Use standard method for the chimney
      this.physicsUtils.addPhysicsBox(worldChimney, 0);
      
      // Copy the physics ID to the original mesh
      if (worldChimney.userData && worldChimney.userData.physicsId) {
        originalChimney.userData.physicsId = worldChimney.userData.physicsId;
      }
      
      // Remove the temporary mesh
      this.scene.remove(worldChimney);
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
      // SIMPLIFIED APPROACH: Create clones with the correct world positions and use the standard methods
      
      // Calculate rotated positions
      const rotationY = -Math.PI / 6; // Same as blacksmith rotation
      const anvilRelativeX = 0;
      const anvilRelativeZ = 3;
      
      // Calculate world positions
      const anvilWorldX = position.x + anvilRelativeX * Math.cos(rotationY) - anvilRelativeZ * Math.sin(rotationY);
      const anvilWorldZ = position.z + anvilRelativeX * Math.sin(rotationY) + anvilRelativeZ * Math.cos(rotationY);
      
      // Handle anvil base physics
      const worldAnvilBase = anvilBase.clone();
      worldAnvilBase.position.set(anvilWorldX, 0.5, anvilWorldZ);
      worldAnvilBase.rotation.y = rotationY;
      
      // Add to scene temporarily
      const originalAnvilBase = anvilBase;
      this.scene.add(worldAnvilBase);
      
      // Use standard method for the anvil base
      this.physicsUtils.addPhysicsBox(worldAnvilBase, 0);
      
      // Copy the physics ID to the original mesh
      if (worldAnvilBase.userData && worldAnvilBase.userData.physicsId) {
        originalAnvilBase.userData.physicsId = worldAnvilBase.userData.physicsId;
      }
      
      // Remove the temporary mesh
      this.scene.remove(worldAnvilBase);
      
      // Handle anvil top physics
      const worldAnvilTop = anvilTop.clone();
      worldAnvilTop.position.set(anvilWorldX, 1.15, anvilWorldZ);
      worldAnvilTop.rotation.y = rotationY;
      
      // Add to scene temporarily
      const originalAnvilTop = anvilTop;
      this.scene.add(worldAnvilTop);
      
      // Use standard method for the anvil top
      this.physicsUtils.addPhysicsBox(worldAnvilTop, 0);
      
      // Copy the physics ID to the original mesh
      if (worldAnvilTop.userData && worldAnvilTop.userData.physicsId) {
        originalAnvilTop.userData.physicsId = worldAnvilTop.userData.physicsId;
      }
      
      // Remove the temporary mesh
      this.scene.remove(worldAnvilTop);
    }
  }
}
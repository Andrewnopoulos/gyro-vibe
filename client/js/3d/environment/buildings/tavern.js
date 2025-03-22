import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { BuildingUtils } from './common.js';

/**
 * Creates a medieval tavern building
 */
export class Tavern {
  /**
   * @param {THREE.Scene} scene - The scene to add the tavern to
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
   * Create a tavern at the specified position
   * @param {Object} position - Position {x, z}
   * @returns {Object} The created tavern objects
   */
  create(position) {
    // Main building
    const tavern = this.buildingUtils.createBasicBuilding({
      position: position,
      width: 8,
      depth: 10,
      height: 5,
      roofHeight: 3,
      roofType: 'pitched',
      wallMaterial: this.materials.wood,
      roofMaterial: this.materials.thatch,
      rotation: Math.PI / 4 // Rotated 45 degrees
    });
    
    // Add chimney
    this.addChimney(tavern.group, position);
    
    // Add sign
    this.addTavernSign(tavern.group, position);
    
    // Store references
    this.objects.set('tavern', tavern);
    
    return tavern;
  }

  /**
   * Add a chimney to the tavern
   * @param {THREE.Group} tavernGroup - The tavern group to add the chimney to
   * @param {Object} position - Base position of the tavern
   */
  addChimney(tavernGroup, position) {
    // Create chimney
    const chimneyGeometry = new THREE.BoxGeometry(1, 3, 1);
    const chimney = new THREE.Mesh(chimneyGeometry, this.materials.stone.visual);
    chimney.position.set(3, 6.5, 3);
    chimney.castShadow = true;
    chimney.receiveShadow = true;
    tavernGroup.add(chimney);
    
    // Add physics if available
    if (this.physicsUtils) {
      // SIMPLIFIED APPROACH: Create a clone with the correct world position and use the standard method
      
      // Calculate world position accounting for tavern position and rotation
      const rotationY = Math.PI / 4; // Same as tavern rotation
      const relativeX = 3;
      const relativeZ = 3;
      
      // Calculate rotated position
      const worldX = position.x + relativeX * Math.cos(rotationY) - relativeZ * Math.sin(rotationY);
      const worldZ = position.z + relativeX * Math.sin(rotationY) + relativeZ * Math.cos(rotationY);
      
      // Create a temporary mesh with the correct world position
      const worldChimney = chimney.clone();
      worldChimney.position.set(worldX, 6.5, worldZ);
      worldChimney.rotation.y = rotationY;
      
      // Add to scene temporarily
      const originalChimney = chimney;
      this.scene.add(worldChimney);
      
      // Use the standard method which works with gravity gun
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
   * Add a tavern sign to the building
   * @param {THREE.Group} tavernGroup - The tavern group to add the sign to
   * @param {Object} position - Base position of the tavern
   */
  addTavernSign(tavernGroup, position) {
    // Create sign post
    const postGeometry = new THREE.CylinderGeometry(0.1, 0.1, 4, 8);
    const post = new THREE.Mesh(postGeometry, this.materials.wood.visual);
    post.position.set(4.5, 2, 4.5);
    post.castShadow = true;
    post.receiveShadow = true;
    tavernGroup.add(post);
    
    // Create sign board
    const signGeometry = new THREE.BoxGeometry(2, 1, 0.1);
    const signMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x8B4513, 
      roughness: 0.7, 
      metalness: 0.2 
    });
    const sign = new THREE.Mesh(signGeometry, signMaterial);
    sign.position.set(4.5, 3.5, 4.5);
    sign.castShadow = true;
    sign.receiveShadow = true;
    tavernGroup.add(sign);
    
    // Add physics if available
    if (this.physicsUtils) {
      // SIMPLIFIED APPROACH: Create clones with the correct world positions and use the standard methods
      
      // Calculate rotated positions
      const rotationY = Math.PI / 4; // Same as tavern rotation
      const relativeX = 4.5;
      const relativeZ = 4.5;
      
      // Calculate world positions
      const worldX = position.x + relativeX * Math.cos(rotationY) - relativeZ * Math.sin(rotationY);
      const worldZ = position.z + relativeX * Math.sin(rotationY) + relativeZ * Math.cos(rotationY);
      
      // Handle post physics
      const worldPost = post.clone();
      worldPost.position.set(worldX, 2, worldZ);
      worldPost.rotation.y = rotationY;
      
      // Add to scene temporarily
      const originalPost = post;
      this.scene.add(worldPost);
      
      // Use standard method with cylinder shape
      const postShape = new CANNON.Cylinder(0.1, 0.1, 4, 8);
      this.physicsUtils.addPhysicsShape(worldPost, postShape, 0);
      
      // Copy the physics ID to the original mesh
      if (worldPost.userData && worldPost.userData.physicsId) {
        originalPost.userData.physicsId = worldPost.userData.physicsId;
      }
      
      // Remove the temporary mesh
      this.scene.remove(worldPost);
      
      // Handle sign physics
      const worldSign = sign.clone();
      worldSign.position.set(worldX, 3.5, worldZ);
      worldSign.rotation.y = rotationY;
      
      // Add to scene temporarily
      const originalSign = sign;
      this.scene.add(worldSign);
      
      // Use standard method for the sign
      this.physicsUtils.addPhysicsBox(worldSign, 0);
      
      // Copy the physics ID to the original mesh
      if (worldSign.userData && worldSign.userData.physicsId) {
        originalSign.userData.physicsId = worldSign.userData.physicsId;
      }
      
      // Remove the temporary mesh
      this.scene.remove(worldSign);
    }
  }
}
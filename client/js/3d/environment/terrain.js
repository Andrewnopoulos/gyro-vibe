import * as THREE from 'three';

/**
 * Creates terrain and paths for the environment
 */
export class TerrainBuilder {
  /**
   * @param {THREE.Scene} scene - The scene to add terrain to
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
   * Create terrain with proper physics
   */
  createTerrain() {
    // Create ground plane
    const groundSize = 100;
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 32, 32);
    const groundMaterial = this.materials.grass.visual;
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);
    
    // Store in objects map
    this.objects.set('mainGround', ground);
    
    // Create paths
    this.createPaths();
  }

  /**
   * Create dirt paths connecting village buildings
   */
  createPaths() {
    // Main north-south path
    this.createPath({
      start: { x: 0, z: -20 },
      end: { x: 0, z: 20 },
      width: 3
    });
    
    // East-west path crossing the main one
    this.createPath({
      start: { x: -20, z: 0 },
      end: { x: 20, z: 0 },
      width: 3
    });
    
    // Path to tavern
    this.createPath({
      start: { x: 0, z: 0 },
      end: { x: 15, z: 15 },
      width: 2
    });
    
    // Path to blacksmith
    this.createPath({
      start: { x: 0, z: 0 },
      end: { x: -15, z: 15 },
      width: 2
    });
  }
  
  /**
   * Create a dirt path between two points
   * @param {Object} options - Path options
   */
  createPath({ start, end, width }) {
    // Calculate path vector and length
    const pathVector = new THREE.Vector2(end.x - start.x, end.z - start.z);
    const length = pathVector.length();
    
    // Create path geometry
    const pathGeometry = new THREE.PlaneGeometry(width, length);
    const pathMaterial = this.materials.soil.visual;
    const path = new THREE.Mesh(pathGeometry, pathMaterial);
    
    // Position and rotate path
    path.rotation.x = -Math.PI / 2;
    path.position.y = -0.48; // Slightly above ground to prevent z-fighting
    
    // Calculate center position
    path.position.x = (start.x + end.x) / 2;
    path.position.z = (start.z + end.z) / 2;
    
    // Calculate rotation angle
    const angle = Math.atan2(pathVector.y, pathVector.x);
    path.rotation.z = -angle; // Negative because of the plane rotation
    
    path.receiveShadow = true;
    this.scene.add(path);
  }
}
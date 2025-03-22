import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Common building utility functions
 */
export class BuildingUtils {
  /**
   * @param {THREE.Scene} scene - The scene to add buildings to
   * @param {Object} materials - Material definitions 
   * @param {PhysicsUtils} physicsUtils - Physics utilities
   */
  constructor(scene, materials, physicsUtils) {
    this.scene = scene;
    this.materials = materials;
    this.physicsUtils = physicsUtils;
  }

  /**
   * Create a basic building structure with walls, roof, door and windows
   * @param {Object} options - Building options
   * @returns {Object} The created building objects
   */
  createBasicBuilding({
    position = { x: 0, z: 0 },
    width = 6,
    depth = 6,
    height = 4,
    roofHeight = 2,
    rotation = 0,
    roofType = 'pitched', // pitched, flat, dome
    wallMaterial = this.materials.stone,
    roofMaterial = this.materials.thatch,
    windows = true,
    door = true
  } = {}) {
    // Create container for all building meshes
    const buildingGroup = new THREE.Group();
    buildingGroup.position.set(position.x, 0, position.z);
    buildingGroup.rotation.y = rotation;
    this.scene.add(buildingGroup);
    
    // Building base/walls
    const wallsGeometry = new THREE.BoxGeometry(width, height, depth);
    const wallsMesh = new THREE.Mesh(wallsGeometry, wallMaterial.visual);
    wallsMesh.position.y = height / 2;
    wallsMesh.castShadow = true;
    wallsMesh.receiveShadow = true;
    buildingGroup.add(wallsMesh);
    
    // Roof
    let roofMesh;
    
    if (roofType === 'pitched') {
      // Create pitched roof
      const roofGeometry = new THREE.ConeGeometry(Math.max(width, depth) * 0.75, roofHeight, 4);
      roofMesh = new THREE.Mesh(roofGeometry, roofMaterial.visual);
      roofMesh.position.y = height + roofHeight / 2;
      roofMesh.rotation.y = Math.PI / 4; // Rotate 45 degrees for proper alignment
    } else if (roofType === 'dome') {
      // Create dome roof
      const roofGeometry = new THREE.SphereGeometry(Math.max(width, depth) * 0.6, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      roofMesh = new THREE.Mesh(roofGeometry, roofMaterial.visual);
      roofMesh.position.y = height;
    } else {
      // Default to flat roof
      const roofGeometry = new THREE.BoxGeometry(width + 0.5, 0.5, depth + 0.5);
      roofMesh = new THREE.Mesh(roofGeometry, roofMaterial.visual);
      roofMesh.position.y = height + 0.25;
    }
    
    roofMesh.castShadow = true;
    roofMesh.receiveShadow = true;
    buildingGroup.add(roofMesh);
    
    // Add windows if requested
    if (windows) {
      this.addWindowsToBuilding(buildingGroup, { width, height, depth });
    }
    
    // Add door if requested
    if (door) {
      this.addDoorToBuilding(buildingGroup, { width, height, depth });
    }
    
    // Add physics if available
    if (this.physicsUtils) {
      // SIMPLIFIED APPROACH: use the built-in addPhysicsBox method which is already known to work
      // with the gravity gun controller
      
      // First make sure the wallsMesh has a position that matches the building's world position
      // This is important for the gravity gun to work properly
      const worldBuildingMesh = wallsMesh.clone();
      worldBuildingMesh.position.set(position.x, height/2, position.z);
      worldBuildingMesh.rotation.y = rotation;
      
      // Add the mesh to the scene temporarily so it can be found by raycasting
      // (We'll remove it after adding physics)
      const originalMesh = wallsMesh;
      this.scene.add(worldBuildingMesh);
      
      // Use the standard method for adding physics, which ensures proper registration
      // with the physics manager and proper setup for gravity gun interaction
      this.physicsUtils.addPhysicsBox(worldBuildingMesh, 0); // 0 mass = static
      
      // Copy the physics ID from the temporary mesh to the original mesh
      // This ensures the original mesh in the group can be interacted with
      if (worldBuildingMesh.userData && worldBuildingMesh.userData.physicsId) {
        originalMesh.userData.physicsId = worldBuildingMesh.userData.physicsId;
      }
      
      // Remove the temporary mesh from the scene as it was just for physics setup
      this.scene.remove(worldBuildingMesh);
    }
    
    return {
      group: buildingGroup,
      walls: wallsMesh,
      roof: roofMesh
    };
  }

  /**
   * Add windows to a building
   * @param {THREE.Group} buildingGroup - The building group to add windows to
   * @param {Object} options - Window options
   */
  addWindowsToBuilding(buildingGroup, { width, height, depth, windowMaterial }) {
    // Use a dark material for windows
    const windowMat = windowMaterial || new THREE.MeshStandardMaterial({ 
      color: 0x4d4d4d, 
      roughness: 0.5, 
      metalness: 0.3,
      emissive: 0x404020,
      emissiveIntensity: 0.2
    });
    
    // Add windows on each wall
    // Front wall
    const frontWindow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      windowMat
    );
    frontWindow.position.set(1, height / 2 + 0.5, depth / 2 + 0.01);
    buildingGroup.add(frontWindow);
    
    // Back wall
    const backWindow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      windowMat
    );
    backWindow.position.set(-1, height / 2 + 0.5, -depth / 2 - 0.01);
    backWindow.rotation.y = Math.PI;
    buildingGroup.add(backWindow);
    
    // Left wall
    const leftWindow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      windowMat
    );
    leftWindow.position.set(-width / 2 - 0.01, height / 2 + 0.5, 1);
    leftWindow.rotation.y = Math.PI / 2;
    buildingGroup.add(leftWindow);
    
    // Right wall
    const rightWindow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      windowMat
    );
    rightWindow.position.set(width / 2 + 0.01, height / 2 + 0.5, -1);
    rightWindow.rotation.y = -Math.PI / 2;
    buildingGroup.add(rightWindow);
  }

  /**
   * Add a door to a building
   * @param {THREE.Group} buildingGroup - The building group to add a door to
   * @param {Object} options - Door options 
   */
  addDoorToBuilding(buildingGroup, { width, height, depth, doorMaterial }) {
    // Use a wood material for the door
    const doorMat = doorMaterial || this.materials.wood.visual;
    
    // Create door
    const doorGeometry = new THREE.PlaneGeometry(1.2, 2);
    const door = new THREE.Mesh(doorGeometry, doorMat);
    door.position.set(0, 1, depth / 2 + 0.01);
    buildingGroup.add(door);
  }
}
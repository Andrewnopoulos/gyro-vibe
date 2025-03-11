import * as THREE from 'three';

/**
 * Creates the 3D game environment
 */
export class Environment {
  /**
   * @param {THREE.Scene} scene - The Three.js scene
   */
  constructor(scene) {
    this.scene = scene;
    
    this.createSkybox();
    this.createTerrain();
    this.createDecorations();
    
    // Add some subtle fog for depth
    this.scene.fog = new THREE.FogExp2(0x90b0ff, 0.01);
  }

  /**
   * Create skybox for the environment
   */
  createSkybox() {
    const skyboxSize = 500;
    const skyboxGeometry = new THREE.BoxGeometry(skyboxSize, skyboxSize, skyboxSize);
    
    // Create skybox materials with gradient colors
    const skyboxMaterials = [
      new THREE.MeshBasicMaterial({ color: 0x0077ff, side: THREE.BackSide }), // Right side
      new THREE.MeshBasicMaterial({ color: 0x0066dd, side: THREE.BackSide }), // Left side
      new THREE.MeshBasicMaterial({ color: 0x0088ff, side: THREE.BackSide }), // Top side
      new THREE.MeshBasicMaterial({ color: 0x005599, side: THREE.BackSide }), // Bottom side
      new THREE.MeshBasicMaterial({ color: 0x0077ee, side: THREE.BackSide }), // Front side
      new THREE.MeshBasicMaterial({ color: 0x0066cc, side: THREE.BackSide })  // Back side
    ];
    
    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterials);
    this.scene.add(skybox);
  }

  /**
   * Create terrain (ground plane)
   */
  createTerrain() {
    // Create ground plane
    const groundSize = 100;
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 32, 32);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x3a8c3a, 
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  /**
   * Create decorative elements
   */
  createDecorations() {
    // Add random decorative cubes
    for (let i = 0; i < 20; i++) {
      const size = Math.random() * 2 + 0.5;
      const cubeGeometry = new THREE.BoxGeometry(size, size, size);
      const cubeMaterial = new THREE.MeshStandardMaterial({
        color: Math.random() > 0.5 ? 0x8a5430 : 0x6a7a8a,
        roughness: 0.7,
        metalness: 0.2
      });
      
      const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
      cube.position.set(
        (Math.random() - 0.5) * 40,
        size / 2 - 0.5,
        (Math.random() - 0.5) * 40
      );
      
      cube.castShadow = true;
      cube.receiveShadow = true;
      this.scene.add(cube);
    }
    
    // Add larger "buildings" or structures
    for (let i = 0; i < 5; i++) {
      const width = Math.random() * 4 + 2;
      const height = Math.random() * 8 + 4;
      const depth = Math.random() * 4 + 2;
      
      const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
      const buildingMaterial = new THREE.MeshStandardMaterial({
        color: 0x505050 + Math.random() * 0x202020,
        roughness: 0.7,
        metalness: 0.3
      });
      
      const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
      building.position.set(
        (Math.random() - 0.5) * 60,
        height / 2 - 0.5,
        (Math.random() - 0.5) * 60
      );
      
      building.castShadow = true;
      building.receiveShadow = true;
      this.scene.add(building);
    }
  }
}
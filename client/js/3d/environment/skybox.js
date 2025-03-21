import * as THREE from 'three';

/**
 * Create and add a skybox to the scene
 * @param {THREE.Scene} scene - The scene to add the skybox to
 * @returns {THREE.Mesh} The created skybox mesh
 */
export const createSkybox = (scene) => {
  const skyboxSize = 500;
  const skyboxGeometry = new THREE.BoxGeometry(skyboxSize, skyboxSize, skyboxSize);
  
  // Create skybox materials with medieval-appropriate colors
  const skyboxMaterials = [
    new THREE.MeshBasicMaterial({ color: 0xd6944a, side: THREE.BackSide }), // Right (East) - warm sunrise
    new THREE.MeshBasicMaterial({ color: 0x4a5e94, side: THREE.BackSide }), // Left (West) - cooler sunset
    new THREE.MeshBasicMaterial({ color: 0x9cb4e6, side: THREE.BackSide }), // Top (Sky)
    new THREE.MeshBasicMaterial({ color: 0x6b7b96, side: THREE.BackSide }), // Bottom
    new THREE.MeshBasicMaterial({ color: 0x93a2b8, side: THREE.BackSide }), // Front (North)
    new THREE.MeshBasicMaterial({ color: 0x89a39e, side: THREE.BackSide })  // Back (South)
  ];
  
  const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterials);
  scene.add(skybox);
  
  return skybox;
};
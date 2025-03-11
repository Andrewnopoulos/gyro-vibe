import * as THREE from 'three';

/**
 * Sets up lighting for the 3D scene
 */
export class Lighting {
  /**
   * @param {THREE.Scene} scene - The Three.js scene
   */
  constructor(scene) {
    this.scene = scene;
    this.setupLighting();
  }

  /**
   * Setup all lighting for the scene
   */
  setupLighting() {
    // Main directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffbb, 1.5);
    sunLight.position.set(10, 20, 10);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.camera.left = -20;
    sunLight.shadow.camera.right = 20;
    sunLight.shadow.camera.top = 20;
    sunLight.shadow.camera.bottom = -20;
    this.scene.add(sunLight);
    
    // Ambient light for general illumination
    const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
    this.scene.add(ambientLight);
    
    // Hemisphere light for better sky/ground color transition
    const hemisphereLight = new THREE.HemisphereLight(0x90b0ff, 0x283030, 0.6);
    this.scene.add(hemisphereLight);
  }
}
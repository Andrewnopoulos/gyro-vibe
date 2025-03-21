import * as THREE from 'three';

/**
 * Sets up lighting for a medieval village 3D scene
 */
export class Lighting {
  /**
   * @param {THREE.Scene} scene - The Three.js scene
   */
  constructor(scene) {
    this.scene = scene;
    this.lights = {}; // Store references to lights
    this.setupLighting();
  }

  /**
   * Setup all lighting for the scene
   */
  setupLighting() {
    // Main directional light (warm late afternoon sun)
    const sunLight = new THREE.DirectionalLight(0xf9d71c, 1.2);
    sunLight.position.set(15, 12, 8);
    sunLight.castShadow = true;
    
    // Enhance shadow quality
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 80;
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    
    // Add subtle blur to shadows
    sunLight.shadow.radius = 2;
    
    this.scene.add(sunLight);
    this.lights.sun = sunLight;
    
    // Ambient light for general illumination (warmer for medieval setting)
    const ambientLight = new THREE.AmbientLight(0x382b28, 0.4);
    this.scene.add(ambientLight);
    this.lights.ambient = ambientLight;
    
    // Hemisphere light for better sky/ground color transition
    const hemisphereLight = new THREE.HemisphereLight(0xdcc7a2, 0x3d4b30, 0.7);
    this.scene.add(hemisphereLight);
    this.lights.hemisphere = hemisphereLight;
    
    // Add point lights for torches and warm glows
    this.addTorchLights();
  }
  
  /**
   * Add torch and fireplace point lights around the village
   */
  addTorchLights() {
    // Create array of torch positions
    const torchPositions = [
      // Tavern torches
      { position: { x: 15, y: 3, z: 12 }, intensity: 1.0, distance: 15, decay: 2 },
      { position: { x: 18, y: 3, z: 15 }, intensity: 1.0, distance: 15, decay: 2 },
      
      // Blacksmith forge (brighter, more reddish)
      { position: { x: -16.5, y: 1.5, z: 15 }, intensity: 1.5, distance: 10, decay: 1.5, color: 0xff5500 },
      
      // Village square
      { position: { x: 0, y: 3, z: 0 }, intensity: 1.2, distance: 15, decay: 2 },
      
      // Gate torches
      { position: { x: 0, y: 4, z: -35 }, intensity: 0.8, distance: 12, decay: 2 },
      { position: { x: -35, y: 4, z: 0 }, intensity: 0.8, distance: 12, decay: 2 },
      
      // Random house lights
      { position: { x: -12, y: 2, z: -10 }, intensity: 0.7, distance: 8, decay: 2 },
      { position: { x: 12, y: 2, z: -12 }, intensity: 0.7, distance: 8, decay: 2 },
      { position: { x: 15, y: 2, z: -5 }, intensity: 0.7, distance: 8, decay: 2 },
    ];
    
    // Create torch lights
    torchPositions.forEach((torch, index) => {
      const color = torch.color || 0xff9c40; // Default warm orange torch color
      const light = new THREE.PointLight(color, torch.intensity, torch.distance, torch.decay);
      light.position.set(torch.position.x, torch.position.y, torch.position.z);
      
      // Only let some lights cast shadows to improve performance
      if (index % 3 === 0) {
        light.castShadow = true;
        light.shadow.mapSize.width = 512;
        light.shadow.mapSize.height = 512;
        light.shadow.radius = 5;
      }
      
      this.scene.add(light);
      this.lights[`torch_${index}`] = light;
      
      // Add subtle flickering effect for some torches
      if (index % 2 === 0) {
        this.addFlickeringEffect(light);
      }
    });
  }
  
  /**
   * Add subtle flickering effect to a light
   * @param {THREE.Light} light - The light to add flickering to
   */
  addFlickeringEffect(light) {
    // Store original intensity
    light.userData = {
      originalIntensity: light.intensity,
      time: Math.random() * 1000 // Random start time for each light
    };
  }
  
  /**
   * Update flickering lights
   * @param {number} time - Current time from animation loop
   */
  update(time) {
    // Update any lights with flickering effect
    Object.values(this.lights).forEach(light => {
      if (light.userData && light.userData.originalIntensity) {
        // Create subtle random flickering using noise
        const noise = Math.sin(time * 0.001 + light.userData.time) * 0.1 + 
                      Math.sin(time * 0.01 + light.userData.time) * 0.05;
        
        // Apply noise to light intensity
        light.intensity = light.userData.originalIntensity * (1 + noise);
      }
    });
  }
  
  /**
   * Change light settings for different times of day
   * @param {string} timeOfDay - Time of day setting ('dawn', 'day', 'dusk', 'night')
   */
  setTimeOfDay(timeOfDay) {
    switch(timeOfDay) {
      case 'dawn':
        // Early morning pinkish light
        this.lights.sun.color.set(0xffb98a);
        this.lights.sun.intensity = 0.8;
        this.lights.sun.position.set(10, 5, 10);
        this.lights.ambient.color.set(0x8e95b8);
        this.lights.ambient.intensity = 0.5;
        this.lights.hemisphere.intensity = 0.6;
        // Enhance torch brightness
        this.adjustTorchIntensities(1.2);
        break;
        
      case 'day':
        // Bright daylight
        this.lights.sun.color.set(0xffffff);
        this.lights.sun.intensity = 1.5;
        this.lights.sun.position.set(5, 20, 10);
        this.lights.ambient.color.set(0x6b7a99);
        this.lights.ambient.intensity = 0.6;
        this.lights.hemisphere.intensity = 0.9;
        // Dim torches during day
        this.adjustTorchIntensities(0.5);
        break;
        
      case 'dusk':
        // Default warm late afternoon
        this.lights.sun.color.set(0xf9d71c);
        this.lights.sun.intensity = 1.2;
        this.lights.sun.position.set(15, 12, 8);
        this.lights.ambient.color.set(0x382b28);
        this.lights.ambient.intensity = 0.4;
        this.lights.hemisphere.intensity = 0.7;
        // Return torches to normal brightness
        this.adjustTorchIntensities(1.0);
        break;
        
      case 'night':
        // Dark night with moonlight
        this.lights.sun.color.set(0x4070a0);
        this.lights.sun.intensity = 0.2;
        this.lights.sun.position.set(-10, 10, -10);
        this.lights.ambient.color.set(0x0a1025);
        this.lights.ambient.intensity = 0.3;
        this.lights.hemisphere.intensity = 0.4;
        // Enhance torch brightness
        this.adjustTorchIntensities(1.5);
        break;
    }
  }
  
  /**
   * Adjust all torch intensities by a multiplier
   * @param {number} multiplier - Multiplier for torch intensity
   */
  adjustTorchIntensities(multiplier) {
    Object.entries(this.lights).forEach(([key, light]) => {
      if (key.startsWith('torch_') && light.userData && light.userData.originalIntensity) {
        // Update the base value but keep the flicker effect
        light.userData.originalIntensity = light.userData.originalIntensity * multiplier;
      }
    });
  }
}
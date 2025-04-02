import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { DEFAULT_CAMERA_POSITION } from '../config.js';
import { PhoneModel } from './phone-model.js';
import { Environment } from './environment/index.js';
import { Lighting } from './lighting.js';
import { easeOutCubic } from '../utils/math.js';

/**
 * Manages the 3D scene and rendering
 */
export class SceneManager {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {THREE.LoadingManager} loadingManager - Three.js loading manager for tracking asset loading
   */
  constructor(eventBus, loadingManager = null) {
    this.eventBus = eventBus;
    this.loadingManager = loadingManager;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.orbitControls = null;
    this.container = document.getElementById('phone3d');
    this.animationFrameId = null;
    this.phoneModel = null;
    this.environment = null;
    this.lighting = null;
    this.firstPersonMode = false;
    this.prevTime = performance.now();
    
    this.init();
    this.setupEventListeners();
  }

  /**
   * Initialize the 3D scene
   */
  init() {
    // Create scene
    this.scene = new THREE.Scene();
    
    // Create camera
    this.camera = new THREE.PerspectiveCamera(
      75, 
      this.container.clientWidth / this.container.clientHeight, 
      0.1, 
      1000
    );
    this.camera.position.set(
      DEFAULT_CAMERA_POSITION.x, 
      DEFAULT_CAMERA_POSITION.y, 
      DEFAULT_CAMERA_POSITION.z
    );
    this.camera.lookAt(0, 0, 0);
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);
    
    // // Add reset view button handler
    // const resetViewBtn = document.getElementById('resetViewBtn');
    // if (resetViewBtn) {
    //   resetViewBtn.addEventListener('click', this.resetCameraView.bind(this));
    // }
    
    // Create lighting
    this.lighting = new Lighting(this.scene);
    
    // Create environment with event bus and let it get physics manager when ready
    // We're not passing physicsManager directly to avoid initialization order issues
    // Pass loading manager if available
    this.environment = new Environment(this.scene, null, this.eventBus, this.loadingManager);
    
    // Create phone model with loading manager if available
    this.phoneModel = new PhoneModel(this.scene, this.eventBus, this.loadingManager);
    
    // Add orbit controls
    this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.25;
    this.orbitControls.screenSpacePanning = false;
    this.orbitControls.maxPolarAngle = Math.PI;
    this.orbitControls.minDistance = 2;
    this.orbitControls.maxDistance = 30;
    
    // Start animation loop
    this.animate();
    
    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this), false);
    
    console.log('Medieval village scene initialized successfully');
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    this.eventBus.on('sensor:gyro-updated', (gyroData) => {
      // Always update the orientation, even in first-person mode
      // This ensures the orientation data is available for multiplayer
      if (this.phoneModel) {
        this.phoneModel.updateOrientation(gyroData);
      }
    });
    
    this.eventBus.on('calibration:started', () => {
      if (this.phoneModel) {
        this.phoneModel.setCalibrationMode(true);
      }
    });
    
    this.eventBus.on('calibration:complete', () => {
      if (this.phoneModel) {
        this.phoneModel.setCalibrationMode(false);
      }
    });
    
    this.eventBus.on('calibration:failed', () => {
      if (this.phoneModel) {
        this.phoneModel.setCalibrationMode(false);
      }
    });
    
    // Listen for time of day change requests
    this.eventBus.on('scene:set-time-of-day', this.setTimeOfDay.bind(this));
    
    // Add event listeners to provide scene and camera to other components
    this.eventBus.on('scene:get-scene', (callback) => {
      if (typeof callback === 'function') {
        callback(this.scene);
      }
    });
    
    this.eventBus.on('scene:get-camera', (callback) => {
      if (typeof callback === 'function') {
        callback(this.camera);
      }
    });
  }
  
  /**
   * Set the time of day for lighting
   * @param {Object} data - Time of day data 
   */
  setTimeOfDay(data) {
    const timeOfDay = data.timeOfDay || 'dusk';
    
    if (this.lighting && typeof this.lighting.setTimeOfDay === 'function') {
      this.lighting.setTimeOfDay(timeOfDay);
      console.log(`Time of day set to: ${timeOfDay}`);
    }
  }

  /**
   * Animation loop
   */
  animate() {
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    
    const time = performance.now();
    const delta = (time - this.prevTime) / 1000; // Convert to seconds
    
    if (this.orbitControls && !this.firstPersonMode) {
      // Update orbit controls when not in first-person mode
      this.orbitControls.update();
    }
    
    // Update lighting effects (torch flickering)
    if (this.lighting && this.lighting.update) {
      this.lighting.update(time);
    }
    
    // Emit update event for first-person controller and weapon view
    this.eventBus.emit('scene:update', { 
      delta: delta, 
      time: time 
    });
    
    // Get the enemy manager directly instead of scene traversal
    const enemyManager = this.findEnemyManager();
    if (enemyManager && enemyManager.particleEnemyGroup) {
      const group = enemyManager.particleEnemyGroup;
      
      // Process two-pass rendering regardless of active count (for debugging)
      // Step 1: Render the scene without particles to the render target
      group.prepareBackgroundCapture();
      this.renderer.setRenderTarget(group.backgroundRT);
      this.renderer.render(this.scene, this.camera);
      
      // Step 2: Restore particle visibility for main render
      group.restoreAfterBackgroundCapture();
      this.renderer.setRenderTarget(null);
      
      // Debug: Force texture update in shader material
      if (group.particleMesh && group.particleMesh.material && 
          group.particleMesh.material.uniforms && 
          group.particleMesh.material.uniforms.backgroundTexture) {
        // Ensure texture is updated
        group.particleMesh.material.uniforms.backgroundTexture.value = group.backgroundRT.texture;
      }
    }
    
    // Render the final scene with everything visible
    this.renderer.render(this.scene, this.camera);
    
    this.prevTime = time;
  }


  /**
   * Handle window resize
   */
  onWindowResize() {
    if (this.camera && this.renderer) {
      const width = this.container.clientWidth;
      const height = this.container.clientHeight;
      
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      
      // Also resize any particle enemy render targets
      const enemyManager = this.findEnemyManager();
      if (enemyManager && enemyManager.particleEnemyGroup) {
        enemyManager.particleEnemyGroup.resize(width, height);
        
        // Update resolution uniform in shader
        const group = enemyManager.particleEnemyGroup;
        if (group.particleMesh && group.particleMesh.material && 
            group.particleMesh.material.uniforms && 
            group.particleMesh.material.uniforms.resolution) {
          group.particleMesh.material.uniforms.resolution.value.set(width, height);
        }
      }
    }
  }

  /**
   * Reset camera view to default position
   */
  resetCameraView() {
    if (this.camera && this.orbitControls) {
      // Animate the camera back to original position
      const duration = 1000; // Duration in milliseconds
      const startTime = Date.now();
      const startPosition = {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z
      };
      
      const animateReset = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Use easing function for smoother motion
        const easeProgress = easeOutCubic(progress);
        
        // Interpolate position
        this.camera.position.set(
          startPosition.x + (DEFAULT_CAMERA_POSITION.x - startPosition.x) * easeProgress,
          startPosition.y + (DEFAULT_CAMERA_POSITION.y - startPosition.y) * easeProgress,
          startPosition.z + (DEFAULT_CAMERA_POSITION.z - startPosition.z) * easeProgress
        );
        
        // Look at the center
        this.camera.lookAt(0, 0, 0);
        
        // Reset orbit controls target and update
        this.orbitControls.target.set(0, 0, 0);
        this.orbitControls.update();
        
        // Continue animation if not finished
        if (progress < 1) {
          requestAnimationFrame(animateReset);
        }
      };
      
      // Start animation
      animateReset();
    }
  }

  /**
   * Set first-person mode
   * @param {boolean} enabled - Whether first-person mode is enabled
   */
  setFirstPersonMode(enabled) {
    this.firstPersonMode = enabled;
    
    if (this.orbitControls) {
      this.orbitControls.enabled = !enabled;
    }
    
    if (this.phoneModel) {
      // Only hide the phone model in first-person mode
      // but continue to update its orientation for multiplayer
      this.phoneModel.setVisible(!enabled);
    }
  }

  /**
   * Get scene
   * @returns {THREE.Scene} The scene
   */
  getScene() {
    return this.scene;
  }

  /**
   * Get camera
   * @returns {THREE.Camera} The camera
   */
  getCamera() {
    return this.camera;
  }

  /**
   * Get renderer
   * @returns {THREE.WebGLRenderer} The renderer
   */
  getRenderer() {
    return this.renderer;
  }

  /**
   * Get container element
   * @returns {HTMLElement} The container element
   */
  getContainer() {
    return this.container;
  }
  
  /**
   * Finds the EnemyManager instance
   * @returns {EnemyManager|null} The EnemyManager instance or null
   */
  findEnemyManager() {
    let enemyManager = null;
    this.eventBus.emit('enemy:get-manager', (manager) => {
      enemyManager = manager;
    });
    return enemyManager;
  }
}
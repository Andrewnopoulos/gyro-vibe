import * as THREE from 'three';
import { WEAPON_BOBBING } from '../config.js';
import { getQuaternion } from '../utils/math.js';

// Debug flag - set to false to hide the permanent raycast visualization
const DEBUG_RAYCAST = false;

/**
 * Manages first-person weapon view
 */
export class WeaponView {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {HTMLElement} container - Container element for 3D scene
   */
  constructor(eventBus, container) {
    this.eventBus = eventBus;
    this.container = container;
    this.weaponPhone = null;
    this.weaponScene = null;
    this.weaponCamera = null;
    this.weaponRenderer = null;
    this.weaponContainer = null;
    this.bobbingTime = 0;
    this.lastGyroData = { alpha: 0, beta: 0, gamma: 0 };
    this.isMoving = false;
    this.raycastOrigin = null;
    this.raycastBeam = null;
    this.debugRaycast = null;
    this.showDebugRaycast = DEBUG_RAYCAST; // Control debug visualization
    
    // Define the offset quaternion for correct orientation
    this.offsetQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2
    );
    
    this.init();
    this.setupEventListeners();
  }

  /**
   * Initialize weapon view
   */
  init() {
    // Create a separate container for the weapon view
    this.weaponContainer = document.createElement('div');
    this.weaponContainer.style.position = 'absolute';
    this.weaponContainer.style.top = '0';
    this.weaponContainer.style.left = '0';
    this.weaponContainer.style.width = '100%';
    this.weaponContainer.style.height = '100%';
    this.weaponContainer.style.pointerEvents = 'none'; // Allow clicks to pass through
    this.weaponContainer.style.display = 'none'; // Hidden by default
    this.container.appendChild(this.weaponContainer);
    
    // Create scene for weapon
    this.weaponScene = new THREE.Scene();
    
    // Add ambient light to weapon scene
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.weaponScene.add(ambientLight);
    
    // Add directional light to weapon scene for better shading
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(0, 1, 2);
    this.weaponScene.add(directionalLight);
    
    // Create camera for weapon view
    this.weaponCamera = new THREE.PerspectiveCamera(
      70, 
      this.container.clientWidth / this.container.clientHeight, 
      0.01, 
      10
    );
    
    // Create renderer for weapon view with transparent background
    this.weaponRenderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true // Transparent background
    });
    this.weaponRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.weaponRenderer.setClearColor(0x000000, 0); // Transparent
    this.weaponRenderer.setPixelRatio(window.devicePixelRatio);
    this.weaponContainer.appendChild(this.weaponRenderer.domElement);
    
    // Create the weapon phone model
    this.createWeaponPhoneModel();
    
    console.log('Weapon view initialized successfully');
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for sensor data updates
    this.eventBus.on('sensor:gyro-updated', (gyroData) => {
      this.lastGyroData = gyroData;
    });
    
    // Listen for first-person mode toggle
    this.eventBus.on('firstperson:enabled', () => {
      this.show();
    });
    
    this.eventBus.on('firstperson:disabled', () => {
      this.hide();
    });
    
    // Listen for rune effect events
    this.eventBus.on('weapon:apply-rune-effect', (data) => {
      this.applyRuneEffect(data.shape, data.confidence);
    });
    
    // Listen for gravity gun events to update visual feedback
    this.eventBus.on('gravityGun:pickup', () => {
      // Show beam when picking up an object
      this.updateGravityBeam(true);
    });
    
    this.eventBus.on('gravityGun:drop', () => {
      // Hide beam when dropping an object
      this.updateGravityBeam(false);
    });
    
    this.eventBus.on('gravityGun:update-target', (data) => {
      // Update beam to point at held object
      if (data.position) {
        const targetPos = new THREE.Vector3(
          data.position.x, 
          data.position.y, 
          data.position.z
        );
        this.updateGravityBeam(true, targetPos);
      }
    });
    
    this.eventBus.on('gravityGun:highlight', (data) => {
      // Visual indicator when pointing at a valid target
      if (this.raycastOrigin) {
        const indicator = this.raycastOrigin.getObjectByName('raycastOriginIndicator');
        if (indicator && indicator.material) {
          // Make the indicator visible when highlighting
          indicator.material.visible = true;
          // Change color based on whether we're pointing at a valid target
          indicator.material.color.set(data.targetFound ? 0x00ff00 : 0xff0000);
          
          // Schedule hiding the indicator after a short delay
          setTimeout(() => {
            if (indicator && indicator.material) {
              indicator.material.visible = false;
            }
          }, 100);
        }
      }
    });
    
    // Listen for window resize
    window.addEventListener('resize', this.onWindowResize.bind(this), false);
  }

  /**
   * Create weapon phone model
   */
  createWeaponPhoneModel() {
    // Phone dimensions - smaller for FPS view
    const width = 0.4;
    const height = 0.8;
    const depth = 0.05;
  
    // Create weapon phone group
    this.weaponPhone = new THREE.Group();
    this.weaponScene.add(this.weaponPhone);
    
    // Apply a -90 degree rotation around the X axis to the phone model itself
    // This fixes the orientation issue with the model
    this.weaponPhone.rotateX(-Math.PI / 2);
    
    // Create a container for phone components - this won't get the gyroscope rotation
    // but will maintain the -90 degree correction
    const phoneContainer = new THREE.Group();
    this.weaponPhone.add(phoneContainer);
  
    // Create phone body
    const phoneGeometry = new THREE.BoxGeometry(width, height, depth);
    const phoneMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x333333,
      specular: 0x111111,
      shininess: 30
    });
    const phoneBody = new THREE.Mesh(phoneGeometry, phoneMaterial);
    phoneContainer.add(phoneBody);
  
    // Add screen to the phone (front side)
    const screenGeometry = new THREE.BoxGeometry(width * 0.9, height * 0.9, depth * 0.1);
    const screenMaterial = new THREE.MeshBasicMaterial({ color: 0x22aaff });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.z = depth / 2 + 0.01;
    // Set a name for the screen to make it easier to find later
    screen.name = 'phoneScreen';
    phoneContainer.add(screen);
  
    // Add camera lens
    const lensGeometry = new THREE.CircleGeometry(0.025, 32);
    const lensMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const lens = new THREE.Mesh(lensGeometry, lensMaterial);
    lens.position.set(0, height * 0.35, depth / 2 + 0.01);
    phoneContainer.add(lens);
    
    // Add home button at the bottom to indicate orientation
    const homeButtonGeometry = new THREE.CircleGeometry(0.04, 32);
    const homeButtonMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
    const homeButton = new THREE.Mesh(homeButtonGeometry, homeButtonMaterial);
    homeButton.position.set(0, -height * 0.4, depth / 2 + 0.01);
    phoneContainer.add(homeButton);
    
    // Add raycast origin point at the top of the phone
    this.raycastOrigin = new THREE.Object3D();
    this.raycastOrigin.name = 'raycastOrigin';
    // Position at the top center of the phone, more forward to match visual expectation
    this.raycastOrigin.position.set(0, height / 2 + 0.05, depth + 0.1);
    phoneContainer.add(this.raycastOrigin);
    
    // Create a smaller, less obtrusive visual indicator for the raycast origin
    const originIndicator = new THREE.Mesh(
      new THREE.SphereGeometry(0.01, 8, 8),
      new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, 
        transparent: true,
        opacity: 0.7,
        visible: false // Only visible when highlighted
      })
    );
    originIndicator.name = 'raycastOriginIndicator';
    this.raycastOrigin.add(originIndicator);
    
    // Position the phone as a weapon in first-person view
    this.weaponPhone.position.set(0.25, -0.2, -0.8);
  }

  /**
   * Update weapon view
   * @param {number} delta - Time delta in seconds
   * @param {boolean} isMoving - Whether player is moving
   */
  update(delta, isMoving) {
    if (!this.weaponPhone) return;
    
    this.isMoving = isMoving;
    
    // First apply the real phone's orientation
    this.updateOrientation();
    
    // Then apply movement bobbing effect
    this.updateBobbing(delta);
    
    // Always update debug raycast to show current aiming direction
    this.updateDebugRaycast();
    
    // Render the weapon view
    if (this.weaponRenderer && this.weaponScene && this.weaponCamera) {
      this.weaponRenderer.render(this.weaponScene, this.weaponCamera);
    }
  }

  /**
   * Update orientation based on gyro data
   */
  updateOrientation() {
    if (!this.weaponPhone || !this.lastGyroData) return;
    
    // For 1:1 mapping between real phone and virtual phone, use quaternion directly
    const [w, x, y, z] = getQuaternion(
      this.lastGyroData.alpha, 
      this.lastGyroData.beta, 
      this.lastGyroData.gamma
    );
    const deviceQuaternion = new THREE.Quaternion(x, y, z, w);
    
    // Apply the offset followed by the device orientation
    this.weaponPhone.quaternion.copy(
      this.offsetQuaternion.clone().multiply(deviceQuaternion)
    );
  }

  /**
   * Update weapon bobbing animation
   * @param {number} delta - Time delta in seconds
   */
  updateBobbing(delta) {
    if (!this.weaponPhone) return;
    
    // Base position for the weapon phone
    const basePosition = { x: 0.25, y: -0.2, z: -0.8 };
    
    if (this.isMoving) {
      // Increment time for bobbing animation
      this.bobbingTime += delta * WEAPON_BOBBING.speed;
      
      // Calculate subtle vertical and horizontal bob
      const verticalBob = Math.sin(this.bobbingTime * 2) * (WEAPON_BOBBING.intensity * 0.3);
      const horizontalBob = Math.cos(this.bobbingTime) * (WEAPON_BOBBING.intensity * 0.15);
      
      // Apply bobbing to weapon position
      this.weaponPhone.position.y = basePosition.y + verticalBob;
      this.weaponPhone.position.x = basePosition.x + horizontalBob;
      this.weaponPhone.position.z = basePosition.z;
    } else {
      // Return to the neutral position when not moving
      this.weaponPhone.position.x = THREE.MathUtils.lerp(
        this.weaponPhone.position.x, 
        basePosition.x, 
        delta * 3
      );
      this.weaponPhone.position.y = THREE.MathUtils.lerp(
        this.weaponPhone.position.y, 
        basePosition.y, 
        delta * 3
      );
      this.weaponPhone.position.z = basePosition.z;
    }
  }

  /**
   * Handle window resize
   */
  onWindowResize() {
    if (this.weaponCamera && this.weaponRenderer) {
      this.weaponCamera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.weaponCamera.updateProjectionMatrix();
      this.weaponRenderer.setSize(this.container.clientWidth, this.container.clientHeight);
    }
  }

  /**
   * Show weapon view
   */
  show() {
    if (this.weaponContainer) {
      this.weaponContainer.style.display = 'block';
    }
  }

  /**
   * Hide weapon view
   */
  hide() {
    if (this.weaponContainer) {
      this.weaponContainer.style.display = 'none';
    }
  }
  
  /**
   * Apply rune effect to the weapon
   * @param {string} shape - The recognized shape
   * @param {number} confidence - Recognition confidence (0-1)
   */
  applyRuneEffect(shape, confidence) {
    if (!this.weaponPhone) return;
    
    console.log(`Applying rune effect to weapon: ${shape} (${Math.round(confidence * 100)}% confidence)`);
    
    // Clear any existing effects
    this.clearRuneEffects();
    
    // Apply different effects based on shape
    switch (shape.toLowerCase()) {
      case 'circle':
        this.applyCircleRuneEffect(confidence);
        break;
        
      case 'triangle':
        this.applyTriangleRuneEffect(confidence);
        break;
        
      default:
        this.applyGenericRuneEffect(confidence);
    }
  }
  
  /**
   * Clear all rune effects from the weapon
   */
  clearRuneEffects() {
    // Remove any effect meshes
    this.weaponPhone.traverse((child) => {
      if (child.userData && child.userData.isRuneEffect) {
        if (child.parent) {
          child.parent.remove(child);
        }
      }
    });
    
    // Clear any animations or timeouts
    if (this.runeEffectTimeout) {
      clearTimeout(this.runeEffectTimeout);
      this.runeEffectTimeout = null;
    }
  }
  
  /**
   * Apply circle rune effect (shield)
   * @param {number} confidence - Recognition confidence (0-1)
   */
  applyCircleRuneEffect(confidence) {
    // Find the phone screen to apply the effect to
    let phoneScreen = null;
    this.weaponPhone.traverse((child) => {
      if (child.name === 'phoneScreen') {
        phoneScreen = child;
      }
    });
    
    // Determine appropriate radius based on phone size
    let radius = 0.5;
    let shieldPosition = new THREE.Vector3(0, 0, 0.1);
    
    if (phoneScreen) {
      // Get screen dimensions to scale shield appropriately
      const box = new THREE.Box3().setFromObject(phoneScreen);
      const size = box.getSize(new THREE.Vector3());
      radius = Math.max(size.x, size.y) * 0.6;
      
      // Position the shield in front of the screen
      phoneScreen.getWorldPosition(shieldPosition);
      this.weaponPhone.worldToLocal(shieldPosition);
      shieldPosition.z += 0.1; // Position in front of the screen
    }
    
    // Create a circular shield effect
    const geometry = new THREE.RingGeometry(radius * 0.8, radius, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0x00AAFF,
      transparent: true,
      opacity: Math.min(0.7, confidence * 0.9),
      side: THREE.DoubleSide
    });
    
    const shield = new THREE.Mesh(geometry, material);
    shield.userData.isRuneEffect = true;
    
    // Position in front of the phone
    shield.position.copy(shieldPosition);
    
    // Add a pulsing animation
    const pulseSpeed = 1.5;
    const startTime = Date.now();
    
    // Create a glow inside the ring
    const innerGeometry = new THREE.CircleGeometry(radius * 0.75, 32);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0x88DDFF,
      transparent: true,
      opacity: Math.min(0.4, confidence * 0.6),
      side: THREE.DoubleSide
    });
    
    const innerShield = new THREE.Mesh(innerGeometry, innerMaterial);
    innerShield.userData.isRuneEffect = true;
    innerShield.position.copy(shieldPosition);
    innerShield.position.z -= 0.01; // Slightly behind the ring
    
    // Add to weapon
    this.weaponPhone.add(shield);
    this.weaponPhone.add(innerShield);
    
    // Animate
    const animate = () => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      const pulse = 1 + Math.sin(elapsedTime * pulseSpeed) * 0.1;
      
      if (shield.parent) {
        shield.scale.set(pulse, pulse, 1);
        innerShield.scale.set(pulse, pulse, 1);
        
        // Rotate slowly
        shield.rotation.z += 0.005;
        innerShield.rotation.z -= 0.003;
        
        // Update opacity based on confidence
        material.opacity = Math.min(0.7, confidence * 0.9) * (0.8 + Math.sin(elapsedTime * 2) * 0.2);
        innerMaterial.opacity = Math.min(0.4, confidence * 0.6) * (0.8 + Math.sin(elapsedTime * 3) * 0.2);
        
        // Continue animation
        requestAnimationFrame(animate);
      }
    };
    
    // Start animation
    animate();
    
    // Auto-remove effect after a few seconds
    this.runeEffectTimeout = setTimeout(() => {
      this.clearRuneEffects();
    }, 8000);
  }
  
  /**
   * Apply triangle rune effect (fireball)
   * @param {number} confidence - Recognition confidence (0-1)
   */
  applyTriangleRuneEffect(confidence) {
    // Find the phone screen to apply the effect to
    let phoneScreen = null;
    this.weaponPhone.traverse((child) => {
      if (child.name === 'phoneScreen') {
        phoneScreen = child;
      }
    });
    
    // Find phone screen dimensions from geometry if available
    let screenWidth = 0.35;
    let screenHeight = 0.7;
    let screenDepth = 0.05;
    
    if (phoneScreen && phoneScreen.geometry) {
      const box = new THREE.Box3().setFromObject(phoneScreen);
      const size = box.getSize(new THREE.Vector3());
      screenWidth = size.x;
      screenHeight = size.y;
      screenDepth = size.z;
    }
    
    // Create a fiery effect on the phone screen
    const screenGeometry = new THREE.PlaneGeometry(screenWidth * 0.95, screenHeight * 0.95);
    const screenMaterial = new THREE.MeshBasicMaterial({
      color: 0xFF5500,
      transparent: true,
      opacity: Math.min(0.8, confidence * 0.9)
    });
    
    const fireScreen = new THREE.Mesh(screenGeometry, screenMaterial);
    fireScreen.userData.isRuneEffect = true;
    
    // Position on the phone screen - use the screen's position if available
    if (phoneScreen) {
      const screenPos = new THREE.Vector3();
      phoneScreen.getWorldPosition(screenPos);
      this.weaponPhone.worldToLocal(screenPos);
      
      // Adjust to be slightly in front of the screen
      const screenNormal = new THREE.Vector3(0, 0, 1);
      screenNormal.applyQuaternion(phoneScreen.getWorldQuaternion(new THREE.Quaternion()));
      screenNormal.normalize();
      
      // Position the effect just in front of the screen
      fireScreen.position.copy(screenPos);
      fireScreen.position.z += 0.03;
    } else {
      // Fallback position if we couldn't find the screen
      fireScreen.position.set(0, 0, 0.05);
    }
    
    // Create fire particles
    const particleCount = 50;
    const particleGeometry = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    
    // Initialize particles
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      // Random position on the screen
      particlePositions[i3] = (Math.random() - 0.5) * screenWidth * 0.8;
      particlePositions[i3 + 1] = (Math.random() - 0.5) * screenHeight * 0.8;
      particlePositions[i3 + 2] = fireScreen.position.z + 0.01;
      
      // Random size
      particleSizes[i] = Math.random() * 0.04 + 0.01;
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(particleSizes, 1));
    
    // Particle material
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xFFAA22,
      size: 0.05,
      transparent: true,
      opacity: Math.min(0.9, confidence * 0.95),
      blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    particles.userData.isRuneEffect = true;
    
    // Add to weapon
    this.weaponPhone.add(fireScreen);
    this.weaponPhone.add(particles);
    
    // Animation variables
    const startTime = Date.now();
    
    // Animate
    const animate = () => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      
      if (fireScreen.parent) {
        // Pulsate screen
        const pulse = 1 + Math.sin(elapsedTime * 3) * 0.1;
        fireScreen.scale.set(pulse, pulse, 1);
        
        // Flicker color
        const r = 1.0;
        const g = 0.3 + Math.sin(elapsedTime * 5) * 0.2;
        const b = 0.1;
        screenMaterial.color.setRGB(r, g, b);
        
        // Animate particles
        const positions = particleGeometry.attributes.position.array;
        
        for (let i = 0; i < particleCount; i++) {
          const i3 = i * 3;
          
          // Move particles upward
          positions[i3 + 1] += 0.01 * (Math.random() + 0.5);
          
          // Add some horizontal movement
          positions[i3] += (Math.random() - 0.5) * 0.01;
          
          // Reset particles that go out of bounds
          if (positions[i3 + 1] > 0.4) {
            positions[i3] = (Math.random() - 0.5) * 0.3;
            positions[i3 + 1] = -0.3;
          }
        }
        
        particleGeometry.attributes.position.needsUpdate = true;
        
        // Continue animation
        requestAnimationFrame(animate);
      }
    };
    
    // Start animation
    animate();
    
    // Auto-remove effect after a few seconds
    this.runeEffectTimeout = setTimeout(() => {
      this.clearRuneEffects();
    }, 8000);
  }
  
  /**
   * Apply generic rune effect for unrecognized shapes
   * @param {number} confidence - Recognition confidence (0-1)
   */
  applyGenericRuneEffect(confidence) {
    // Find the phone screen for size reference
    let phoneScreen = null;
    this.weaponPhone.traverse((child) => {
      if (child.name === 'phoneScreen') {
        phoneScreen = child;
      }
    });
    
    // Determine box dimensions based on phone size
    let width = 0.45;
    let height = 0.85;
    let depth = 0.1;
    let boxPosition = new THREE.Vector3(0, 0, 0);
    
    if (phoneScreen) {
      // Get screen dimensions to scale box appropriately
      const box = new THREE.Box3().setFromObject(phoneScreen);
      const size = box.getSize(new THREE.Vector3());
      width = size.x * 1.1;   // Slightly larger than the screen
      height = size.y * 1.1;
      depth = size.z * 2;
      
      // Position around the center of the phone
      const phoneGeometry = phoneScreen.geometry;
      if (phoneGeometry) {
        phoneScreen.getWorldPosition(boxPosition);
        this.weaponPhone.worldToLocal(boxPosition);
      }
    }
    
    // Create a simple pulsing glow around the phone
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshBasicMaterial({
      color: 0xAA88FF,
      transparent: true,
      opacity: Math.min(0.5, confidence * 0.6),
      wireframe: true
    });
    
    const glowEffect = new THREE.Mesh(geometry, material);
    glowEffect.userData.isRuneEffect = true;
    
    // Position around the phone
    glowEffect.position.copy(boxPosition);
    
    // Add to weapon
    this.weaponPhone.add(glowEffect);
    
    // Animation variables
    const startTime = Date.now();
    
    // Animate
    const animate = () => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      
      if (glowEffect.parent) {
        // Pulse effect
        const pulse = 1 + Math.sin(elapsedTime * 2) * 0.1;
        glowEffect.scale.set(pulse, pulse, pulse);
        
        // Rotate slightly
        glowEffect.rotation.z = Math.sin(elapsedTime) * 0.1;
        
        // Continue animation
        requestAnimationFrame(animate);
      }
    };
    
    // Start animation
    animate();
    
    // Auto-remove effect after a few seconds
    this.runeEffectTimeout = setTimeout(() => {
      this.clearRuneEffects();
    }, 5000);
  }
  
  /**
   * Get raycast data for the gravity gun
   * @returns {Object} Object containing origin, direction, and weapon quaternion
   */
  getRaycastData() {
    if (!this.raycastOrigin || !this.weaponPhone) {
      return null;
    }

    // Get world position of raycast origin in weapon view space
    const origin = new THREE.Vector3();
    this.raycastOrigin.getWorldPosition(origin);

    // *** KEY CHANGE: Get the actual orientation of the weapon from the phone's gyroscope data ***
    // We need the full transformation hierarchy to get the correct orientation
    
    // First get the weapon's world quaternion that includes all transformations
    const weaponWorldQuaternion = new THREE.Quaternion();
    this.raycastOrigin.getWorldQuaternion(weaponWorldQuaternion);
    
    // Get forward direction from the weapon's perspective
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(weaponWorldQuaternion);
    
    // Make sure direction is normalized
    direction.normalize();

    // Also store the raw device quaternion for potential direct use
    const [w, x, y, z] = getQuaternion(
      this.lastGyroData.alpha, 
      this.lastGyroData.beta, 
      this.lastGyroData.gamma
    );
    const deviceQuaternion = new THREE.Quaternion(x, y, z, w);

    // Add a debug message
    console.log("Raycast origin:", origin, "direction:", direction);

    return {
      origin,
      direction,
      weaponWorldQuaternion,
      deviceQuaternion,
      rawGyroData: this.lastGyroData
    };
  }

  /**
   * Map a point from weapon view space to main scene space
   * This is an approximation since the weapon view is in a separate scene
   * @param {THREE.Vector3} weaponSpacePoint - Point in weapon view space
   * @param {THREE.Camera} mainCamera - Main scene camera
   * @returns {THREE.Vector3} Approximated point in main scene space
   */
  mapToWorldSpace(weaponSpacePoint, mainCamera, useWeaponOrientation = true) {
    // Start with the camera position as our base reference point
    const worldPoint = mainCamera.position.clone();
    
    // Add a small offset to position the raycast origin at a realistic position
    // in relation to where the weapon would be in the world
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(mainCamera.quaternion);
    worldPoint.addScaledVector(forward, 0.5); // Position in front of camera
    
    // Add a small vertical and lateral offset to match the visual weapon position
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(mainCamera.quaternion);
    worldPoint.addScaledVector(up, -0.2); // Slightly below camera center for more realistic positioning
    
    // Add slight rightward offset to match weapon position
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(mainCamera.quaternion);
    worldPoint.addScaledVector(right, 0.2); // Slightly to the right of camera
    
    return worldPoint;
  }
  
  /**
   * Get a world space direction vector that represents where the weapon is pointing
   * @param {THREE.Quaternion} cameraQuaternion - Main camera quaternion for reference frame
   * @returns {THREE.Vector3} Direction vector in world space
   */
  getWorldDirectionFromWeapon(cameraQuaternion) {
    if (!this.raycastOrigin || !this.weaponPhone) {
      // Fallback to camera forward direction
      return new THREE.Vector3(0, 0, -1).applyQuaternion(cameraQuaternion);
    }
    
    // Get the raw device rotation from gyroscope data
    const [w, x, y, z] = getQuaternion(
      this.lastGyroData.alpha, 
      this.lastGyroData.beta, 
      this.lastGyroData.gamma
    );
    const deviceQuaternion = new THREE.Quaternion(x, y, z, w);
    
    // Apply the offset correction that was used when creating the weapon view
    const correctedQuaternion = this.offsetQuaternion.clone().multiply(deviceQuaternion);
    
    // Create a transformation to align local weapon space with world space
    // This takes the weapon/phone's local forward vector and transforms it to world space
    
    // The phone's "forward" direction when used as a pointer/gun would be up from the screen
    // which corresponds to the local +Y axis after our initial rotation
    const weaponForward = new THREE.Vector3(0, 1, 0);
    
    // Transform this direction by the device orientation and any corrections
    weaponForward.applyQuaternion(correctedQuaternion);
    
    // Finally, transform to world space by applying camera rotation
    weaponForward.applyQuaternion(cameraQuaternion);
    
    // Ensure normalized
    weaponForward.normalize();
    
    return weaponForward;
  }

  /**
   * Create or update a beam visualization for the gravity gun
   * @param {boolean} isActive - Whether the beam should be active
   * @param {THREE.Vector3} targetPosition - Optional target position for the beam
   */
  updateGravityBeam(isActive, targetPosition = null) {
    // If beam should be inactive, remove it
    if (!isActive) {
      if (this.raycastBeam) {
        if (this.raycastBeam.parent) {
          this.raycastBeam.parent.remove(this.raycastBeam);
        }
        if (this.raycastBeam.geometry) {
          this.raycastBeam.geometry.dispose();
        }
        if (this.raycastBeam.material) {
          this.raycastBeam.material.dispose();
        }
        this.raycastBeam = null;
      }
      
      // Keep debug raycast visible even when beam is inactive
      this.updateDebugRaycast();
      
      return;
    }

    // Get raycast origin position
    if (!this.raycastOrigin) return;
    
    const origin = new THREE.Vector3();
    this.raycastOrigin.getWorldPosition(origin);
    
    // Create beam geometry
    const beamLength = targetPosition ? 
      origin.distanceTo(targetPosition) : 
      5; // Default length if no target
    
    // If we don't have a beam yet, create one
    if (!this.raycastBeam) {
      const beamGeometry = new THREE.CylinderGeometry(0.005, 0.005, beamLength, 8);
      // Rotate the cylinder so its length is along the z-axis
      beamGeometry.rotateX(Math.PI / 2);
      // Move origin of the cylinder to one end instead of center
      beamGeometry.translate(0, 0, -beamLength / 2);
      
      const beamMaterial = new THREE.MeshBasicMaterial({
        color: 0x00aaff,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending
      });
      
      this.raycastBeam = new THREE.Mesh(beamGeometry, beamMaterial);
      this.raycastOrigin.add(this.raycastBeam);
    } else {
      // Update existing beam geometry
      if (this.raycastBeam.geometry) {
        this.raycastBeam.geometry.dispose();
      }
      
      const beamGeometry = new THREE.CylinderGeometry(0.005, 0.005, beamLength, 8);
      beamGeometry.rotateX(Math.PI / 2);
      beamGeometry.translate(0, 0, -beamLength / 2);
      
      this.raycastBeam.geometry = beamGeometry;
    }
    
    // If we have a target position, point the beam at it
    if (targetPosition) {
      // Convert target to local space of raycast origin
      const raycastWorldPos = new THREE.Vector3();
      this.raycastOrigin.getWorldPosition(raycastWorldPos);
      
      const raycastWorldQuat = this.raycastOrigin.getWorldQuaternion(new THREE.Quaternion());
      
      // Get the direction to the target
      const direction = targetPosition.clone().sub(raycastWorldPos).normalize();
      
      // Create a quaternion that rotates from the default forward direction to the target direction
      const quaternion = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 0, -1), // Default forward direction
        direction
      );
      
      // Apply the rotation
      this.raycastBeam.quaternion.copy(quaternion);
    }
    
    // Pulse effect for the beam
    const pulse = 0.7 + Math.sin(Date.now() / 200) * 0.3;
    if (this.raycastBeam.material) {
      this.raycastBeam.material.opacity = pulse * 0.7;
    }
    
    // Also update debug raycast
    this.updateDebugRaycast(targetPosition);
  }
  
  /**
   * Create or update a debug raycast visualization
   * @param {THREE.Vector3} targetPosition - Optional target position for the beam
   */
  updateDebugRaycast(targetPosition = null) {
    // Return early if debug visualization is disabled
    if (!this.showDebugRaycast) {
      // If we have a debug raycast but shouldn't, remove it
      if (this.debugRaycast && this.debugRaycast.parent) {
        this.debugRaycast.parent.remove(this.debugRaycast);
        if (this.debugRaycast.geometry) {
          this.debugRaycast.geometry.dispose();
        }
        if (this.debugRaycast.material) {
          this.debugRaycast.material.dispose();
        }
        this.debugRaycast = null;
      }
      return;
    }
    
    // Create debug line if it doesn't exist yet
    if (!this.debugRaycast && this.raycastOrigin) {
      // Create line material - very thin, transparent line
      const material = new THREE.LineBasicMaterial({
        color: 0xff0000,
        transparent: true,
        opacity: 0.3,
        linewidth: 1
      });
      
      // Create line geometry with default length
      const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -10) // Default 10m length
      ];
      
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      // Create the line
      this.debugRaycast = new THREE.Line(geometry, material);
      this.raycastOrigin.add(this.debugRaycast);
    }
    
    // If we have the debug raycast, update its geometry
    if (this.debugRaycast) {
      // Get raycast data
      const raycastData = this.getRaycastData();
      if (!raycastData) return;
      
      // Default length if no target position provided
      const length = targetPosition ? 
        raycastData.origin.distanceTo(targetPosition) : 
        10;
      
      // Create points for the line
      const points = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, -length)
      ];
      
      // If there was a previous geometry, dispose it
      if (this.debugRaycast.geometry) {
        this.debugRaycast.geometry.dispose();
      }
      
      // Update geometry
      this.debugRaycast.geometry = new THREE.BufferGeometry().setFromPoints(points);
      
      // If we have a target position, point the ray at it
      if (targetPosition) {
        const raycastWorldPos = new THREE.Vector3();
        this.raycastOrigin.getWorldPosition(raycastWorldPos);
        
        const direction = targetPosition.clone().sub(raycastWorldPos).normalize();
        
        const quaternion = new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(0, 0, -1),
          direction
        );
        
        this.debugRaycast.quaternion.copy(quaternion);
      }
    }
  }
  
  /**
   * Toggle debug raycast visualization
   * @param {boolean} show - Whether to show the debug raycast
   */
  toggleDebugRaycast(show) {
    this.showDebugRaycast = show !== undefined ? show : !this.showDebugRaycast;
    
    // Update immediately
    this.updateDebugRaycast();
  }

  /**
   * Clean up resources
   */
  dispose() {
    // Remove raycast beam
    if (this.raycastBeam) {
      if (this.raycastBeam.parent) {
        this.raycastBeam.parent.remove(this.raycastBeam);
      }
      if (this.raycastBeam.geometry) {
        this.raycastBeam.geometry.dispose();
      }
      if (this.raycastBeam.material) {
        this.raycastBeam.material.dispose();
      }
      this.raycastBeam = null;
    }
    
    // Remove debug raycast line
    if (this.debugRaycast) {
      if (this.debugRaycast.parent) {
        this.debugRaycast.parent.remove(this.debugRaycast);
      }
      if (this.debugRaycast.geometry) {
        this.debugRaycast.geometry.dispose();
      }
      if (this.debugRaycast.material) {
        this.debugRaycast.material.dispose();
      }
      this.debugRaycast = null;
    }
    
    // Clear any animations or timeouts
    if (this.runeEffectTimeout) {
      clearTimeout(this.runeEffectTimeout);
      this.runeEffectTimeout = null;
    }
    
    // Remove event listeners
    window.removeEventListener('resize', this.onWindowResize.bind(this));
  }
}
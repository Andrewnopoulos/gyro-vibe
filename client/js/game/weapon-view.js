import * as THREE from 'three';
import { WEAPON_BOBBING } from '../config.js';
import { getQuaternion } from '../utils/math.js';

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
}
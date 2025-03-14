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
   * Create wizard staff weapon model
   */
  createWeaponPhoneModel() {
    // Create weapon group
    this.weaponPhone = new THREE.Group();
    this.weaponScene.add(this.weaponPhone);
    
    // Apply a rotation to fix the orientation issue
    this.weaponPhone.rotateX(-Math.PI / 2);
    
    // Create a container for staff components
    const staffContainer = new THREE.Group();
    this.weaponPhone.add(staffContainer);
  
    // Create staff shaft using a cylinder
    const shaftGeometry = new THREE.CylinderGeometry(0.04, 0.03, 1.2, 8, 6, true);
    // Apply bending and gnarled effect to vertices
    const vertices = shaftGeometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i);
      const y = vertices.getY(i);
      const z = vertices.getZ(i);
      
      // Apply some random displacement for a gnarled look
      const noise = Math.sin(y * 10) * 0.01;
      const curve = Math.sin(y * 0.5) * 0.05;
      
      vertices.setX(i, x + noise + curve);
      vertices.setZ(i, z + noise);
    }
    
    // Brown wooden material with texture
    const woodMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x5d4037,
      specular: 0x1a1209,
      shininess: 10,
      flatShading: true
    });
    
    const staffShaft = new THREE.Mesh(shaftGeometry, woodMaterial);
    staffContainer.add(staffShaft);
  
    // Create knots/bumps along the staff
    for (let i = 0; i < 5; i++) {
      const knotPosition = -0.5 + i * 0.2;
      const knotSize = 0.02 + Math.random() * 0.02;
      const knotGeometry = new THREE.SphereGeometry(knotSize, 8, 8);
      const knotMesh = new THREE.Mesh(knotGeometry, woodMaterial);
      knotMesh.position.set(
        (Math.random() - 0.5) * 0.06,
        knotPosition,
        (Math.random() - 0.5) * 0.06
      );
      staffShaft.add(knotMesh);
    }
    
    // Create crystal/orb at the top
    const orbGeometry = new THREE.SphereGeometry(0.08, 16, 16);
    const orbMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x6fd5ff,
      specular: 0xffffff,
      shininess: 90,
      transparent: true,
      opacity: 0.8
    });
    const orb = new THREE.Mesh(orbGeometry, orbMaterial);
    orb.position.y = 0.6;
    staffContainer.add(orb);
    
    // Add "roots" at the bottom of the staff
    const addRoot = (angle, length, thickness) => {
      const rootGeometry = new THREE.CylinderGeometry(thickness * 0.5, thickness, length, 5, 1);
      const root = new THREE.Mesh(rootGeometry, woodMaterial);
      root.position.y = -0.6;
      root.rotation.x = Math.PI / 2 - 0.3;
      root.rotation.z = angle;
      staffContainer.add(root);
    };
    
    for (let i = 0; i < 4; i++) {
      addRoot(i * Math.PI / 2, 0.1 + Math.random() * 0.05, 0.02);
    }
    
    // Position the staff in first-person view
    this.weaponPhone.position.set(0.25, -0.3, -0.8);
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
   * Update wizard staff bobbing animation
   * @param {number} delta - Time delta in seconds
   */
  updateBobbing(delta) {
    if (!this.weaponPhone) return;
    
    // Base position for the wizard staff - slightly lower and more to the side
    // to resemble how a wizard would hold a staff
    const basePosition = { x: 0.3, y: -0.3, z: -0.7 };
    
    if (this.isMoving) {
      // Increment time for bobbing animation
      this.bobbingTime += delta * WEAPON_BOBBING.speed;
      
      // Calculate subtle vertical and horizontal bob
      // Slightly more pronounced for the staff to give it a magical feel
      const verticalBob = Math.sin(this.bobbingTime * 2) * (WEAPON_BOBBING.intensity * 0.35);
      const horizontalBob = Math.cos(this.bobbingTime) * (WEAPON_BOBBING.intensity * 0.2);
      
      // Add a slight rotational sway to the staff while moving
      const rotationBob = Math.sin(this.bobbingTime) * 0.02;
      this.weaponPhone.rotation.z = -Math.PI / 2 + rotationBob;
      
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
      
      // Slowly return rotation to neutral
      this.weaponPhone.rotation.z = THREE.MathUtils.lerp(
        this.weaponPhone.rotation.z,
        -Math.PI / 2,
        delta * 2
      );
      
      // Add a subtle idle animation - gentle floating effect
      const idleFloat = Math.sin(Date.now() * 0.001) * 0.01;
      this.weaponPhone.position.y += idleFloat;
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
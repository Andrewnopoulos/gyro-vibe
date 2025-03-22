import * as THREE from 'three';
import { getQuaternion } from '../utils/math.js';

/**
 * Creates and manages the 3D phone model
 */
export class PhoneModel {
  /**
   * @param {THREE.Scene} scene - The Three.js scene
   * @param {EventBus} eventBus - The application event bus
   * @param {THREE.LoadingManager} loadingManager - Loading manager for tracking assets
   */
  constructor(scene, eventBus, loadingManager = null) {
    this.scene = scene;
    this.eventBus = eventBus;
    this.loadingManager = loadingManager;
    this.phone = null;
    this.calibrationMode = false;
    this.runeMode = false;
    this.runeModeIndicator = null;
    
    // Define offset quaternion for correct orientation
    this.offsetQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2
    );
    
    // Notify about model loading if we have event bus
    if (this.eventBus) {
      this.eventBus.emit('asset:load-start', { type: 'model', count: 1 });
    }
    
    this.createPhoneModel();
    this.setupEventListeners();
    
    // Mark phone model as loaded
    if (this.eventBus) {
      this.eventBus.emit('asset:load-complete', { type: 'model', count: 1 });
    }
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for rune mode toggle events
    if (this.eventBus) {
      this.eventBus.on('runeMode:toggled', this.handleRuneModeToggled.bind(this));
    }
  }
  
  /**
   * Handle rune mode toggled event
   * @param {Object} data - Event data
   */
  handleRuneModeToggled(data) {
    this.setRuneMode(data.active);
  }

  /**
   * Create the 3D phone model
   */
  createPhoneModel() {
    // Phone dimensions
    const width = 0.8;
    const height = 1.6;
    const depth = 0.1;
  
    // Create phone group
    this.phone = new THREE.Group();
    this.scene.add(this.phone);
  
    // Create phone body
    const phoneGeometry = new THREE.BoxGeometry(width, height, depth);
    const phoneMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x333333,
      specular: 0x111111,
      shininess: 30
    });
    const phoneBody = new THREE.Mesh(phoneGeometry, phoneMaterial);
    this.phone.add(phoneBody);
  
    // Add screen to the phone (front side)
    const screenGeometry = new THREE.BoxGeometry(width * 0.9, height * 0.9, depth * 0.1);
    const screenMaterial = new THREE.MeshBasicMaterial({ color: 0x3355ff });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.z = depth / 2 + 0.01;
    this.phone.add(screen);
    
    // Store screen reference for rune mode toggle
    this.phoneScreen = screen;
  
    // Add camera lens
    const lensGeometry = new THREE.CircleGeometry(0.05, 32);
    const lensMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const lens = new THREE.Mesh(lensGeometry, lensMaterial);
    lens.position.set(0, height * 0.35, depth / 2 + 0.01);
    this.phone.add(lens);
    
    // Add home button at the bottom to indicate orientation
    const homeButtonGeometry = new THREE.CircleGeometry(0.08, 32);
    const homeButtonMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
    const homeButton = new THREE.Mesh(homeButtonGeometry, homeButtonMaterial);
    homeButton.position.set(0, -height * 0.4, depth / 2 + 0.01);
    this.phone.add(homeButton);
    
    // Add text indicator for front side
    const frontTextGeometry = new THREE.BoxGeometry(width * 0.5, height * 0.1, depth * 0.05);
    const frontTextMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const frontText = new THREE.Mesh(frontTextGeometry, frontTextMaterial);
    frontText.position.set(0, 0, depth / 2 + 0.02);
    this.phone.add(frontText);
    
    // Add indicator for the top of the phone
    const topIndicatorGeometry = new THREE.BoxGeometry(width * 0.3, height * 0.05, depth * 0.05);
    const topIndicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const topIndicator = new THREE.Mesh(topIndicatorGeometry, topIndicatorMaterial);
    topIndicator.position.set(0, height * 0.45, depth / 2 + 0.02);
    this.phone.add(topIndicator);
  
    // Add X, Y, Z axes indicators for better visualization
    const axisLength = 0.4;
    
    // X axis (red) - points right from the phone's perspective
    const xAxisGeometry = new THREE.CylinderGeometry(0.02, 0.02, axisLength, 8);
    const xAxisMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const xAxis = new THREE.Mesh(xAxisGeometry, xAxisMaterial);
    xAxis.rotation.z = Math.PI / 2; // Rotate to point along X axis
    xAxis.position.set(axisLength/2, 0, 0);
    this.phone.add(xAxis);
    
    // Y axis (green) - points up from the phone's perspective
    const yAxisGeometry = new THREE.CylinderGeometry(0.02, 0.02, axisLength, 8);
    const yAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const yAxis = new THREE.Mesh(yAxisGeometry, yAxisMaterial);
    yAxis.position.set(0, axisLength/2, 0);
    this.phone.add(yAxis);
    
    // Z axis (blue) - points out from the phone's screen
    const zAxisGeometry = new THREE.CylinderGeometry(0.02, 0.02, axisLength, 8);
    const zAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    const zAxis = new THREE.Mesh(zAxisGeometry, zAxisMaterial);
    zAxis.rotation.x = Math.PI / 2; // Rotate to point along Z axis
    zAxis.position.set(0, 0, axisLength/2);
    this.phone.add(zAxis);
    
    // Create rune mode indicator
    this.createRuneModeIndicator(width, height, depth);
    
    console.log('Phone model created successfully');
  }
  
  /**
   * Create rune mode visual indicator
   * @param {number} width - Phone width
   * @param {number} height - Phone height
   * @param {number} depth - Phone depth
   */
  createRuneModeIndicator(width, height, depth) {
    // Create a rune symbol indicator that will be visible in rune mode
    const runeSize = 0.4;
    
    // Create a group for the rune indicator
    this.runeModeIndicator = new THREE.Group();
    
    // Rune circle border
    const runeBorderGeometry = new THREE.RingGeometry(runeSize * 0.8, runeSize, 32);
    const runeBorderMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x9932CC, // Purple color for rune
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    });
    const runeBorder = new THREE.Mesh(runeBorderGeometry, runeBorderMaterial);
    runeBorder.position.z = depth / 2 + 0.03;
    this.runeModeIndicator.add(runeBorder);
    
    // Create triangular rune symbol inside the circle
    const triangleShape = new THREE.Shape();
    triangleShape.moveTo(0, runeSize * 0.6);
    triangleShape.lineTo(-runeSize * 0.5, -runeSize * 0.3);
    triangleShape.lineTo(runeSize * 0.5, -runeSize * 0.3);
    triangleShape.lineTo(0, runeSize * 0.6);
    
    const triangleGeometry = new THREE.ShapeGeometry(triangleShape);
    const triangleMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x7B68EE, // Medium slate blue
      side: THREE.DoubleSide
    });
    const triangle = new THREE.Mesh(triangleGeometry, triangleMaterial);
    triangle.position.z = depth / 2 + 0.04;
    this.runeModeIndicator.add(triangle);
    
    // Create a pulsing light effect for the rune
    const runeLight = new THREE.PointLight(0x9370DB, 1, 3);
    runeLight.position.set(0, 0, depth / 2 + 0.2);
    this.runeModeIndicator.add(runeLight);
    
    // Store references for animation
    this.runeLight = runeLight;
    this.runeBorder = runeBorder;
    this.runeSymbol = triangle;
    
    // Add to phone and initially hide it
    this.phone.add(this.runeModeIndicator);
    this.runeModeIndicator.visible = false;
    
    // Start animation loop for the rune indicator
    this.animateRuneIndicator();
  }
  
  /**
   * Animate the rune indicator with pulsing effects
   */
  animateRuneIndicator() {
    if (!this.runeModeIndicator) return;
    
    const animate = () => {
      if (!this.runeModeIndicator) return;
      
      // Only update if rune mode is active
      if (this.runeMode) {
        // Pulsing light intensity
        const time = Date.now() * 0.001;
        if (this.runeLight) {
          this.runeLight.intensity = 0.5 + Math.sin(time * 2) * 0.3;
        }
        
        // Rotating rune symbol
        if (this.runeSymbol) {
          this.runeSymbol.rotation.z = time * 0.5;
        }
        
        // Pulsing border
        if (this.runeBorder && this.runeBorder.material) {
          this.runeBorder.material.opacity = 0.6 + Math.sin(time * 3) * 0.3;
        }
      }
      
      // Continue animation loop
      requestAnimationFrame(animate);
    };
    
    // Start animation loop
    animate();
  }
  
  /**
   * Set rune mode active state
   * @param {boolean} active - Whether rune mode is active
   */
  setRuneMode(active) {
    this.runeMode = active;
    
    // Show/hide rune indicator
    if (this.runeModeIndicator) {
      this.runeModeIndicator.visible = active;
    }
    
    // Change screen color in rune mode
    if (this.phoneScreen && this.phoneScreen.material) {
      if (active) {
        // Change to purple in rune mode
        this.phoneScreen.material.color.setHex(0x800080);
      } else {
        // Reset to default blue screen
        this.phoneScreen.material.color.setHex(0x3355ff);
      }
    }
    
    // Log the state change
    console.log(`Phone model: Rune mode ${active ? 'activated' : 'deactivated'}`);
  }

  /**
   * Update phone orientation based on gyroscope data
   * @param {Object} gyroData - Gyroscope data (alpha, beta, gamma)
   */
  updateOrientation(gyroData) {
    if (!this.phone) return;
  
    if (this.calibrationMode) {
      // In calibration mode, show phone flat
      this.phone.quaternion.copy(this.offsetQuaternion);
    } else {
      const [w, x, y, z] = getQuaternion(gyroData.alpha, gyroData.beta, gyroData.gamma);
      const deviceQuaternion = new THREE.Quaternion(x, y, z, w);
      
      // Apply offset first, then relative orientation
      this.phone.quaternion.copy(this.offsetQuaternion.clone().multiply(deviceQuaternion));
    }
  }

  /**
   * Set calibration mode
   * @param {boolean} isCalibrating - Whether calibration is in progress
   */
  setCalibrationMode(isCalibrating) {
    this.calibrationMode = isCalibrating;
    
    // If entering calibration mode, update orientation immediately
    if (isCalibrating && this.phone) {
      this.phone.quaternion.copy(this.offsetQuaternion);
    }
  }

  /**
   * Set phone visibility
   * @param {boolean} visible - Whether phone is visible
   */
  setVisible(visible) {
    if (this.phone) {
      this.phone.visible = visible;
    }
  }

  /**
   * Get the phone model (for remote players)
   * @returns {THREE.Group} The phone group
   */
  getModel() {
    return this.phone;
  }
  
  /**
   * Set phone position
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} z - Z position
   */
  setPosition(x, y, z) {
    if (this.phone) {
      this.phone.position.set(x, y, z);
    }
  }
  
  /**
   * Set phone quaternion directly
   * @param {THREE.Quaternion} quaternion - The quaternion to set
   */
  setQuaternion(quaternion) {
    if (this.phone) {
      this.phone.quaternion.copy(quaternion);
    }
  }
  
  /**
   * Dispose of the phone model and resources
   */
  dispose() {
    if (this.phone) {
      // Remove from scene
      this.scene.remove(this.phone);
      
      // Traverse the phone group and dispose of geometries and materials
      this.phone.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) {
            object.geometry.dispose();
          }
          
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      });
      
      this.phone = null;
    }
  }
}
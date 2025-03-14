import * as THREE from 'three';
import { getQuaternion } from '../utils/math.js';

/**
 * Creates and manages the 3D phone model
 */
export class PhoneModel {
  /**
   * @param {THREE.Scene} scene - The Three.js scene
   */
  constructor(scene) {
    this.scene = scene;
    this.phone = null;
    this.calibrationMode = false;
    
    // Define offset quaternion for correct orientation
    this.offsetQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0),
      -Math.PI / 2
    );
    
    this.createPhoneModel();
  }

  /**
   * Create the 3D wizard model
   */
  createPhoneModel() {
    // Wizard dimensions
    const bodyWidth = 0.6;
    const bodyHeight = 1.4;
    const bodyDepth = 0.4;
  
    // Create wizard group - we still call it 'phone' for compatibility
    this.phone = new THREE.Group();
    this.scene.add(this.phone);
    
    // Create a container to apply the 180 degree rotation to fix backward facing issue
    const wizardContainer = new THREE.Group();
    // Rotate 180 degrees around Y axis to face forward
    wizardContainer.rotation.y = Math.PI;
    this.phone.add(wizardContainer);
  
    // Create wizard body (robe)
    const bodyGeometry = new THREE.ConeGeometry(bodyWidth, bodyHeight, 8);
    const bodyMaterial = new THREE.MeshPhongMaterial({
      color: 0x303f9f, // Deep blue for wizard robe
      specular: 0x222222,
      shininess: 10
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    // Position to have point at bottom
    body.position.y = bodyHeight / 2;
    wizardContainer.add(body);
    
    // Create robe details - belt/sash
    const beltGeometry = new THREE.TorusGeometry(bodyWidth * 0.85, 0.05, 8, 16);
    const beltMaterial = new THREE.MeshPhongMaterial({
      color: 0xffeb3b, // Gold/yellow belt
      specular: 0x777733,
      shininess: 50
    });
    const belt = new THREE.Mesh(beltGeometry, beltMaterial);
    belt.position.y = bodyHeight * 0.25;
    belt.rotation.x = Math.PI / 2; // Lay flat
    wizardContainer.add(belt);
    
    // Add star pattern to the robe
    const addStar = (x, y, z, size) => {
      const starGeometry = new THREE.BoxGeometry(size, size, size * 0.1);
      const starMaterial = new THREE.MeshBasicMaterial({ color: 0xffeb3b }); // Gold stars
      const star = new THREE.Mesh(starGeometry, starMaterial);
      star.position.set(x, y, z);
      body.add(star);
    };
    
    // Add random stars to the robe
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = bodyWidth * 0.6 * Math.random();
      const height = bodyHeight * 0.1 + Math.random() * bodyHeight * 0.7;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      addStar(x, height, z, 0.05 + Math.random() * 0.05);
    }
    
    // Create wizard head
    const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const headMaterial = new THREE.MeshPhongMaterial({
      color: 0xffe0bd, // Skin tone
      specular: 0x222222,
      shininess: 20
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = bodyHeight + 0.05;
    wizardContainer.add(head);
    
    // Create wizard hat
    const hatBaseGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16);
    const hatConeGeometry = new THREE.ConeGeometry(0.25, 0.6, 16);
    const hatMaterial = new THREE.MeshPhongMaterial({
      color: 0x303f9f, // Same as robe
      specular: 0x222222,
      shininess: 10
    });
    
    const hatBase = new THREE.Mesh(hatBaseGeometry, hatMaterial);
    hatBase.position.y = bodyHeight + 0.25;
    wizardContainer.add(hatBase);
    
    const hatCone = new THREE.Mesh(hatConeGeometry, hatMaterial);
    hatCone.position.y = bodyHeight + 0.6;
    wizardContainer.add(hatCone);
    
    // Add hat decoration
    const hatBandGeometry = new THREE.TorusGeometry(0.3, 0.03, 8, 16);
    const hatBandMaterial = new THREE.MeshPhongMaterial({
      color: 0xffeb3b, // Gold/yellow band
      specular: 0x777733,
      shininess: 50
    });
    const hatBand = new THREE.Mesh(hatBandGeometry, hatBandMaterial);
    hatBand.position.y = bodyHeight + 0.25;
    hatBand.rotation.x = Math.PI / 2; // Lay flat
    wizardContainer.add(hatBand);
    
    // Create wizard beard
    const beardGeometry = new THREE.ConeGeometry(0.2, 0.4, 16);
    const beardMaterial = new THREE.MeshPhongMaterial({
      color: 0xaaaaaa, // Gray beard
      specular: 0x555555,
      shininess: 5
    });
    const beard = new THREE.Mesh(beardGeometry, beardMaterial);
    beard.position.set(0, bodyHeight - 0.1, 0.2);
    beard.rotation.x = -Math.PI / 4; // Angle the beard forward
    wizardContainer.add(beard);
    
    // Create wizard glowing eyes (for screen color replacement)
    const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x3355ff }); // This will be replaced by player color
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.1, bodyHeight + 0.05, 0.2);
    wizardContainer.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.1, bodyHeight + 0.05, 0.2);
    wizardContainer.add(rightEye);
    
    // Add small indicators for orientation (phone equivalent)
    
    // "Home button" equivalent - small crystal on chest
    const crystalGeometry = new THREE.OctahedronGeometry(0.1, 0);
    const crystalMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
    const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
    crystal.position.set(0, bodyHeight * 0.4, bodyDepth * 0.6);
    wizardContainer.add(crystal);
    
    // Keep invisible orientation axes for technical functionality
    const axisLength = 0.4;
    
    // X axis (red) - points right from the wizard's perspective
    const xAxisGeometry = new THREE.CylinderGeometry(0.02, 0.02, axisLength, 8);
    const xAxisMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.2 });
    const xAxis = new THREE.Mesh(xAxisGeometry, xAxisMaterial);
    xAxis.rotation.z = Math.PI / 2; // Rotate to point along X axis
    xAxis.position.set(axisLength/2, bodyHeight * 0.5, 0);
    wizardContainer.add(xAxis);
    
    // Y axis (green) - points up from the wizard's perspective
    const yAxisGeometry = new THREE.CylinderGeometry(0.02, 0.02, axisLength, 8);
    const yAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.2 });
    const yAxis = new THREE.Mesh(yAxisGeometry, yAxisMaterial);
    yAxis.position.set(0, bodyHeight * 0.5 + axisLength/2, 0);
    wizardContainer.add(yAxis);
    
    // Z axis (blue) - points out from the wizard's front
    const zAxisGeometry = new THREE.CylinderGeometry(0.02, 0.02, axisLength, 8);
    const zAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff, transparent: true, opacity: 0.2 });
    const zAxis = new THREE.Mesh(zAxisGeometry, zAxisMaterial);
    zAxis.rotation.x = Math.PI / 2; // Rotate to point along Z axis
    zAxis.position.set(0, bodyHeight * 0.5, axisLength/2);
    wizardContainer.add(zAxis);
    
    console.log('Wizard model created successfully');
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
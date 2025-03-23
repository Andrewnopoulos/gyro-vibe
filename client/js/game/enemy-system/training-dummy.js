import * as THREE from 'three';
import { Enemy } from './enemy.js';

/**
 * A training dummy enemy for practice
 */
export class TrainingDummy extends Enemy {
  /**
   * @param {Object} options - Enemy creation options
   */
  constructor(options) {
    // Call parent constructor with the training dummy type
    super({
      ...options,
      type: 'training_dummy'
    });
  }
  
  /**
   * Create the 3D model for the training dummy
   * @override
   */
  createModel() {
    // Create a group to hold all parts of the dummy
    this.model = new THREE.Group();
    this.model.position.set(
      this.position.x,
      this.position.y,
      this.position.z
    );
    this.model.userData.enemyId = this.id;
    
    // Create the dummy parts
    this.createDummyBase();
    this.createDummyBody();
    this.createDummyHead();
    
    // Add to scene
    this.scene.add(this.model);
  }
  
  /**
   * Create the base of the training dummy
   */
  createDummyBase() {
    // Create a circular base
    const baseGeometry = new THREE.CylinderGeometry(0.6, 0.8, 0.2, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x553311, // Brown wooden base
      roughness: 0.8,
      metalness: 0.1
    });
    
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.y = -0.9; // Position at the bottom
    base.castShadow = true;
    base.receiveShadow = true;
    
    this.model.add(base);
  }
  
  /**
   * Create the body of the training dummy
   */
  createDummyBody() {
    // Create a cylindrical body
    const bodyGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 12);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0xccaa88, // Straw/fabric color
      roughness: 0.9,
      metalness: 0.0
    });
    
    this.bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.bodyMesh.castShadow = true;
    this.bodyMesh.receiveShadow = true;
    
    this.model.add(this.bodyMesh);
    
    // Add a pattern to the body
    this.addTargetPattern();
    
    // Add some rope bindings to the body
    this.addRopeBindings();
  }
  
  /**
   * Add target pattern to the dummy body
   */
  addTargetPattern() {
    // Create a red target ring
    const ringGeometry = new THREE.TorusGeometry(0.3, 0.05, 8, 24);
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0xcc3333,
      roughness: 0.7
    });
    
    const targetRing = new THREE.Mesh(ringGeometry, ringMaterial);
    targetRing.position.z = 0.51; // Place it on the front
    targetRing.rotation.x = Math.PI / 2; // Orient horizontally
    
    this.bodyMesh.add(targetRing);
  }
  
  /**
   * Add rope bindings to the dummy
   */
  addRopeBindings() {
    const ropeGeometry = new THREE.TorusGeometry(0.52, 0.04, 8, 16);
    const ropeMaterial = new THREE.MeshStandardMaterial({
      color: 0x663300,
      roughness: 0.9
    });
    
    // Top rope
    const topRope = new THREE.Mesh(ropeGeometry, ropeMaterial);
    topRope.position.y = 0.7;
    topRope.rotation.x = Math.PI / 2;
    this.bodyMesh.add(topRope);
    
    // Bottom rope
    const bottomRope = new THREE.Mesh(ropeGeometry, ropeMaterial);
    bottomRope.position.y = -0.7;
    bottomRope.rotation.x = Math.PI / 2;
    this.bodyMesh.add(bottomRope);
  }
  
  /**
   * Create the head of the training dummy
   */
  createDummyHead() {
    // Create a simple sphere for the head
    const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xddbb99, // Lighter straw color
      roughness: 0.9,
      metalness: 0.0
    });
    
    this.headMesh = new THREE.Mesh(headGeometry, headMaterial);
    this.headMesh.position.y = 1.2; // Place on top of body
    this.headMesh.castShadow = true;
    
    this.model.add(this.headMesh);
    
    // Add face details
    this.addFaceDetails();
  }
  
  /**
   * Add simple face details
   */
  addFaceDetails() {
    // Create a merged geometry for the face details
    const faceGroup = new THREE.Group();
    
    // Create eyes (simple black spheres)
    const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
    
    // Left eye
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(0.1, 0.05, 0.25);
    faceGroup.add(leftEye);
    
    // Right eye
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(-0.1, 0.05, 0.25);
    faceGroup.add(rightEye);
    
    // Add face details to the head
    this.headMesh.add(faceGroup);
  }
  
  /**
   * Update death animation - override for custom animation
   * @param {number} delta - Time since last update
   */
  updateDeathAnimation(delta) {
    if (!this.model) return;
    
    const elapsedTime = (Date.now() - this.deathAnimationStartTime) / 1000;
    const animationDuration = 2.0; // seconds
    const progress = Math.min(elapsedTime / animationDuration, 1.0);
    
    // Custom animation for training dummy - topple over
    // Rotate the entire model to fall forward
    this.model.rotation.x = progress * Math.PI / 2;
    
    // Move down as it falls
    this.model.position.y = this.position.y - progress * 0.5;
    
    // Slight sideways tilt
    this.model.rotation.z = progress * (Math.random() > 0.5 ? 0.2 : -0.2);
    
    // Fade out near the end
    if (progress > 0.7) {
      // Make all materials transparent
      this.model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material) {
          child.material.transparent = true;
          child.material.opacity = 1.0 - ((progress - 0.7) / 0.3);
        }
      });
    }
  }
}
import * as THREE from 'three';

/**
 * Creates and manages a weapon model for remote players
 */
export class RemoteWeapon {
  /**
   * @param {THREE.Object3D} parentObject - The parent object to attach the weapon to
   */
  constructor(parentObject) {
    this.parentObject = parentObject;
    this.weapon = null;
    this.createWeaponModel();
  }
  
  /**
   * Create the wizard staff weapon model
   */
  createWeaponModel() {
    // Create weapon group
    this.weapon = new THREE.Group();
    
    // Create staff shaft using a cylinder
    const shaftGeometry = new THREE.CylinderGeometry(0.03, 0.025, 0.9, 8, 6, true);
    // Apply bending and gnarled effect to vertices
    const vertices = shaftGeometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i);
      const y = vertices.getY(i);
      const z = vertices.getZ(i);
      
      // Apply some random displacement for a gnarled look
      const noise = Math.sin(y * 10) * 0.01;
      const curve = Math.sin(y * 0.5) * 0.04;
      
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
    // Rotate to proper orientation
    staffShaft.rotation.x = Math.PI / 2;
    this.weapon.add(staffShaft);
  
    // Create knots/bumps along the staff
    for (let i = 0; i < 4; i++) {
      const knotPosition = -0.4 + i * 0.25;
      const knotSize = 0.015 + Math.random() * 0.015;
      const knotGeometry = new THREE.SphereGeometry(knotSize, 6, 6);
      const knotMesh = new THREE.Mesh(knotGeometry, woodMaterial);
      knotMesh.position.set(
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.05,
        knotPosition
      );
      staffShaft.add(knotMesh);
    }
    
    // Create crystal/orb at the top
    const orbGeometry = new THREE.SphereGeometry(0.06, 12, 12);
    const orbMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x6fd5ff,
      specular: 0xffffff,
      shininess: 90,
      transparent: true,
      opacity: 0.8
    });
    const orb = new THREE.Mesh(orbGeometry, orbMaterial);
    orb.position.z = 0.45;
    this.weapon.add(orb);
    
    // Add "roots" at the bottom of the staff
    const addRoot = (angle, length, thickness) => {
      const rootGeometry = new THREE.CylinderGeometry(thickness * 0.5, thickness, length, 5, 1);
      const root = new THREE.Mesh(rootGeometry, woodMaterial);
      root.position.z = -0.45;
      root.rotation.x = Math.PI / 2 - 0.3;
      root.rotation.y = angle;
      this.weapon.add(root);
    };
    
    for (let i = 0; i < 3; i++) {
      addRoot(i * Math.PI * 2/3, 0.08 + Math.random() * 0.03, 0.015);
    }
    
    // Position relative to wizard
    this.weapon.rotation.y = -Math.PI / 2; // Rotate to align with wizard's forward direction (reversed since we flipped the wizard)
    this.weapon.position.set(-0.15, 0.7, -0.4); // Position staff near the wizard's hand
    
    // Add to parent object
    this.parentObject.add(this.weapon);
  }
  
  /**
   * Get the weapon object
   * @returns {THREE.Group} The weapon group
   */
  getModel() {
    return this.weapon;
  }
  
  /**
   * Update wizard staff orientation based on wizard orientation
   * @param {THREE.Quaternion} quaternion - The quaternion representing wizard orientation
   */
  updateOrientation(quaternion) {
    if (this.weapon) {
      // We need a relative rotation between the wizard's pose and the staff
      // First, set staff to a base orientation that looks sensible when wizard is in neutral position
      // For a wizard staff, we want it slightly angled and more upright than a gun
      const weaponBaseOrientation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(Math.PI/2, 0, Math.PI/2, 'XYZ')
      );
      
      // Apply a slight offset to make the staff look like it's being held
      // Adjusted for a more "wizardly" staff holding pose
      const positionOffset = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0.3, -0.1, 0.1, 'XYZ')
      );
      
      // When the wizard rotates, we want the staff to rotate in a slightly exaggerated way
      // This makes wizard movements more dramatic
      const wizardOrientation = quaternion.clone();
      
      // Apply all rotations in the correct order
      this.weapon.quaternion.copy(weaponBaseOrientation);  // Start with base orientation
      this.weapon.quaternion.multiply(positionOffset);     // Add holding offset
      this.weapon.quaternion.multiply(wizardOrientation);  // Apply wizard rotation
      
      // Rescale the staff to appear appropriate when held
      // Making the staff slightly longer than the original
      this.weapon.scale.set(0.7, 0.7, 0.7);
    }
  }
  
  /**
   * Update weapon position or visibility based on view mode
   * @param {boolean} visible - Visibility state
   */
  setVisible(visible) {
    if (this.weapon) {
      this.weapon.visible = visible;
    }
  }
  
  /**
   * Dispose of the weapon model
   */
  dispose() {
    if (this.weapon && this.parentObject) {
      this.parentObject.remove(this.weapon);
      
      this.weapon.traverse((object) => {
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
      
      this.weapon = null;
    }
  }
}
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
   * Create the weapon model
   */
  createWeaponModel() {
    // Create weapon group
    this.weapon = new THREE.Group();
    
    // Create gun body - slightly smaller than the first-person view
    const gunBody = new THREE.BoxGeometry(0.08, 0.08, 0.5);
    const gunMaterial = new THREE.MeshPhongMaterial({ 
      color: 0x333333,
      specular: 0x111111,
      shininess: 30
    });
    const gun = new THREE.Mesh(gunBody, gunMaterial);
    
    // Move the gun to be held at one end rather than centered
    gun.position.z = 0.25;
    
    // Create gun barrel
    const barrelGeometry = new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8);
    const barrelMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
    const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
    barrel.rotation.x = Math.PI / 2; // Rotate to align with gun
    barrel.position.z = 0.3; // Position at front of gun
    barrel.position.y = -0.03; // Slightly below center
    
    // Create gun handle
    const handleGeometry = new THREE.BoxGeometry(0.05, 0.15, 0.08);
    const handleMaterial = new THREE.MeshPhongMaterial({ color: 0x444444 });
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.y = -0.1; // Below gun body
    handle.position.z = 0.1; // Slightly forward
    
    // Add parts to weapon group
    this.weapon.add(gun);
    this.weapon.add(barrel);
    this.weapon.add(handle);
    
    // Position relative to phone
    this.weapon.rotation.y = Math.PI / 2; // Rotate to align with phone forward direction
    this.weapon.position.set(0.2, -0.15, 0.6); // Position weapon near the "hand" of the phone model
    
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
   * Update weapon orientation based on phone orientation
   * @param {THREE.Quaternion} quaternion - The quaternion representing phone orientation
   */
  updateOrientation(quaternion) {
    if (this.weapon) {
      // We need a relative rotation between the phone's pose and the weapon
      // First, set weapon to a base orientation that looks sensible when phone is in neutral position
      const weaponBaseOrientation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(Math.PI/2, 0, -Math.PI/2, 'XYZ')
      );
      
      // Apply a slight offset to make the weapon look like it's being held
      const positionOffset = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(0.1, 0.1, 0.0, 'XYZ')
      );
      
      // When the phone rotates, we want the weapon to rotate in a consistent way
      const phoneOrientation = quaternion.clone();
      
      // Apply all rotations in the correct order
      this.weapon.quaternion.copy(weaponBaseOrientation);  // Start with base orientation
      this.weapon.quaternion.multiply(positionOffset);     // Add holding offset
      this.weapon.quaternion.multiply(phoneOrientation);   // Apply phone rotation
      
      // Rescale the weapon to appear appropriate when held
      this.weapon.scale.set(0.6, 0.6, 0.6);
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
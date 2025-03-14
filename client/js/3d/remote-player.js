import * as THREE from 'three';
import { PhoneModel } from './phone-model.js';
import { RemoteWeapon } from './remote-weapon.js';

/**
 * Predefined colors for different players
 */
const PLAYER_COLORS = [
  0x3355ff, // Blue (default)
  0xff5533, // Red
  0x33ff55, // Green
  0xffff33, // Yellow
  0xff33ff, // Magenta
  0x33ffff, // Cyan
  0xff9933, // Orange
  0x9933ff  // Purple
];

/**
 * Visualizes a remote player in the 3D scene
 */
export class RemotePlayer {
  /**
   * @param {THREE.Scene} scene - 3D scene
   * @param {string} playerId - Player's unique ID
   * @param {Object} playerData - Initial player data
   * @param {number} playerIndex - Index of this player (for color assignment)
   */
  constructor(scene, playerId, playerData, playerIndex = 0) {
    this.scene = scene;
    this.playerId = playerId;
    this.phoneModel = new PhoneModel(scene);
    this.playerData = playerData;
    
    // For smooth animation
    this.targetPosition = new THREE.Vector3();
    this.targetRotation = new THREE.Quaternion();
    this.currentPosition = new THREE.Vector3();
    this.currentRotation = new THREE.Quaternion();
    
    // For phone orientation
    this.targetPhoneOrientation = new THREE.Quaternion();
    this.currentPhoneOrientation = new THREE.Quaternion();
    
    // Set player color based on index
    this.colorIndex = playerIndex % PLAYER_COLORS.length;
    this.playerColor = PLAYER_COLORS[this.colorIndex];
    this.setPlayerColor(this.playerColor);
    
    // Create weapon model
    this.weapon = new RemoteWeapon(this.phoneModel.getModel());
    
    // If no position defined, set a default offset position based on index
    if (!playerData.position || (
        playerData.position.x === 0 && 
        playerData.position.y === 0 && 
        playerData.position.z === 0)) {
      const angle = (playerIndex * Math.PI / 4) + Math.PI; // Distribute players in a circle
      const radius = 3; // Distance from center
      
      playerData.position = {
        x: Math.cos(angle) * radius,
        y: 0,
        z: Math.sin(angle) * radius
      };
    }
    
    // Set initial position and rotation
    this.updateFromData(playerData);
    
    // Add username label above the player
    this.createUsernameLabel(playerData.username);
  }
  
  /**
   * Set player's color
   * @param {number} color - Hex color value
   */
  setPlayerColor(color) {
    if (this.phoneModel) {
      // Access the model's children to find the glowing eye meshes
      const model = this.phoneModel.getModel();
      if (model) {
        // Find all meshes with the default eye color (blue by default)
        model.traverse((object) => {
          if (object instanceof THREE.Mesh && object.material) {
            // Apply color to glowing eyes (which are blue by default)
            if (object.material.color && object.material.color.getHex() === 0x3355ff) {
              object.material.color.setHex(color);
            }
            
            // Also modify the hat band and belt to match player color
            if (object.material.color && object.material.color.getHex() === 0xffeb3b) {
              // Darken the color slightly for better visibility
              const darkColor = new THREE.Color(color).multiplyScalar(0.8);
              object.material.color.set(darkColor);
            }
          }
        });
      }
    }
  }
  
  /**
   * Create a text label displaying the player's username
   * @param {string} username - Player's username
   */
  createUsernameLabel(username) {
    // Create canvas for text
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    // Fill with transparent background
    context.fillStyle = 'rgba(0, 0, 0, 0.5)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Border using player color
    context.strokeStyle = '#' + this.playerColor.toString(16).padStart(6, '0');
    context.lineWidth = 3;
    context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
    
    // Draw text
    context.font = '24px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(username, canvas.width / 2, canvas.height / 2);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    
    // Create sprite material
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });
    
    // Create sprite
    this.nameSprite = new THREE.Sprite(material);
    this.nameSprite.scale.set(2, 0.5, 1);
    
    // Position above the wizard's hat
    this.nameSprite.position.y = 2.3;
    
    // Add to the wizard model
    this.phoneModel.getModel().add(this.nameSprite);
  }
  
  /**
   * Update player data from network
   * @param {Object} data - Player state data
   */
  updateFromData(data) {
    this.playerData = data;
    
    if (data.position) {
      this.targetPosition.set(
        data.position.x,
        data.position.y,
        data.position.z
      );
      
      // Initialize current position if not set yet
      if (this.currentPosition.lengthSq() === 0) {
        this.currentPosition.copy(this.targetPosition);
        this.phoneModel.setPosition(
          this.currentPosition.x,
          this.currentPosition.y,
          this.currentPosition.z
        );
      }
    }
    
    if (data.rotation) {
      this.targetRotation.set(
        data.rotation.x,
        data.rotation.y,
        data.rotation.z,
        data.rotation.w
      );
      
      // Initialize current rotation if not set yet
      if (this.currentRotation.lengthSq() === 0) {
        this.currentRotation.copy(this.targetRotation);
        this.phoneModel.setQuaternion(this.currentRotation);
      }
    }
    
    // Handle phone orientation for weapon positioning
    if (data.phoneOrientation) {
      this.targetPhoneOrientation.set(
        data.phoneOrientation.x,
        data.phoneOrientation.y,
        data.phoneOrientation.z,
        data.phoneOrientation.w
      );
      
      // Initialize current phone orientation if not set yet
      if (this.currentPhoneOrientation.lengthSq() === 0) {
        this.currentPhoneOrientation.copy(this.targetPhoneOrientation);
      }
    }
    
    // Calculate forward direction (for making player face the right way in first-person)
    if (data.rotation) {
      const forward = new THREE.Vector3(0, 0, -1);
      const quaternion = new THREE.Quaternion(
        data.rotation.x,
        data.rotation.y,
        data.rotation.z,
        data.rotation.w
      );
      
      forward.applyQuaternion(quaternion);
      this.forward = forward;
    }
  }
  
  /**
   * Update player interpolation
   * @param {number} delta - Time in seconds since last update
   */
  update(delta) {
    // Smoothly interpolate position
    this.currentPosition.lerp(this.targetPosition, Math.min(delta * 10, 1));
    this.phoneModel.setPosition(
      this.currentPosition.x,
      this.currentPosition.y,
      this.currentPosition.z
    );
    
    // Smoothly interpolate rotation
    this.currentRotation.slerp(this.targetRotation, Math.min(delta * 10, 1));
    this.phoneModel.setQuaternion(this.currentRotation);
    
    // Smoothly interpolate phone orientation (for weapon)
    if (this.targetPhoneOrientation.lengthSq() > 0) {
      this.currentPhoneOrientation.slerp(this.targetPhoneOrientation, Math.min(delta * 10, 1));
      
      // Update the weapon based on phone orientation
      if (this.weapon && this.weapon.getModel()) {
        // Apply the updated phone orientation to the weapon
        this.weapon.updateOrientation(this.currentPhoneOrientation);
      }
    }
    
    // Always make the username label face the camera
    if (this.nameSprite) {
      const camera = this.scene.getObjectByProperty('type', 'PerspectiveCamera');
      if (camera) {
        // Make the nameSprite always face the camera
        const cameraPos = camera.position.clone();
        const playerPos = this.phoneModel.getModel().position.clone();
        const dirToCamera = cameraPos.sub(playerPos).normalize();
        
        // Calculate the angle to rotate the sprite
        const matrix = new THREE.Matrix4();
        matrix.lookAt(dirToCamera, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 1, 0));
        const quaternion = new THREE.Quaternion();
        quaternion.setFromRotationMatrix(matrix);
        
        // Apply rotation to make the sprite face the camera
        this.nameSprite.quaternion.copy(quaternion);
      }
    }
  }
  
  /**
   * Get player model
   * @returns {THREE.Object3D} The player's 3D model
   */
  getModel() {
    return this.phoneModel.getModel();
  }
  
  /**
   * Get player's position
   * @returns {THREE.Vector3} Current position
   */
  getPosition() {
    return this.currentPosition.clone();
  }
  
  /**
   * Get player's forward direction
   * @returns {THREE.Vector3} Forward direction
   */
  getForwardDirection() {
    return this.forward ? this.forward.clone() : new THREE.Vector3(0, 0, -1);
  }
  
  /**
   * Destroy and clean up
   */
  dispose() {
    // Dispose of weapon first
    if (this.weapon) {
      this.weapon.dispose();
      this.weapon = null;
    }
    
    // Dispose of phone model
    this.phoneModel.dispose();
    
    // Clean up name sprite
    if (this.nameSprite) {
      // Remove sprite
      this.phoneModel.getModel().remove(this.nameSprite);
      
      // Dispose of texture
      if (this.nameSprite.material.map) {
        this.nameSprite.material.map.dispose();
      }
      
      // Dispose of material
      if (this.nameSprite.material) {
        this.nameSprite.material.dispose();
      }
    }
  }
}
import * as THREE from 'three';
import { PhoneModel } from './phone-model.js';

/**
 * Visualizes a remote player in the 3D scene
 */
export class RemotePlayer {
  /**
   * @param {THREE.Scene} scene - 3D scene
   * @param {string} playerId - Player's unique ID
   * @param {Object} playerData - Initial player data
   */
  constructor(scene, playerId, playerData) {
    this.scene = scene;
    this.playerId = playerId;
    this.phoneModel = new PhoneModel(scene);
    this.playerData = playerData;
    
    // For smooth animation
    this.targetPosition = new THREE.Vector3();
    this.targetRotation = new THREE.Quaternion();
    this.currentPosition = new THREE.Vector3();
    this.currentRotation = new THREE.Quaternion();
    
    // Set initial position and rotation
    this.updateFromData(playerData);
    
    // Add username label above the player
    this.createUsernameLabel(playerData.username);
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
    
    // Position above the phone model
    this.nameSprite.position.y = 1.5;
    
    // Add to the phone model
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
  }
  
  /**
   * Get player model
   * @returns {THREE.Object3D} The player's 3D model
   */
  getModel() {
    return this.phoneModel.getModel();
  }
  
  /**
   * Destroy and clean up
   */
  dispose() {
    this.phoneModel.dispose();
    
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
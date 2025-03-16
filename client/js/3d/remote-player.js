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
    this.playerData = playerData;
    
    // Check if this is a mobile player
    this.isMobilePlayer = playerData.isMobilePlayer || false;
    
    // For mobile players, create an airplane model instead of a phone
    if (this.isMobilePlayer) {
      this.createAirplaneModel(scene);
    } else {
      // For desktop players, use the regular phone model
      this.phoneModel = new PhoneModel(scene);
    }
    
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
      // Access the model's children to find the screen mesh
      const model = this.phoneModel.getModel();
      if (model) {
        // Find the screen mesh (second child of the phone model)
        model.traverse((object) => {
          if (object instanceof THREE.Mesh && object.material) {
            // Apply color to screen (which is blue by default)
            if (object.material.color && object.material.color.getHex() === 0x3355ff) {
              object.material.color.setHex(color);
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
    
    // Position above the phone model
    this.nameSprite.position.y = 1.5;
    
    // Add to the appropriate model
    if (this.isMobilePlayer) {
      if (this.airplaneModel) {
        this.airplaneModel.add(this.nameSprite);
        // Position higher for airplanes 
        this.nameSprite.position.y = 2.5;
      }
    } else {
      this.phoneModel.getModel().add(this.nameSprite);
    }
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
        if (this.isMobilePlayer) {
          if (this.airplaneModel) {
            this.airplaneModel.position.copy(this.currentPosition);
          }
        } else {
          this.phoneModel.setPosition(
            this.currentPosition.x,
            this.currentPosition.y,
            this.currentPosition.z
          );
        }
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
        if (this.isMobilePlayer) {
          if (this.airplaneModel) {
            this.airplaneModel.quaternion.copy(this.currentRotation);
          }
        } else {
          this.phoneModel.setQuaternion(this.currentRotation);
        }
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
    
    // Apply position to the appropriate model
    if (this.isMobilePlayer) {
      if (this.airplaneModel) {
        this.airplaneModel.position.copy(this.currentPosition);
      }
    } else {
      this.phoneModel.setPosition(
        this.currentPosition.x,
        this.currentPosition.y,
        this.currentPosition.z
      );
    }
    
    // Smoothly interpolate rotation
    this.currentRotation.slerp(this.targetRotation, Math.min(delta * 10, 1));
    
    // Apply rotation to the appropriate model
    if (this.isMobilePlayer) {
      if (this.airplaneModel) {
        this.airplaneModel.quaternion.copy(this.currentRotation);
        
        // Add banking effect for mobile players during turns
        // Calculate the difference in rotation from the last frame to determine turning
        if (this.lastRotation) {
          const rotationDelta = this.currentRotation.angleTo(this.lastRotation);
          const rotationSign = Math.sign(
            this.currentRotation.y * this.lastRotation.z - 
            this.currentRotation.z * this.lastRotation.y
          );
          
          // Apply banking based on rotation change
          if (Math.abs(rotationDelta) > 0.001) {
            this.airplaneModel.rotation.z = -rotationSign * Math.min(rotationDelta * 2, 0.3);
          } else {
            // Return to level flight
            this.airplaneModel.rotation.z *= 0.95;
          }
        }
        
        // Store current rotation for next frame comparison
        this.lastRotation = this.currentRotation.clone();
      }
    } else {
      this.phoneModel.setQuaternion(this.currentRotation);
    }
    
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
   * Create an airplane model for mobile players
   * @param {THREE.Scene} scene - 3D scene
   */
  createAirplaneModel(scene) {
    // Create a simple geometric airplane-like shape
    const bodyGeometry = new THREE.BoxGeometry(0.8, 0.3, 2);
    const wingGeometry = new THREE.BoxGeometry(3, 0.1, 0.5);
    const tailGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.1);
    
    // Use player color for the body
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: this.playerColor,
      roughness: 0.4,
      metalness: 0.6
    });
    
    // Use a slightly different color for wings and tail
    const wingMaterial = new THREE.MeshStandardMaterial({ 
      color: this.playerColor,
      roughness: 0.6,
      metalness: 0.3
    });
    
    // Create meshes
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    const wingMesh = new THREE.Mesh(wingGeometry, wingMaterial);
    const tailMesh = new THREE.Mesh(tailGeometry, wingMaterial);
    
    // Position wing and tail
    wingMesh.position.set(0, 0, 0);
    tailMesh.position.set(0, 0.3, -0.9);
    
    // Create a group to hold all parts
    const model = new THREE.Group();
    model.add(bodyMesh);
    model.add(wingMesh);
    model.add(tailMesh);
    
    // Add to scene
    scene.add(model);
    
    // Store the model reference
    this.airplaneModel = model;
  }
  
  /**
   * Get player model
   * @returns {THREE.Object3D} The player's 3D model
   */
  getModel() {
    if (this.isMobilePlayer) {
      return this.airplaneModel;
    } else {
      return this.phoneModel.getModel();
    }
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
    
    if (this.isMobilePlayer) {
      // Clean up airplane model
      if (this.airplaneModel) {
        // Remove from scene
        this.scene.remove(this.airplaneModel);
        
        // Dispose of geometries and materials
        this.airplaneModel.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.geometry) {
              child.geometry.dispose();
            }
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(material => material.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
      }
    } else {
      // Dispose of phone model
      this.phoneModel.dispose();
    }
    
    // Clean up name sprite
    if (this.nameSprite) {
      // Remove sprite from its parent
      if (this.nameSprite.parent) {
        this.nameSprite.parent.remove(this.nameSprite);
      }
      
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
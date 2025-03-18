import * as THREE from 'three';
import { PhoneModel } from './phone-model.js';

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
    
    // For mobile players, create an airplane model instead of a person
    if (this.isMobilePlayer) {
      this.createAirplaneModel(scene);
    } else {
      // For desktop players, use a simple person-like model
      this.createPersonModel(scene);
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
    
    // No weapon model for simplified gameplay
    
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
   * Create a simple person-like model for desktop players
   * @param {THREE.Scene} scene - 3D scene
   */
  createPersonModel(scene) {
    // Create a simple person-like object
    const bodyGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
    const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: this.playerColor,
      roughness: 0.7,
      metalness: 0.1
    });
    
    const headMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xFFCC88,
      roughness: 0.7,
      metalness: 0.1
    });
    
    // Create meshes
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    const headMesh = new THREE.Mesh(headGeometry, headMaterial);
    
    // Position head
    headMesh.position.set(0, 1, 0);
    
    // Create a group to hold body parts
    const model = new THREE.Group();
    model.add(bodyMesh);
    model.add(headMesh);
    
    // Add to scene
    scene.add(model);
    
    // Store model reference
    this.personModel = model;
  }
  
  /**
   * Set player's color
   * @param {number} color - Hex color value
   */
  setPlayerColor(color) {
    if (this.isMobilePlayer) {
      if (this.airplaneModel) {
        // Find colored parts in airplane model
        this.airplaneModel.traverse((object) => {
          if (object instanceof THREE.Mesh && object.material) {
            // Apply color to body parts (which are blue by default)
            if (object.material.color && object.material.color.getHex() === 0x3355ff) {
              object.material.color.setHex(color);
            }
          }
        });
      }
    } else if (this.personModel) {
      // Apply color to body
      this.personModel.traverse((object) => {
        if (object instanceof THREE.Mesh && object.material) {
          // Apply color to body (but not the head which is skin-colored)
          if (object.material.color && object.material.color.getHex() !== 0xFFCC88) {
            object.material.color.setHex(color);
          }
        }
      });
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
    
    // Position above the model
    this.nameSprite.position.y = 1.5;
    
    // Add to the appropriate model
    if (this.isMobilePlayer) {
      if (this.airplaneModel) {
        this.airplaneModel.add(this.nameSprite);
        // Position higher for airplanes 
        this.nameSprite.position.y = 2.5;
      }
    } else if (this.personModel) {
      this.personModel.add(this.nameSprite);
      // Position higher for person model (above head)
      this.nameSprite.position.y = 1.8;
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
        } else if (this.personModel) {
          this.personModel.position.copy(this.currentPosition);
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
        } else if (this.personModel) {
          this.personModel.quaternion.copy(this.currentRotation);
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
    
    // Track last position for velocity calculation
    const lastPosition = this.lastPosition || this.currentPosition.clone();
    
    // Apply position to the appropriate model
    if (this.isMobilePlayer) {
      if (this.airplaneModel) {
        this.airplaneModel.position.copy(this.currentPosition);
      }
    } else if (this.personModel) {
      this.personModel.position.copy(this.currentPosition);
    }
    
    // Smoothly interpolate rotation
    this.currentRotation.slerp(this.targetRotation, Math.min(delta * 10, 1));
    
    // Apply rotation to the appropriate model
    if (this.isMobilePlayer) {
      if (this.airplaneModel) {
        this.airplaneModel.quaternion.copy(this.currentRotation);
        
        // Calculate movement velocity for effects
        const velocity = this.currentPosition.clone().sub(lastPosition).divideScalar(delta);
        const speed = velocity.length();
        
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
        
        // Update particle effects if they exist
        if (this.exhaustParticles && speed > 1.0) {
          this.updateExhaustEffect(delta);
        }
        
        // Add flying effects based on device type
        const deviceType = this.playerData.deviceType || 'mobile';
        switch (deviceType) {
          case 'iphone':
          case 'ipad':
            // Add subtle oscillation for Apple devices
            const time = Date.now() * 0.001;
            const appleOscillation = Math.sin(time * 5) * 0.01;
            this.airplaneModel.rotation.z += appleOscillation;
            break;
            
          case 'android-phone':
          case 'android-tablet':
            // Add more abrupt, digital-looking movements for Android
            if (Math.random() < 0.05) {
              const androidTwitch = (Math.random() - 0.5) * 0.02;
              this.airplaneModel.rotation.x += androidTwitch;
            }
            break;
            
          default:
            // Generic subtle drift for other devices
            if (Math.random() < 0.1) {
              const drift = (Math.random() - 0.5) * 0.01;
              this.airplaneModel.rotation.y += drift;
            }
        }
      }
    } else if (this.personModel) {
      this.personModel.quaternion.copy(this.currentRotation);
    }
    
    // Phone orientation tracking (simplified without weapon)
    if (this.targetPhoneOrientation.lengthSq() > 0) {
      this.currentPhoneOrientation.slerp(this.targetPhoneOrientation, Math.min(delta * 10, 1));
    }
    
    // Always make the username label face the camera
    if (this.nameSprite) {
      const camera = this.scene.getObjectByProperty('type', 'PerspectiveCamera');
      if (camera) {
        // Make the nameSprite always face the camera
        const cameraPos = camera.position.clone();
        const playerPos = this.isMobilePlayer ? 
          this.airplaneModel.position.clone() : 
          this.personModel.position.clone();
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
    
    // Store the current position for next frame's velocity calculation
    this.lastPosition = this.currentPosition.clone();
  }
  
  /**
   * Create an airplane model for mobile players
   * @param {THREE.Scene} scene - 3D scene
   */
  createAirplaneModel(scene) {
    // Create a more detailed airplane model
    const model = new THREE.Group();
    
    // Device type-based model
    const deviceType = this.playerData.deviceType || 'mobile';
    
    // Choose the appropriate model based on device type
    switch (deviceType) {
      case 'iphone':
      case 'ipad':
        this.createAppleDeviceModel(model);
        break;
      case 'android-phone':
      case 'android-tablet':
        this.createAndroidDeviceModel(model);
        break;
      default:
        this.createGenericAirplaneModel(model);
    }
    
    // Add to scene
    scene.add(model);
    
    // Store the model reference
    this.airplaneModel = model;
    
    // Add exhaust particle effect if supported
    this.addExhaustEffect(model);
  }
  
  /**
   * Create a generic airplane model
   * @param {THREE.Group} parentGroup - Parent group to add model parts to
   */
  createGenericAirplaneModel(parentGroup) {
    // Create a more detailed airplane shape with curved surfaces
    const bodyGeometry = new THREE.CapsuleGeometry(0.4, 1.5, 8, 16);
    bodyGeometry.rotateZ(Math.PI / 2); // Orient capsule along z-axis
    
    const wingGeometry = new THREE.BoxGeometry(3, 0.1, 0.7);
    // Taper the wings by scaling vertices
    const wingPositions = wingGeometry.attributes.position;
    for (let i = 0; i < wingPositions.count; i++) {
      const x = wingPositions.getX(i);
      const z = wingPositions.getZ(i);
      // Scale width based on distance from center
      const scaleFactor = 1 - Math.abs(x) / 2;
      wingPositions.setZ(i, z * scaleFactor);
    }
    
    const tailFinGeometry = new THREE.CylinderGeometry(0, 0.4, 0.8, 4);
    tailFinGeometry.rotateX(Math.PI / 2);
    
    // Use player color for materials with environment mapping for shine
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: this.playerColor,
      roughness: 0.2,
      metalness: 0.8,
      envMapIntensity: 1
    });
    
    // Create wing material with slightly different properties
    const wingMaterial = new THREE.MeshStandardMaterial({ 
      color: this.playerColor,
      roughness: 0.3,
      metalness: 0.6
    });
    
    // Create meshes
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    const wingMesh = new THREE.Mesh(wingGeometry, wingMaterial);
    const tailFinMesh = new THREE.Mesh(tailFinGeometry, wingMaterial);
    
    // Position parts
    bodyMesh.position.set(0, 0, 0);
    wingMesh.position.set(0, 0, -0.2);
    tailFinMesh.position.set(0, 0.3, -0.9);
    
    // Add cockpit (slightly transparent dome)
    const cockpitGeometry = new THREE.SphereGeometry(0.3, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const cockpitMaterial = new THREE.MeshStandardMaterial({
      color: 0x88CCFF,
      transparent: true,
      opacity: 0.7,
      roughness: 0.1,
      metalness: 0.2
    });
    const cockpit = new THREE.Mesh(cockpitGeometry, cockpitMaterial);
    cockpit.position.set(0, 0.2, 0.3);
    cockpit.rotation.x = Math.PI;
    
    // Add all parts to the group
    parentGroup.add(bodyMesh);
    parentGroup.add(wingMesh);
    parentGroup.add(tailFinMesh);
    parentGroup.add(cockpit);
    
    // Add small details (engines, etc)
    this.addEngineDetails(parentGroup);
  }
  
  /**
   * Create an Apple device styled model
   * @param {THREE.Group} parentGroup - Parent group to add model parts to
   */
  createAppleDeviceModel(parentGroup) {
    // Create a sleek, Apple-inspired design
    const bodyGeometry = new THREE.CapsuleGeometry(0.4, 1.8, 8, 16);
    bodyGeometry.rotateZ(Math.PI / 2);
    
    // Create sleek swept-back wings
    const wingGeometry = new THREE.BoxGeometry(2.5, 0.08, 0.7);
    // Modify wing vertices for sleeker shape
    const wingPositions = wingGeometry.attributes.position;
    for (let i = 0; i < wingPositions.count; i++) {
      const x = wingPositions.getX(i);
      const z = wingPositions.getZ(i);
      // Create swept-back effect
      if (z > 0) {
        wingPositions.setZ(i, z - Math.abs(x) * 0.2);
      }
    }
    
    // Create silver-white color scheme with subtle blue accent
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xEEEEEE,
      roughness: 0.1,
      metalness: 0.9
    });
    
    const accentMaterial = new THREE.MeshStandardMaterial({ 
      color: this.playerColor,
      roughness: 0.2,
      metalness: 0.7
    });
    
    // Create meshes
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    const wingMesh = new THREE.Mesh(wingGeometry, bodyMaterial);
    
    // Add accent strip down the body
    const accentGeometry = new THREE.BoxGeometry(0.05, 0.05, 2);
    const accentStrip = new THREE.Mesh(accentGeometry, accentMaterial);
    accentStrip.position.set(0, 0.4, 0);
    
    // Add canopy
    const canopyGeometry = new THREE.CapsuleGeometry(0.2, 0.8, 8, 8);
    canopyGeometry.rotateZ(Math.PI / 2);
    const canopyMaterial = new THREE.MeshStandardMaterial({
      color: 0x88AACC,
      transparent: true,
      opacity: 0.8,
      roughness: 0.1
    });
    const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
    canopy.scale.set(1, 0.5, 1);
    canopy.position.set(0, 0.2, 0.2);
    
    // Position parts
    bodyMesh.position.set(0, 0, 0);
    wingMesh.position.set(0, -0.1, -0.2);
    
    // Add all parts to the group
    parentGroup.add(bodyMesh);
    parentGroup.add(wingMesh);
    parentGroup.add(accentStrip);
    parentGroup.add(canopy);
    
    // Add small details
    const tailGeometry = new THREE.BoxGeometry(0.6, 0.3, 0.08);
    const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
    tail.position.set(0, 0.2, -0.9);
    parentGroup.add(tail);
  }
  
  /**
   * Create an Android device styled model
   * @param {THREE.Group} parentGroup - Parent group to add model parts to
   */
  createAndroidDeviceModel(parentGroup) {
    // Create a more angular, Android-inspired design
    const bodyGeometry = new THREE.BoxGeometry(0.8, 0.4, 2);
    
    // Create angular wings
    const wingGeometry = new THREE.BoxGeometry(2.8, 0.1, 0.8);
    
    // Use green color scheme for Android
    const androidGreen = 0x3DDC84; // Official Android green
    const bodyColor = this.playerColor === 0x33ff55 ? 0x222222 : this.playerColor; // Use black if player color is already green
    
    const bodyMaterial = new THREE.MeshStandardMaterial({ 
      color: bodyColor,
      roughness: 0.4,
      metalness: 0.5
    });
    
    const accentMaterial = new THREE.MeshStandardMaterial({ 
      color: androidGreen,
      roughness: 0.3,
      metalness: 0.4
    });
    
    // Create meshes
    const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
    const wingMesh = new THREE.Mesh(wingGeometry, bodyMaterial);
    
    // Add accent elements
    const accentGeometry = new THREE.BoxGeometry(0.1, 0.1, 1.5);
    const accentStrip = new THREE.Mesh(accentGeometry, accentMaterial);
    accentStrip.position.set(0, 0.25, 0);
    
    // Add angular canopy
    const canopyGeometry = new THREE.BoxGeometry(0.6, 0.2, 0.8);
    const canopyMaterial = new THREE.MeshStandardMaterial({
      color: 0x88CCAA,
      transparent: true,
      opacity: 0.7,
      roughness: 0.2
    });
    const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
    canopy.position.set(0, 0.3, 0.2);
    
    // Position parts
    bodyMesh.position.set(0, 0, 0);
    wingMesh.position.set(0, 0, -0.1);
    
    // Add angular vertical stabilizer
    const tailGeometry = new THREE.BoxGeometry(0.1, 0.7, 0.4);
    const tail = new THREE.Mesh(tailGeometry, accentMaterial);
    tail.position.set(0, 0.35, -0.8);
    
    // Add all parts to the group
    parentGroup.add(bodyMesh);
    parentGroup.add(wingMesh);
    parentGroup.add(accentStrip);
    parentGroup.add(canopy);
    parentGroup.add(tail);
    
    // Add engine details
    this.addEngineDetails(parentGroup, androidGreen);
  }
  
  /**
   * Add engine details to the model
   * @param {THREE.Group} parentGroup - Parent group to add details to
   * @param {number} accentColor - Optional accent color for engine parts
   */
  addEngineDetails(parentGroup, accentColor) {
    // Create engine geometry
    const engineGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.5, 8);
    engineGeometry.rotateZ(Math.PI / 2);
    
    // Create engine material
    const engineMaterial = new THREE.MeshStandardMaterial({ 
      color: accentColor || 0x444444,
      roughness: 0.6,
      metalness: 0.7
    });
    
    // Create engine meshes
    const leftEngine = new THREE.Mesh(engineGeometry, engineMaterial);
    const rightEngine = new THREE.Mesh(engineGeometry, engineMaterial);
    
    // Position engines under wings
    leftEngine.position.set(-1, -0.2, -0.1);
    rightEngine.position.set(1, -0.2, -0.1);
    
    // Add engines to parent group
    parentGroup.add(leftEngine);
    parentGroup.add(rightEngine);
  }
  
  /**
   * Add exhaust effect to engines
   * @param {THREE.Group} parentGroup - Parent group containing the model
   */
  addExhaustEffect(parentGroup) {
    // Skip effect creation for performance reasons unless specifically enabled
    const enableEffects = false; // This could be a config option
    if (!enableEffects) return;
    
    // Create two particle systems for the engines
    const particleCount = 50;
    const particleGeometry = new THREE.BufferGeometry();
    
    // Create positions array for particles (both engines)
    const positions = new Float32Array(particleCount * 3);
    
    // Initialize particle positions
    for (let i = 0; i < particleCount; i++) {
      // Alternate between left and right engine
      const engineX = i % 2 === 0 ? -1 : 1;
      
      const baseIndex = i * 3;
      positions[baseIndex] = engineX;     // X position (left or right engine)
      positions[baseIndex + 1] = -0.2;    // Y position (below the wings)
      positions[baseIndex + 2] = -0.3;    // Z position (behind engines)
    }
    
    // Set positions attribute
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    // Create particle material
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xFFAA44,
      size: 0.1,
      blending: THREE.AdditiveBlending,
      transparent: true,
      opacity: 0.7
    });
    
    // Create the particle system
    this.exhaustParticles = new THREE.Points(particleGeometry, particleMaterial);
    
    // Add to parent group
    parentGroup.add(this.exhaustParticles);
    
    // Store data for animation
    this.exhaustData = {
      positions: positions,
      velocities: new Float32Array(particleCount * 3),
      lifetimes: new Float32Array(particleCount),
      geometry: particleGeometry
    };
    
    // Initialize velocities and lifetimes
    for (let i = 0; i < particleCount; i++) {
      this.exhaustData.velocities[i * 3 + 2] = -Math.random() * 0.1 - 0.05; // Z velocity (backward)
      this.exhaustData.lifetimes[i] = Math.random();
    }
  }
  
  /**
   * Update exhaust particle effect
   * @param {number} delta - Time delta since last frame
   */
  updateExhaustEffect(delta) {
    if (!this.exhaustParticles || !this.exhaustData) return;
    
    const positions = this.exhaustData.positions;
    const velocities = this.exhaustData.velocities;
    const lifetimes = this.exhaustData.lifetimes;
    
    for (let i = 0; i < lifetimes.length; i++) {
      // Update lifetime
      lifetimes[i] -= delta * 2;
      
      // Reset particles that have "died"
      if (lifetimes[i] <= 0) {
        // Reset position to engine
        const engineX = i % 2 === 0 ? -1 : 1;
        positions[i * 3] = engineX;
        positions[i * 3 + 1] = -0.2;
        positions[i * 3 + 2] = -0.3;
        
        // Reset velocity
        velocities[i * 3 + 2] = -Math.random() * 0.1 - 0.05;
        
        // Reset lifetime
        lifetimes[i] = 1.0;
      } else {
        // Update position based on velocity
        positions[i * 3 + 2] += velocities[i * 3 + 2];
        
        // Add some spread
        positions[i * 3] += (Math.random() - 0.5) * 0.01;
        positions[i * 3 + 1] += (Math.random() - 0.5) * 0.01;
        
        // Update opacity based on lifetime
        this.exhaustParticles.material.opacity = Math.min(1, lifetimes[i] * 2);
      }
    }
    
    // Update the geometry
    this.exhaustData.geometry.attributes.position.needsUpdate = true;
  }
  
  /**
   * Get player model
   * @returns {THREE.Object3D} The player's 3D model
   */
  getModel() {
    if (this.isMobilePlayer) {
      return this.airplaneModel;
    } else {
      return this.personModel;
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
    // No weapon to dispose in simplified gameplay
    
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
        
        // Clean up particle systems if they exist
        if (this.exhaustParticles) {
          if (this.exhaustParticles.parent) {
            this.exhaustParticles.parent.remove(this.exhaustParticles);
          }
          
          if (this.exhaustParticles.material) {
            this.exhaustParticles.material.dispose();
          }
          
          if (this.exhaustData && this.exhaustData.geometry) {
            this.exhaustData.geometry.dispose();
          }
          
          this.exhaustParticles = null;
          this.exhaustData = null;
        }
      }
    } else if (this.personModel) {
      // Dispose of person model
      if (this.scene) {
        this.scene.remove(this.personModel);
      }
      
      // Dispose of geometries and materials
      this.personModel.traverse((child) => {
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
      
      this.personModel = null;
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
    
    // Clear references to help garbage collection
    this.lastPosition = null;
    this.lastRotation = null;
    this.currentPosition = null;
    this.currentRotation = null;
    this.targetPosition = null;
    this.targetRotation = null;
    this.currentPhoneOrientation = null;
    this.targetPhoneOrientation = null;
    this.playerData = null;
    this.forward = null;
    this.nameSprite = null;
  }
}
import { MobilePlayer } from './mobile-player.js';
import { TouchController } from './touch-controller.js';
import * as THREE from 'three';

/**
 * Manages mobile-specific game experience
 */
export class MobileGameManager {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {SocketManager} socketManager - Socket.IO manager
   * @param {GameStateManager} gameStateManager - Game state manager
   */
  constructor(eventBus, socketManager, gameStateManager) {
    this.eventBus = eventBus;
    this.socketManager = socketManager;
    this.gameStateManager = gameStateManager;
    this.mobilePlayer = null;
    this.touchController = null;
    this.scene = null;
    this.renderer = null;
    this.container = null;
    this.isActive = false;
    this.remotePlayers = new Map();
    this.prevTime = performance.now();
    this.animationFrameId = null;
    
    // Setup event listeners
    this.setupEventListeners();
  }
  
  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for room joined event to initialize mobile experience
    this.eventBus.on('multiplayer:room-joined', this.handleRoomJoined.bind(this));
    this.eventBus.on('multiplayer:room-left', this.handleRoomLeft.bind(this));
    this.eventBus.on('multiplayer:player-joined', this.handlePlayerJoined.bind(this));
    this.eventBus.on('multiplayer:player-left', this.handlePlayerLeft.bind(this));
    this.eventBus.on('gameState:updated', this.handleGameStateUpdate.bind(this));
  }
  
  /**
   * Initialize 3D scene for mobile experience
   * @param {HTMLElement} container - Container element for renderer
   */
  initializeScene(container) {
    this.container = container;
    
    // Create scene
    this.scene = new THREE.Scene();
    
    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 3);
    this.scene.add(ambientLight);
    
    // Add directional light (sunlight)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 2);
    directionalLight.position.set(1, 3, 2);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);
    
    // Add ground plane
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x72A672,
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
    ground.position.y = 0;
    ground.receiveShadow = true;
    this.scene.add(ground);
    
    // Create renderer
    this.renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      canvas: container
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x87CEEB); // Sky blue
    this.renderer.shadowMap.enabled = true;
    
    // Initialize mobile player
    this.mobilePlayer = new MobilePlayer(this.scene, this.eventBus);
    
    // Initialize touch controller
    this.touchController = new TouchController(this.eventBus, container);
    this.touchController.enable();
    
    // Handle window resize
    window.addEventListener('resize', this.onWindowResize.bind(this), false);
    
    // Initial resize
    this.onWindowResize();
    
    // Start animation loop
    this.isActive = true;
    this.animate();
    
    console.log('Mobile 3D scene initialized');
  }
  
  /**
   * Handle window resize
   */
  onWindowResize() {
    if (!this.mobilePlayer || !this.renderer || !this.container) return;
    
    const camera = this.mobilePlayer.getCamera();
    if (!camera) return;
    
    camera.aspect = this.container.clientWidth / this.container.clientHeight;
    camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }
  
  /**
   * Animation loop
   */
  animate() {
    if (!this.isActive) return;
    
    this.animationFrameId = requestAnimationFrame(this.animate.bind(this));
    
    const time = performance.now();
    const delta = (time - this.prevTime) / 1000; // Convert to seconds
    
    // Emit update event for components that need delta time
    this.eventBus.emit('scene:update', { 
      delta: delta, 
      time: time 
    });
    
    // Render the scene
    if (this.renderer && this.mobilePlayer) {
      this.renderer.render(this.scene, this.mobilePlayer.getCamera());
    }
    
    this.prevTime = time;
  }
  
  /**
   * Handle room joined event
   * @param {Object} data - Room joined data
   */
  handleRoomJoined(data) {
    console.log('Mobile player joined room', data);
    
    // Initialize scene if not already initialized
    const gameCanvas = document.getElementById('gameCanvas');
    if (gameCanvas && !this.isActive) {
      this.initializeScene(gameCanvas);
    }
  }
  
  /**
   * Handle room left event
   */
  handleRoomLeft() {
    console.log('Mobile player left room');
    
    // Cleanup
    this.cleanup();
  }
  
  /**
   * Handle player joined event
   * @param {Object} data - Player joined data
   */
  handlePlayerJoined(data) {
    console.log('Player joined:', data.player.id);
    
    // Skip if it's the local player
    if (data.player.id === this.gameStateManager.getLocalPlayerId()) return;
    
    // Create remote player representation
    this.createRemotePlayer(data.player);
  }
  
  /**
   * Handle player left event
   * @param {Object} data - Player left data
   */
  handlePlayerLeft(data) {
    console.log('Player left:', data.playerId);
    
    // Remove remote player
    this.removeRemotePlayer(data.playerId);
  }
  
  /**
   * Handle game state update
   * @param {Object} data - Game state data
   */
  handleGameStateUpdate(data) {
    // Update remote players
    if (data.players) {
      data.players.forEach(playerData => {
        if (playerData.id !== this.gameStateManager.getLocalPlayerId()) {
          if (this.remotePlayers.has(playerData.id)) {
            // Update existing remote player
            this.updateRemotePlayer(playerData.id, playerData);
          } else {
            // Create new remote player
            this.createRemotePlayer(playerData);
          }
        }
      });
    }
  }
  
  /**
   * Create a new remote player representation
   * @param {Object} playerData - Player data
   */
  createRemotePlayer(playerData) {
    // Determine if this is a desktop or mobile player
    const isMobilePlayer = playerData.isMobilePlayer;
    
    // Create appropriate model
    let model;
    
    if (isMobilePlayer) {
      // Mobile player - create airplane-like model similar to local player
      const bodyGeometry = new THREE.BoxGeometry(0.8, 0.3, 2);
      const wingGeometry = new THREE.BoxGeometry(3, 0.1, 0.5);
      const tailGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.1);
      
      const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xFF5533, // Different color from local player
        roughness: 0.4,
        metalness: 0.6
      });
      
      const wingMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xFF7766,
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
      model = new THREE.Group();
      model.add(bodyMesh);
      model.add(wingMesh);
      model.add(tailMesh);
      
      // Create username text
      this.createUsernameLabel(model, playerData.username);
    } else {
      // Desktop player - create a simple person-like object
      const bodyGeometry = new THREE.CapsuleGeometry(0.5, 1, 4, 8);
      const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
      
      const bodyMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x33AA55,
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
      model = new THREE.Group();
      model.add(bodyMesh);
      model.add(headMesh);
      
      // Create username text
      this.createUsernameLabel(model, playerData.username);
    }
    
    // Set position and rotation from player data
    if (playerData.position) {
      model.position.set(
        playerData.position.x,
        playerData.position.y,
        playerData.position.z
      );
    }
    
    if (playerData.rotation) {
      const quaternion = new THREE.Quaternion(
        playerData.rotation.x,
        playerData.rotation.y,
        playerData.rotation.z,
        playerData.rotation.w
      );
      model.quaternion.copy(quaternion);
    }
    
    // Add to scene
    this.scene.add(model);
    
    // Store remote player data
    this.remotePlayers.set(playerData.id, {
      model: model,
      isMobilePlayer: isMobilePlayer,
      lastUpdate: Date.now()
    });
  }
  
  /**
   * Create a text label displaying the player's username
   * @param {THREE.Object3D} model - Player model
   * @param {string} username - Player's username
   */
  createUsernameLabel(model, username) {
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
    context.fillText(username || 'Player', canvas.width / 2, canvas.height / 2);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    
    // Create sprite material
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });
    
    // Create sprite
    const nameSprite = new THREE.Sprite(material);
    nameSprite.scale.set(2, 0.5, 1);
    
    // Position above the model
    nameSprite.position.y = 2;
    
    // Add to the model
    model.add(nameSprite);
  }
  
  /**
   * Update an existing remote player
   * @param {string} playerId - Player ID
   * @param {Object} playerData - Updated player data
   */
  updateRemotePlayer(playerId, playerData) {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (!remotePlayer || !remotePlayer.model) return;
    
    // Update position with interpolation
    if (playerData.position) {
      remotePlayer.model.position.lerp(
        new THREE.Vector3(
          playerData.position.x,
          playerData.position.y,
          playerData.position.z
        ),
        0.1
      );
    }
    
    // Update rotation with interpolation
    if (playerData.rotation) {
      const targetQuaternion = new THREE.Quaternion(
        playerData.rotation.x,
        playerData.rotation.y,
        playerData.rotation.z,
        playerData.rotation.w
      );
      
      remotePlayer.model.quaternion.slerp(targetQuaternion, 0.1);
    }
    
    remotePlayer.lastUpdate = Date.now();
  }
  
  /**
   * Remove a remote player
   * @param {string} playerId - Player ID to remove
   */
  removeRemotePlayer(playerId) {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (!remotePlayer) return;
    
    // Remove from scene
    if (remotePlayer.model) {
      this.scene.remove(remotePlayer.model);
      
      // Dispose geometries and materials
      remotePlayer.model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (child.geometry) child.geometry.dispose();
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
    
    // Remove from map
    this.remotePlayers.delete(playerId);
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    this.isActive = false;
    
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // Clean up touch controller
    if (this.touchController) {
      this.touchController.dispose();
      this.touchController = null;
    }
    
    // Clean up mobile player
    if (this.mobilePlayer) {
      this.mobilePlayer.dispose();
      this.mobilePlayer = null;
    }
    
    // Clean up remote players
    this.remotePlayers.forEach((remotePlayer, playerId) => {
      this.removeRemotePlayer(playerId);
    });
    this.remotePlayers.clear();
    
    // Clean up renderer
    if (this.renderer) {
      this.renderer.dispose();
      this.renderer = null;
    }
    
    // Clean up scene
    if (this.scene) {
      this.scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(material => material.dispose());
            } else {
              object.material.dispose();
            }
          }
        }
      });
      this.scene = null;
    }
    
    console.log('Mobile game manager cleaned up');
  }
}
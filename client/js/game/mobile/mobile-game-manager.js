import { MobilePlayer } from './mobile-player.js';
import { TouchController } from './touch-controller.js';
import * as THREE from 'three';

/**
 * Manages mobile-specific game experience
 * Enhanced for standalone mobile gameplay
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
    
    // Mobile-specific game state
    this.gameState = {
      isPlaying: false,
      score: 0,
      health: 100,
      powerups: [],
      objectives: []
    };
    
    // Game objects (simplified without projectiles)
    this.gameObjects = {
      collectibles: [],
      obstacles: [],
      effects: []
    };
    
    // Game configuration (simplified without weapons)
    this.config = {};
    
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
    
    // Mobile-specific action events
    this.eventBus.on('mobile:calibrate-gyro', this.handleCalibrateGyro.bind(this));
    
    // Game event listeners
    this.eventBus.on('game:collect-item', this.handleItemCollected.bind(this));
    
    // Game mode events
    this.eventBus.on('game:start-match', this.handleStartMatch.bind(this));
    this.eventBus.on('game:end-match', this.handleEndMatch.bind(this));
  }
  
  /**
   * Initialize 3D scene for mobile experience
   * @param {HTMLElement} container - Container element for renderer
   */
  initializeScene(container) {
    try {
      if (!container) {
        console.error("Cannot initialize scene: container is null");
        return;
      }
      
      // Clean up existing scene if there is one
      if (this.isActive) {
        this.cleanup();
      }
      
      this.container = container;
      
      // We won't set container.width/height directly to avoid creating a 2D context
      
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
      
      // Create fog for distance effect
      this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.005);
      
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
      
      // Create skybox
      this.createSkybox();
      
      // Create renderer
      this.renderer = new THREE.WebGLRenderer({ 
        antialias: true,
        canvas: container,
        alpha: true,
        powerPreference: "high-performance"
      });
      
      // Use clientWidth/Height instead of width/height properties
      const width = container.clientWidth || (container.parentElement ? container.parentElement.clientWidth : 300);
      const height = container.clientHeight || (container.parentElement ? container.parentElement.clientHeight : 200);
      
      console.log(`Initializing renderer with dimensions: ${width}x${height}`);
      this.renderer.setSize(width, height);
      this.renderer.setClearColor(0x87CEEB); // Sky blue
      this.renderer.shadowMap.enabled = true;
      
      // Initialize mobile player
      this.mobilePlayer = new MobilePlayer(this.scene, this.eventBus);
      
      // Initialize touch controller
      this.touchController = new TouchController(this.eventBus, container);
      this.touchController.enable();
      
      // No weapon system in simplified gameplay
      
      // Initialize game objects
      this.initializeGameObjects();
      
      // Create game UI elements
      this.createGameUI();
      
      // Handle window resize
      window.addEventListener('resize', this.onWindowResize.bind(this), false);
      
      // Initial resize
      this.onWindowResize();
      
      // Start animation loop
      this.isActive = true;
      this.animate();
      
      // Force a render to ensure something appears immediately
      if (this.renderer && this.mobilePlayer) {
        this.renderer.render(this.scene, this.mobilePlayer.getCamera());
      }
      
      console.log('Enhanced mobile 3D scene initialized');
    } catch (error) {
      console.error("Error initializing 3D scene:", error);
    }
  }
  
  /**
   * Create a simple skybox
   */
  createSkybox() {
    const skyboxGeometry = new THREE.BoxGeometry(900, 900, 900);
    const skyboxMaterials = [
      new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }), // Right
      new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }), // Left
      new THREE.MeshBasicMaterial({ color: 0x6CA6CD, side: THREE.BackSide }), // Top (slightly darker)
      new THREE.MeshBasicMaterial({ color: 0x72A672, side: THREE.BackSide }), // Bottom (ground color)
      new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide }), // Front
      new THREE.MeshBasicMaterial({ color: 0x87CEEB, side: THREE.BackSide })  // Back
    ];
    
    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterials);
    this.scene.add(skybox);
  }
  
  /**
   * Weapon system removed for simplified gameplay
   */
  
  /**
   * Initialize game objects like pickups and obstacles
   */
  initializeGameObjects() {
    // Create objects container
    this.objectsContainer = new THREE.Group();
    this.scene.add(this.objectsContainer);
    
    // No projectiles in simplified gameplay
    
    // Create effects container
    this.effectsContainer = new THREE.Group();
    this.scene.add(this.effectsContainer);
  }
  
  /**
   * Create game UI elements
   */
  createGameUI() {
    // Create container for UI elements
    try {
      const uiContainer = document.createElement('div');
      uiContainer.id = 'mobileGameUI';
      uiContainer.style.position = 'absolute';
      uiContainer.style.top = '0';
      uiContainer.style.left = '0';
      uiContainer.style.width = '100%';
      uiContainer.style.height = '100%';
      uiContainer.style.pointerEvents = 'none';
      uiContainer.style.zIndex = '1000';
      
      // Health bar
      const healthBar = document.createElement('div');
      healthBar.id = 'healthBar';
      healthBar.style.position = 'absolute';
      healthBar.style.top = '10px';
      healthBar.style.left = '10px';
      healthBar.style.width = '150px';
      healthBar.style.height = '15px';
      healthBar.style.background = 'rgba(0, 0, 0, 0.5)';
      healthBar.style.borderRadius = '3px';
      
      const healthFill = document.createElement('div');
      healthFill.id = 'healthFill';
      healthFill.style.width = '100%';
      healthFill.style.height = '100%';
      healthFill.style.background = 'linear-gradient(to right, #ff0000, #00ff00)';
      healthFill.style.borderRadius = '3px';
      
      healthBar.appendChild(healthFill);
      uiContainer.appendChild(healthBar);
      
      // Score display
      const scoreDisplay = document.createElement('div');
      scoreDisplay.id = 'scoreDisplay';
      scoreDisplay.style.position = 'absolute';
      scoreDisplay.style.top = '10px';
      scoreDisplay.style.right = '10px';
      scoreDisplay.style.color = 'white';
      scoreDisplay.style.background = 'rgba(0, 0, 0, 0.5)';
      scoreDisplay.style.padding = '5px 10px';
      scoreDisplay.style.borderRadius = '3px';
      scoreDisplay.style.fontFamily = 'Arial, sans-serif';
      scoreDisplay.style.fontSize = '16px';
      scoreDisplay.textContent = 'Score: 0';
      
      uiContainer.appendChild(scoreDisplay);
      
      // No weapon indicators in simplified gameplay
      
      // Calibrate gyro button
      const calibrateButton = document.createElement('div');
      calibrateButton.id = 'calibrateGyro';
      calibrateButton.style.position = 'absolute';
      calibrateButton.style.top = '45px';
      calibrateButton.style.left = '10px';
      calibrateButton.style.color = 'white';
      calibrateButton.style.background = 'rgba(0, 0, 0, 0.5)';
      calibrateButton.style.padding = '5px 10px';
      calibrateButton.style.borderRadius = '3px';
      calibrateButton.style.fontFamily = 'Arial, sans-serif';
      calibrateButton.style.fontSize = '14px';
      calibrateButton.style.pointerEvents = 'auto';
      calibrateButton.textContent = 'Calibrate Gyro';
      
      // Event listener for gyro calibration
      calibrateButton.addEventListener('click', () => {
        this.eventBus.emit('mobile:calibrate-gyro');
      });
      
      uiContainer.appendChild(calibrateButton);
      
      // Add UI container to the document - check if container parent exists
      if (this.container && this.container.parentElement) {
        this.container.parentElement.appendChild(uiContainer);
        this.uiContainer = uiContainer;
      } else {
        console.error("Cannot append UI container: container parent element not available");
        // Try append to document body as fallback
        document.body.appendChild(uiContainer);
        this.uiContainer = uiContainer;
      }
    } catch (error) {
      console.error("Error creating game UI:", error);
    }
    
    // Store UI element references - variables will be undefined if createGameUI failed
    this.uiElements = {
      healthBar: document.getElementById('healthBar'),
      healthFill: document.getElementById('healthFill'),
      scoreDisplay: document.getElementById('scoreDisplay')
      // No weaponIndicator in simplified gameplay
    };
  }
  
  /**
   * Handle window resize
   */
  onWindowResize() {
    if (!this.mobilePlayer || !this.renderer || !this.container) return;
    
    try {
      const camera = this.mobilePlayer.getCamera();
      if (!camera) return;
      
      // Get container dimensions, with fallbacks to prevent division by zero
      let width = this.container.clientWidth;
      let height = this.container.clientHeight;
      
      // If dimensions are zero, try to get dimensions from parent or use defaults
      if (width === 0 || height === 0) {
        if (this.container.parentElement) {
          width = this.container.parentElement.clientWidth || 300;
          height = this.container.parentElement.clientHeight || 200;
        } else {
          width = 300;
          height = 200;
        }
        // Don't modify canvas dimensions directly to avoid WebGL context issues
      }
      
      // Update camera aspect ratio
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      
      // Resize renderer
      this.renderer.setSize(width, height); 
      
      // Force a render after resize
      if (this.scene && camera) {
        this.renderer.render(this.scene, camera);
      }
    } catch (error) {
      console.error("Error in window resize handler:", error);
    }
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
    
    // Update cooldown
    if (this.gameState.cooldown > 0) {
      this.gameState.cooldown -= delta;
      if (this.gameState.cooldown < 0) {
        this.gameState.cooldown = 0;
      }
    }
    
    // No projectiles to update in simplified gameplay
    
    // Update game objects
    this.updateGameObjects(delta);
    
    // Update UI elements
    this.updateUI();
    
    // Render the scene
    if (this.renderer && this.mobilePlayer) {
      this.renderer.render(this.scene, this.mobilePlayer.getCamera());
    }
    
    this.prevTime = time;
  }
  
  /**
   * Projectile handling removed for simplified gameplay
   */
  
  /**
   * Update game objects like collectibles and effects
   * @param {number} delta - Time delta since last frame
   */
  updateGameObjects(delta) {
    // Update effects (e.g., explosions, particles)
    for (let i = this.gameObjects.effects.length - 1; i >= 0; i--) {
      const effect = this.gameObjects.effects[i];
      
      // Update lifetime
      effect.lifetime -= delta;
      
      // Check for lifetime expiration
      if (effect.lifetime <= 0) {
        // Remove effect
        this.effectsContainer.remove(effect.model);
        this.gameObjects.effects.splice(i, 1);
        continue;
      }
      
      // Update effect (e.g., scale, opacity)
      if (effect.type === 'explosion') {
        // Expand explosion
        const scale = 1 + (1 - effect.lifetime / effect.initialLifetime) * 2;
        effect.model.scale.set(scale, scale, scale);
        
        // Fade out
        const materials = effect.model.material instanceof Array 
          ? effect.model.material 
          : [effect.model.material];
          
        materials.forEach(material => {
          if (material.opacity) {
            material.opacity = effect.lifetime / effect.initialLifetime;
          }
        });
      }
    }
    
    // Update collectibles
    for (let i = this.gameObjects.collectibles.length - 1; i >= 0; i--) {
      const collectible = this.gameObjects.collectibles[i];
      
      // Rotate collectible
      collectible.model.rotation.y += delta * 2;
      
      // Bobbing motion
      collectible.model.position.y = collectible.baseY + 
        Math.sin(data.time / 500) * 0.2;
      
      // Check for player collision
      if (this.mobilePlayer) {
        const playerPosition = this.mobilePlayer.position.clone();
        const distance = playerPosition.distanceTo(collectible.model.position);
        
        // If distance is less than collection radius
        if (distance < 2) {
          // Collect item
          this.objectsContainer.remove(collectible.model);
          this.gameObjects.collectibles.splice(i, 1);
          
          // Process collectible effect
          this.processCollectible(collectible);
        }
      }
    }
  }
  
  /**
   * Update UI elements
   */
  updateUI() {
    if (!this.gameState) return;
    
    try {
      // Refresh UI element references in case they've been added to the DOM since initialization
      if (!this.uiElements || !this.uiElements.healthFill) {
        this.uiElements = {
          healthBar: document.getElementById('healthBar'),
          healthFill: document.getElementById('healthFill'),
          scoreDisplay: document.getElementById('scoreDisplay')
        };
      }
      
      // Check for health UI elements
      if (this.uiElements.healthFill) {
        // Update health bar
        const healthPercent = Math.max(0, Math.min(100, this.gameState.health));
        this.uiElements.healthFill.style.width = `${healthPercent}%`;
        
        // Set color based on health
        if (healthPercent > 60) {
          this.uiElements.healthFill.style.background = 'linear-gradient(to right, #00cc00, #00ff00)';
        } else if (healthPercent > 30) {
          this.uiElements.healthFill.style.background = 'linear-gradient(to right, #cccc00, #ffff00)';
        } else {
          this.uiElements.healthFill.style.background = 'linear-gradient(to right, #cc0000, #ff0000)';
        }
      }
      
      // Update score display
      if (this.uiElements.scoreDisplay) {
        this.uiElements.scoreDisplay.textContent = `Score: ${this.gameState.score || 0}`;
      }
      
      // No weapon indicators to update in simplified gameplay
    } catch (error) {
      console.error("Error updating UI:", error);
    }
  }
  
  /**
   * Removed weapon-related functionality for simplified gameplay
   */
  
  /**
   * Handle gyroscope calibration
   */
  handleCalibrateGyro() {
    if (!this.mobilePlayer) return;
    
    // Request calibration from mobile player
    this.eventBus.emit('mobile:reset-gyro-calibration');
    
    // Show notification
    this.showNotification('Gyroscope calibrated');
  }
  
  /**
   * Show a notification to the player
   * @param {string} message - Notification message
   * @param {string} type - Notification type (info, success, warning, error)
   */
  showNotification(message, type = 'info') {
    try {
      if (!document || !document.body) {
        console.warn('Document or body not available for notification');
        return;
      }
      
      // Create notification element
      const notification = document.createElement('div');
      notification.className = 'mobile-notification';
      notification.style.position = 'absolute';
      notification.style.bottom = '100px';
      notification.style.left = '50%';
      notification.style.transform = 'translateX(-50%)';
      notification.style.padding = '8px 16px';
      notification.style.borderRadius = '4px';
      notification.style.color = 'white';
      notification.style.fontFamily = 'Arial, sans-serif';
      notification.style.fontSize = '16px';
      notification.style.textAlign = 'center';
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.3s, transform 0.3s';
      notification.style.zIndex = '2000';
      notification.textContent = message || 'Notification';
      
      // Set color based on type
      switch (type) {
        case 'success':
          notification.style.background = 'rgba(0, 180, 0, 0.8)';
          break;
        case 'warning':
          notification.style.background = 'rgba(255, 180, 0, 0.8)';
          break;
        case 'error':
          notification.style.background = 'rgba(200, 0, 0, 0.8)';
          break;
        default:
          notification.style.background = 'rgba(0, 0, 0, 0.7)';
      }
      
      // Add to document
      document.body.appendChild(notification);
      
      // Animate in
      setTimeout(() => {
        if (notification) {
          notification.style.opacity = '1';
          notification.style.transform = 'translateX(-50%) translateY(0)';
        }
      }, 10);
      
      // Remove after delay
      setTimeout(() => {
        if (notification) {
          notification.style.opacity = '0';
          notification.style.transform = 'translateX(-50%) translateY(-20px)';
          
          // Remove from DOM after animation
          setTimeout(() => {
            if (notification && notification.parentNode) {
              notification.parentNode.removeChild(notification);
            }
          }, 300);
        }
      }, 3000);
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }
  
  /**
   * Handle player hit event
   * @param {Object} data - Hit data
   */
  handlePlayerHit(data) {
    // If this is the local player being hit
    if (data.playerId === this.gameStateManager.getLocalPlayerId()) {
      // Reduce health
      this.gameState.health -= data.damage;
      
      // Check if player is defeated
      if (this.gameState.health <= 0) {
        this.gameState.health = 0;
        
        // Handle player defeated (respawn)
        setTimeout(() => {
          this.respawnPlayer();
        }, 3000);
        
        // Show defeat message
        this.showNotification('You were defeated! Respawning...', 'error');
      }
      
      // Update UI
      this.updateUI();
      
      // Visual feedback
      this.showDamageOverlay();
    }
  }
  
  /**
   * Show damage overlay when player is hit
   */
  showDamageOverlay() {
    // Create overlay element if it doesn't exist
    let overlay = document.getElementById('damageOverlay');
    
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'damageOverlay';
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.left = '0';
      overlay.style.width = '100%';
      overlay.style.height = '100%';
      overlay.style.background = 'radial-gradient(circle, transparent 50%, rgba(255, 0, 0, 0.4) 100%)';
      overlay.style.pointerEvents = 'none';
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.5s';
      overlay.style.zIndex = '1500';
      
      document.body.appendChild(overlay);
    }
    
    // Show overlay
    overlay.style.opacity = '1';
    
    // Hide after short delay
    setTimeout(() => {
      overlay.style.opacity = '0';
    }, 500);
  }
  
  /**
   * Respawn player after defeat
   */
  respawnPlayer() {
    // Reset health
    this.gameState.health = 100;
    
    // Reset position
    if (this.mobilePlayer) {
      // Random position within play area
      const randomX = (Math.random() - 0.5) * 100;
      const randomZ = (Math.random() - 0.5) * 100;
      this.mobilePlayer.position.set(randomX, 10, randomZ);
      
      // Reset velocity
      this.mobilePlayer.velocity.set(0, 0, 0);
    }
    
    // Reset weapon to standard
    this.gameState.playerWeapon = 'standard';
    
    // Hide all weapon models
    Object.values(this.weaponModels).forEach(model => {
      model.visible = false;
    });
    
    // Show standard weapon model
    if (this.weaponModels.standard) {
      this.weaponModels.standard.visible = true;
    }
    
    // Update UI
    this.updateUI();
    
    // Show respawn message
    this.showNotification('Respawned!', 'success');
  }
  
  /**
   * Handle item collected event
   * @param {Object} data - Collectible data
   */
  handleItemCollected(data) {
    switch (data.type) {
      case 'health':
        // Increase health
        this.gameState.health = Math.min(100, this.gameState.health + 25);
        this.showNotification('+25 Health', 'success');
        break;
        
      case 'weapon':
        // Switch to specific weapon
        this.gameState.playerWeapon = data.weaponType || 'standard';
        
        // Hide all weapon models
        Object.values(this.weaponModels).forEach(model => {
          model.visible = false;
        });
        
        // Show current weapon model
        if (this.weaponModels[this.gameState.playerWeapon]) {
          this.weaponModels[this.gameState.playerWeapon].visible = true;
        }
        
        this.showNotification(`Picked up ${this.gameState.playerWeapon} weapon`, 'success');
        break;
        
      case 'score':
        // Increase score
        this.gameState.score += data.points || 50;
        this.showNotification(`+${data.points || 50} Points`, 'success');
        break;
    }
    
    // Update UI
    this.updateUI();
  }
  
  /**
   * Handle start match
   */
  handleStartMatch() {
    // Reset game state
    this.gameState.isPlaying = true;
    this.gameState.score = 0;
    this.gameState.health = 100;
    this.gameState.playerWeapon = 'standard';
    
    // Show weapon
    Object.values(this.weaponModels).forEach(model => {
      model.visible = false;
    });
    
    if (this.weaponModels.standard) {
      this.weaponModels.standard.visible = true;
    }
    
    // Show start notification
    this.showNotification('Match Started!', 'success');
    
    // Update UI
    this.updateUI();
  }
  
  /**
   * Handle end match
   */
  handleEndMatch(data) {
    this.gameState.isPlaying = false;
    
    // Show end notification
    if (data && data.winner === this.gameStateManager.getLocalPlayerId()) {
      this.showNotification('You Win!', 'success');
    } else {
      this.showNotification('Match Ended', 'info');
    }
  }
  
  /**
   * Handle room joined event
   * @param {Object} data - Room joined data
   */
  handleRoomJoined(data) {
    console.log('Mobile player joined room', data);
    
    // Always reset initialization state when joining a room
    this.isActive = false;
    
    // Clean up any existing scene immediately
    this.cleanup();
    
    // Reset state variables
    this.mobilePlayer = null;
    this.touchController = null;
    this.scene = null;
    this.renderer = null;
    
    // Initialize scene with a delay to ensure DOM is ready
    setTimeout(() => {
      try {
        const gameCanvas = document.getElementById('gameCanvas');
        if (!gameCanvas) {
          console.error("Cannot find gameCanvas element");
          return;
        }
        
        // Make sure canvas dimensions are set correctly
        // Do not set canvas.width/height directly as it might create a 2D context
        const container = gameCanvas.parentElement;
        if (container) {
          // Instead of setting width/height directly, we'll let the WebGLRenderer do it
          this.initializeScene(gameCanvas);
        } else {
          console.error("Canvas parent element not found");
        }
      } catch (error) {
        console.error("Error in handleRoomJoined:", error);
      }
    }, 200); // Increase delay to ensure canvas is properly sized and ready
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
    if (data.players && this.scene) {
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
    // Check if scene is initialized
    if (!this.scene) {
      console.error('Cannot create remote player: Scene is not initialized');
      return;
    }
    
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
    if (!model) {
      console.error('Cannot create username label: Model is null');
      return;
    }
    
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
    // Check if the remote player exists
    if (!this.remotePlayers || !this.remotePlayers.has(playerId)) {
      return;
    }
    
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
    
    // Clean up game objects
    if (this.gameObjects) {
      // Clean up projectiles
      if (this.gameObjects.projectiles) {
        this.gameObjects.projectiles.forEach(projectile => {
          if (projectile.model && this.projectilesContainer) {
            this.projectilesContainer.remove(projectile.model);
            if (projectile.model.geometry) projectile.model.geometry.dispose();
            if (projectile.model.material) projectile.model.material.dispose();
          }
        });
        this.gameObjects.projectiles = [];
      }
      
      // Clean up effects
      if (this.gameObjects.effects) {
        this.gameObjects.effects.forEach(effect => {
          if (effect.model && this.effectsContainer) {
            this.effectsContainer.remove(effect.model);
            if (effect.model.geometry) effect.model.geometry.dispose();
            if (effect.model.material) effect.model.material.dispose();
          }
        });
        this.gameObjects.effects = [];
      }
      
      // Clean up collectibles
      if (this.gameObjects.collectibles) {
        this.gameObjects.collectibles.forEach(collectible => {
          if (collectible.model && this.objectsContainer) {
            this.objectsContainer.remove(collectible.model);
            if (collectible.model.geometry) collectible.model.geometry.dispose();
            if (collectible.model.material) collectible.model.material.dispose();
          }
        });
        this.gameObjects.collectibles = [];
      }
    }
    
    // Clean up containers
    if (this.projectilesContainer && this.scene) {
      this.scene.remove(this.projectilesContainer);
      this.projectilesContainer = null;
    }
    
    if (this.effectsContainer && this.scene) {
      this.scene.remove(this.effectsContainer);
      this.effectsContainer = null;
    }
    
    if (this.objectsContainer && this.scene) {
      this.scene.remove(this.objectsContainer);
      this.objectsContainer = null;
    }
    
    // Clean up weapon models
    if (this.weaponModels) {
      Object.values(this.weaponModels).forEach(model => {
        if (model) {
          // Dispose of all children
          model.traverse(child => {
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
      });
      this.weaponModels = {};
    }
    
    // Clean up UI elements
    if (this.uiContainer && this.uiContainer.parentNode) {
      this.uiContainer.parentNode.removeChild(this.uiContainer);
      this.uiContainer = null;
    }
    
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
    
    console.log('Enhanced mobile game manager cleaned up');
  }
}
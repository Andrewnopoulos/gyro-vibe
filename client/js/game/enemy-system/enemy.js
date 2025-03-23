import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Base class for all enemies in the game
 */
export class Enemy {
  /**
   * @param {Object} options - Enemy creation options
   * @param {THREE.Scene} options.scene - Three.js scene
   * @param {CANNON.World} options.world - Physics world
   * @param {EventBus} options.eventBus - Application event bus
   * @param {Object} options.position - Initial position {x, y, z}
   * @param {number} options.health - Initial health amount
   * @param {string} options.type - Enemy type identifier
   */
  constructor(options) {
    this.scene = options.scene;
    this.world = options.world;
    this.eventBus = options.eventBus;
    this.position = options.position || { x: 0, y: 0, z: 0 };
    
    this.id = `enemy_${Math.random().toString(36).substr(2, 9)}`;
    this.maxHealth = options.health || 10;
    this.health = this.maxHealth;
    this.type = options.type || 'basic';
    this.isDead = false;
    this.isRemoving = false;
    
    this.model = null;
    this.physicsBody = null;
    this.healthBar = null;
    
    // Animation properties
    this.animations = {};
    this.currentAnimation = null;
    this.deathAnimationStartTime = 0;
    
    // Create the enemy model and physics body
    this.initialize();
    
    // Listen for damage events targeted at this enemy
    this.eventBus.on('entity:damage', this.handleDamage.bind(this));
  }
  
  /**
   * Initialize the enemy model and physics
   */
  initialize() {
    // Create 3D model
    this.createModel();
    
    // Create physics body
    this.createPhysics();
    
    // Create health bar
    this.createHealthBar();
    
    // Register with the health system
    this.eventBus.emit('entity:register', {
      id: this.id,
      health: this.health,
      maxHealth: this.maxHealth,
      isEnemy: true
    });
    
    // Register visual for animations
    this.eventBus.emit('entity:register-visual', {
      id: this.id,
      mesh: this.model,
      entityType: this.type
    });
  }
  
  /**
   * Create the 3D model for this enemy
   * Override in subclasses for specific enemy types
   */
  createModel() {
    // Default implementation creates a simple box
    const geometry = new THREE.BoxGeometry(1, 2, 1);
    const material = new THREE.MeshStandardMaterial({
      color: 0xaa3333,
      roughness: 0.7,
      metalness: 0.2
    });
    
    this.model = new THREE.Mesh(geometry, material);
    this.model.position.set(
      this.position.x,
      this.position.y,
      this.position.z
    );
    this.model.castShadow = true;
    this.model.receiveShadow = true;
    this.model.userData.enemyId = this.id;
    
    this.scene.add(this.model);
  }
  
  /**
   * Create the physics body for this enemy
   */
  createPhysics() {
    // Create a physics shape based on model
    const shape = new CANNON.Box(new CANNON.Vec3(0.5, 1, 0.5));
    
    // Create body with mass 0 for static enemies
    this.physicsBody = new CANNON.Body({
      mass: 0, // Static by default
      position: new CANNON.Vec3(
        this.position.x,
        this.position.y,
        this.position.z
      ),
      shape: shape,
      material: new CANNON.Material()
    });
    
    // Add to physics world
    this.world.addBody(this.physicsBody);
    
    // Store reference to enemy in the body for collision detection
    this.physicsBody.userData = { enemyId: this.id };
  }
  
  /**
   * Create a health bar above the enemy
   */
  createHealthBar() {
    // Create a canvas for the health bar
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 8;
    const context = canvas.getContext('2d');
    
    // Draw health bar background
    context.fillStyle = '#333333';
    context.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw health amount
    context.fillStyle = '#33cc33';
    const healthWidth = (this.health / this.maxHealth) * canvas.width;
    context.fillRect(0, 0, healthWidth, canvas.height);
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    
    // Create sprite material
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true
    });
    
    // Create sprite
    this.healthBar = new THREE.Sprite(material);
    this.healthBar.scale.set(1, 0.125, 1);
    
    // Position above the model
    this.healthBar.position.y = 2.5;
    
    // Add to model
    this.model.add(this.healthBar);
    
    // Store canvas context for updates
    this.healthBarContext = context;
    this.healthBarTexture = texture;
  }
  
  /**
   * Update the health bar display
   */
  updateHealthBar() {
    if (!this.healthBar || !this.healthBarContext || !this.healthBarTexture) return;
    
    const context = this.healthBarContext;
    
    // Clear canvas
    context.clearRect(0, 0, 64, 8);
    
    // Draw health bar background
    context.fillStyle = '#333333';
    context.fillRect(0, 0, 64, 8);
    
    // Draw health amount
    const healthPercentage = this.health / this.maxHealth;
    const healthWidth = healthPercentage * 64;
    
    // Change color based on health percentage
    if (healthPercentage > 0.6) {
      context.fillStyle = '#33cc33'; // Green
    } else if (healthPercentage > 0.3) {
      context.fillStyle = '#cccc33'; // Yellow
    } else {
      context.fillStyle = '#cc3333'; // Red
    }
    
    context.fillRect(0, 0, healthWidth, 8);
    
    // Update texture
    this.healthBarTexture.needsUpdate = true;
  }
  
  /**
   * Handle damage events
   * @param {Object} data - Damage event data
   */
  handleDamage(data) {
    // Check if this damage event is for this enemy
    if (data.id !== this.id) return;
    
    // Skip if already dead
    if (this.isDead) return;
    
    // Apply damage
    const previousHealth = this.health;
    this.health = Math.max(0, this.health - data.amount);
    
    // Update health bar
    this.updateHealthBar();
    
    // Flash red on hit
    this.flashOnHit();
    
    // Check for death
    if (previousHealth > 0 && this.health <= 0) {
      this.die();
    }
  }
  
  /**
   * Flash the model red when taking damage
   */
  flashOnHit() {
    if (!this.model || !this.model.material) return;
    
    // Store original color
    const originalColor = this.model.material.color.clone();
    
    // Flash red
    this.model.material.color.set(0xff0000);
    
    // Restore original color after a short time
    setTimeout(() => {
      if (this.model && this.model.material) {
        this.model.material.color.copy(originalColor);
      }
    }, 100);
  }
  
  /**
   * Handle enemy death
   */
  die() {
    this.isDead = true;
    
    // Start death animation
    this.startDeathAnimation();
    
    // Emit death event
    this.eventBus.emit('entity:death', {
      id: this.id,
      type: this.type,
      isEnemy: true,
      position: {
        x: this.model.position.x,
        y: this.model.position.y,
        z: this.model.position.z
      }
    });
  }
  
  /**
   * Start the death animation
   */
  startDeathAnimation() {
    // Record start time for animation
    this.deathAnimationStartTime = Date.now();
    
    // Hide health bar immediately
    if (this.healthBar) {
      this.healthBar.visible = false;
    }
    
    // Schedule full removal after animation completes
    setTimeout(() => this.remove(), 2000);
  }
  
  /**
   * Update the enemy
   * @param {number} delta - Time in seconds since last update
   */
  update(delta) {
    // Skip update if dead and removal is in progress
    if (this.isRemoving) return;
    
    // Handle death animation if dead
    if (this.isDead) {
      this.updateDeathAnimation(delta);
      return;
    }
    
    // Regular update logic - override in subclasses
    this.updateBehavior(delta);
    
    // Update model position to match physics body
    if (this.physicsBody && this.model) {
      this.model.position.copy(this.physicsBody.position);
      this.model.quaternion.copy(this.physicsBody.quaternion);
    }
  }
  
  /**
   * Override this in subclasses for specific behavior
   * @param {number} delta - Time in seconds since last update
   */
  updateBehavior(delta) {
    // Default behavior does nothing
  }
  
  /**
   * Update death animation
   * @param {number} delta - Time in seconds since last update
   */
  updateDeathAnimation(delta) {
    if (!this.model) return;
    
    const elapsedTime = (Date.now() - this.deathAnimationStartTime) / 1000;
    const animationDuration = 2.0; // seconds
    const progress = Math.min(elapsedTime / animationDuration, 1.0);
    
    // Rotation - fall over animation
    this.model.rotation.x = progress * Math.PI / 2; // 90 degree rotation to fall forward
    
    // Move down as it falls for more realistic effect
    this.model.position.y = this.position.y - progress * 0.5;
    
    // Fade out near the end of the animation
    if (progress > 0.7 && this.model.material) {
      const opacity = 1.0 - ((progress - 0.7) / 0.3);
      
      // Make sure material is set to transparent
      if (!this.model.material.transparent) {
        this.model.material.transparent = true;
      }
      
      // Apply opacity
      this.model.material.opacity = opacity;
    }
  }
  
  /**
   * Remove the enemy from the scene and clean up resources
   */
  remove() {
    if (this.isRemoving) return; // Avoid duplicate removal
    this.isRemoving = true;
    
    // Clean up event listener
    this.eventBus.off('entity:damage', this.handleDamage);
    
    // Remove physics body
    if (this.physicsBody) {
      this.world.removeBody(this.physicsBody);
      this.physicsBody = null;
    }
    
    // Remove model from scene
    if (this.model) {
      this.scene.remove(this.model);
      
      // Dispose of geometries and materials
      if (this.model.geometry) {
        this.model.geometry.dispose();
      }
      
      if (this.model.material) {
        if (Array.isArray(this.model.material)) {
          this.model.material.forEach(material => material.dispose());
        } else {
          this.model.material.dispose();
        }
      }
      
      this.model = null;
    }
    
    // Clean up health bar texture
    if (this.healthBarTexture) {
      this.healthBarTexture.dispose();
      this.healthBarTexture = null;
    }
    
    // Emit removal event
    this.eventBus.emit('entity:removed', {
      id: this.id,
      isEnemy: true
    });
  }
}
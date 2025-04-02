import * as THREE from 'three';
import { FlockingMovement } from './flocking-movement.js';

/**
 * Manages a group of particle-based enemies using instanced rendering
 * for efficient display of many enemies simultaneously
 */
export class ParticleEnemyGroup {
  /**
   * @param {Object} options - Configuration options
   * @param {THREE.Scene} options.scene - Three.js scene
   * @param {EventBus} options.eventBus - Application event bus
   * @param {Function} options.getPlayerPosition - Function to get player's position
   * @param {number} [options.maxEnemies=1000] - Maximum number of enemies to support
   */
  constructor(options) {
    this.scene = options.scene;
    this.eventBus = options.eventBus;
    this.getPlayerPosition = options.getPlayerPosition || (() => null);
    this.maxEnemies = options.maxEnemies || 1000;
    this.activeCount = 0;
    
    // Initialize the flocking movement system with idle, orbit and attack behaviors
    this.movement = new FlockingMovement({
      // Flocking parameters
      separationDistance: 1.0,
      alignmentDistance: 2.0,
      cohesionDistance: 2.0,
      separationStrength: 0.05,
      alignmentStrength: 0.03,
      cohesionStrength: 0.02,
      maxSpeed: 0.1,
      
      // Idle parameters
      idleBobAmplitude: 0.0005,   // How high the enemy bobs in place (reduced)
      idleBobFrequency: 0.6,    // How fast the enemy bobs (slightly slower)
      awarenessRadius: 10.0,    // Distance at which enemies notice player (decreased)
      
      // Orbit parameters
      orbitRadius: 7.0,         // Distance to maintain from player
      orbitStrength: 20,       // Force to maintain orbit distance (stronger)
      orbitSpeed: 20,          // Speed of circular motion (much faster)
      
      // Attack parameters
      attackSpeed: 15.0,        // Extremely high speed during attack
      attackDuration: 0.8,      // Duration of attack
      minAttackTime: 40.0,      // Minimum time between attacks (extremely rare)
      maxAttackTime: 60.0       // Maximum time between attacks (extremely rare)
    });

    // Create a render target to capture the scene without particles
    // Get the container dimensions for more accurate sizing
    const container = document.getElementById('phone3d');
    const width = container ? container.clientWidth : window.innerWidth;
    const height = container ? container.clientHeight : window.innerHeight;
    
    this.backgroundRT = new THREE.WebGLRenderTarget(
      width, 
      height, 
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        format: THREE.RGBAFormat
      }
    );

    // Switch to billboarded particles using THREE.Points instead of InstancedMesh
    // Create a simple quad geometry for particles
    const size = 1.2; // Size of the billboards - make them larger to be more visible
    const halfSize = size / 2;
    
    // Create a PlaneGeometry for the billboard - we'll use THREE.Points to handle billboarding
    const geometry = new THREE.BufferGeometry();
    
    // A single point will be expanded into a billboard by the vertex shader
    const positions = new Float32Array(this.maxEnemies * 3); // x, y, z positions
    const colors = new Float32Array(this.maxEnemies * 3); // r, g, b colors
    const sizes = new Float32Array(this.maxEnemies); // size of each point
    
    // Initialize arrays with default values
    for (let i = 0; i < this.maxEnemies; i++) {
      positions[i * 3 + 0] = 0; // x
      positions[i * 3 + 1] = 0; // y
      positions[i * 3 + 2] = 0; // z
      
      colors[i * 3 + 0] = 0; // r
      colors[i * 3 + 1] = 1; // g
      colors[i * 3 + 2] = 0; // b
      
      sizes[i] = size;
    }
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    
    // Use a ShaderMaterial for better control of the billboarding and visual effects
    const material = new THREE.ShaderMaterial({
      uniforms: {
        backgroundTexture: { value: this.backgroundRT.texture },
        particleAlpha: { value: 1.0 },
        resolution: { value: new THREE.Vector2(
          window.innerWidth,
          window.innerHeight
        )},
        pointTexture: { value: null } // We'll create a circular texture below
      },
      side: THREE.DoubleSide, // Make the particles visible from both sides
      vertexShader: `
        attribute float size;
        varying vec2 vUv;
        
        void main() {
          vUv = vec2(0.5, 0.5); // Center of the point
          
          // Billboard calculation - convert to view space
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          
          // Set size based on the distance from camera (for scale consistency)
          // Increase the size factor to make particles more visible
          gl_PointSize = size * (500.0 / -mvPosition.z);
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: `
        uniform sampler2D backgroundTexture;
        uniform float particleAlpha;
        uniform vec2 resolution;
        uniform sampler2D pointTexture;
        
        varying vec2 vUv;
        
        void main() {
          // Use gl_PointCoord for texture mapping across the point
          // It provides coordinates from 0 to 1 across the point quad
          
          // Create a circular shape with soft edges
          float distance = length(gl_PointCoord - vec2(0.5));
          float alpha = 1.0 - smoothstep(0.2, 0.5, distance);
          
          // Calculate UV for background texture
          vec2 uv = gl_FragCoord.xy / resolution;
          
          // Sample background texture
          vec4 backgroundColor = texture2D(backgroundTexture, uv);
          
          // Invert background
          vec3 invertedColor = vec3(1.0 - backgroundColor.r, 1.0 - backgroundColor.g, 1.0 - backgroundColor.b);
          
          // Use the inverted color directly without any particle color influence
          vec3 finalColor = invertedColor;
          
          // Adjust alpha based on distance from center
          gl_FragColor = vec4(finalColor, alpha * particleAlpha);
          
          // Discard pixels with very low alpha (improves performance)
          if (gl_FragColor.a < 0.05) discard;
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending // Use additive blending for glow effect
    });
    
    // Store alpha for easy adjustment
    this.alpha = 1.0;
    material.uniforms.particleAlpha.value = this.alpha;
    
    // Create the point cloud system
    this.particleMesh = new THREE.Points(geometry, material);
    this.particleMesh.frustumCulled = false; // Disable frustum culling
    this.particleMesh.userData = {
      isParticleEnemyGroup: true,
      particleEnemyGroupId: `particleGroup_${Math.random().toString(36).substr(2, 9)}`,
      isRaycastable: true,
      getEnemyIdFromInstance: (instanceId) => this.getEnemyIdFromInstance(instanceId)
    };
    
    // Add to scene
    this.scene.add(this.particleMesh);
    
    console.log("Initialized particle system with points:", this.particleMesh);
    
    // Set name for easier identification
    this.particleMesh.name = 'particleEnemyGroup';
    
    // Custom raycast method for Points
    this.particleMesh.raycast = function(raycaster, intersects) {
      const geometry = this.geometry;
      const matrixWorld = this.matrixWorld;
      const threshold = raycaster.params.Points ? raycaster.params.Points.threshold : 0.1;
      const positions = geometry.getAttribute('position').array;
      const sizes = geometry.getAttribute('size').array;
      
      // Raycast to each point
      for (let i = 0; i < positions.length / 3; i++) {
        if (i >= this.parent.activeCount) break;
        
        const x = positions[i * 3];
        const y = positions[i * 3 + 1];
        const z = positions[i * 3 + 2];
        
        const rayPointDist = raycaster.ray.distanceToPoint(
          _vector.set(x, y, z).applyMatrix4(matrixWorld)
        );
        
        if (rayPointDist < threshold) {
          const intersectPoint = new THREE.Vector3();
          raycaster.ray.closestPointToPoint(
            _vector.set(x, y, z).applyMatrix4(matrixWorld),
            intersectPoint
          );
          
          const distance = raycaster.ray.origin.distanceTo(intersectPoint);
          if (distance < raycaster.near || distance > raycaster.far) continue;
          
          intersects.push({
            distance: distance,
            distanceToRay: rayPointDist,
            point: intersectPoint.clone(),
            index: i,
            face: null,
            object: this
          });
        }
      }
    }.bind(this.particleMesh);
    
    // Define a temp vector for raycast calculations
    const _vector = new THREE.Vector3();

    // Initialize enemy data array
    this.enemyData = Array.from({ length: this.maxEnemies }, (_, i) => ({
      id: `particle_enemy_${i}_${Math.random().toString(36).substr(2, 9)}`,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      health: 0,
      maxHealth: 5,
      state: 'dead', // 'alive', 'dying', 'dead'
      deathStartTime: 0,
      // New phase-related fields
      phase: 'idle', // Current phase: 'idle', 'orbit' or 'attack'
      phaseTimer: Math.random() * 10 + 15, // Much longer time until attack (15-25 seconds initially)
      attackDirection: new THREE.Vector3(), // Direction to move during attack phase
      orbitDirection: Math.random() < 0.5 ? 1 : -1, // Random orbit direction (clockwise or counter-clockwise)
    }));
    
    // Matrix and Object3D for position updates
    this.dummy = new THREE.Object3D();

    // Register for window resize events
    window.addEventListener('resize', this.resize.bind(this));

    // Setup event listeners
    this.setupEventListeners();

    // Add debug visualization to check if background texture is capturing properly
    // Uncomment this section to add a debug plane showing what's in the render target
    
    this.debugPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(4, 3),
      new THREE.MeshBasicMaterial({ 
        map: this.backgroundRT.texture,
        transparent: true,
        opacity: 0.7
      })
    );
    this.debugPlane.position.set(0, 4, 0); // Position above the playing area
    this.scene.add(this.debugPlane);
    
  }

  /**
   * Set up event listeners for damage and death
   */
  setupEventListeners() {
    this.eventBus.on('entity:damage', this.handleDamage.bind(this));
    this.eventBus.on('entity:death', this.handleDeath.bind(this));
  }

  /**
   * Spawn particle enemies at specified positions
   * @param {number} count - Number of enemies to spawn
   * @param {Array<{x:number, y:number, z:number}>} positions - Array of spawn positions
   */
  spawn(count, positions) {
    const spawnCount = Math.min(count, this.maxEnemies - this.activeCount);
    
    // Get references to buffers
    const positionAttr = this.particleMesh.geometry.getAttribute('position');
    const colorAttr = this.particleMesh.geometry.getAttribute('color');
    const sizeAttr = this.particleMesh.geometry.getAttribute('size');
    
    for (let i = 0; i < spawnCount; i++) {
      const index = this.findFreeSlot();
      if (index === -1) break; // No more free slots
      
      const enemy = this.enemyData[index];
      enemy.position.set(
        positions[i].x,
        positions[i].y,
        positions[i].z
      );
      
      // Update position in buffer
      positionAttr.array[index * 3] = enemy.position.x;
      positionAttr.array[index * 3 + 1] = enemy.position.y;
      positionAttr.array[index * 3 + 2] = enemy.position.z;
      
      // No need to set colors since we're just inverting the background
      
      // Set initial size
      sizeAttr.array[index] = 1.0; // Slightly smaller in idle phase
      
      // Add a small random velocity for movement
      enemy.velocity.set(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.01,
        (Math.random() - 0.5) * 0.02
      );
      
      enemy.health = enemy.maxHealth;
      enemy.state = 'alive';
      
      // Initialize phase data
      enemy.phase = 'idle';
      // Initialize with a random attack timer between min and max values (40-60 seconds)
      enemy.phaseTimer = this.movement.minAttackTime + Math.random() * (this.movement.maxAttackTime - this.movement.minAttackTime);
      enemy.attackDirection.set(0, 0, 0);
      enemy.orbitDirection = Math.random() < 0.5 ? 1 : -1; // Random orbit direction

      // Register with HealthManager
      this.eventBus.emit('entity:register', {
        id: enemy.id,
        health: enemy.health,
        maxHealth: enemy.maxHealth,
        isEnemy: true,
      });
    }
    
    // Mark buffers as needing update
    positionAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    sizeAttr.needsUpdate = true;
    
    console.log(`Spawned ${spawnCount} particle enemies, active count: ${this.activeCount}`);
  }

  /**
   * Find an available slot for a new enemy
   * @return {number} Index of free slot, or -1 if none available
   */
  findFreeSlot() {
    // First check the slots beyond the current active count
    if (this.activeCount < this.maxEnemies) {
      return this.activeCount++;
    }
    
    // If at max capacity, look for a 'dead' enemy slot to reuse
    for (let i = 0; i < this.maxEnemies; i++) {
      if (this.enemyData[i].state === 'dead') {
        return i;
      }
    }
    
    return -1; // No slots available
  }

  /**
   * Update all particle enemies
   * @param {number} delta - Time since last update in seconds
   */
  update(delta) {
    const playerPos = this.getPlayerPosition();
    if (playerPos) {
      // Update enemy velocities using flocking behavior
      this.movement.update(this.enemyData, this.activeCount, playerPos, delta);
    }
    
    // Get references to the buffer attributes
    const positions = this.particleMesh.geometry.getAttribute('position');
    const colors = this.particleMesh.geometry.getAttribute('color');
    const sizes = this.particleMesh.geometry.getAttribute('size');
    
    let needsUpdate = false;
    
    for (let i = 0; i < this.activeCount; i++) {
      const enemy = this.enemyData[i];
      
      if (enemy.state === 'alive') {
        // Update position based on velocity (already modified by flocking)
        enemy.position.x += enemy.velocity.x * delta;
        enemy.position.y += enemy.velocity.y * delta; 
        enemy.position.z += enemy.velocity.z * delta;
        
        // Add a small oscillation effect
        enemy.position.y += Math.sin(Date.now() * 0.001 + i) * 0.002;
        
        // Update position in buffer
        positions.array[i * 3] = enemy.position.x;
        positions.array[i * 3 + 1] = enemy.position.y;
        positions.array[i * 3 + 2] = enemy.position.z;
        
        // Determine size based on phase
        let scale;
        if (enemy.phase === 'idle') {
          // Slightly smaller while idle
          scale = 1.0;
        } else if (enemy.phase === 'orbit') {
          // Normal size 
          scale = 1.2;
        } else if (enemy.phase === 'attack') {
          // Larger while attacking
          scale = 1.6;
        }
        sizes.array[i] = scale;
        
        // // Use a consistent color for all particles - bright cyan
        // const color = new THREE.Color().setHSL(0.5, 1.0, 0.6);
        
        // // Set color in buffer
        // colors.array[i * 3] = color.r;
        // colors.array[i * 3 + 1] = color.g;
        // colors.array[i * 3 + 2] = color.b;
        
        needsUpdate = true;
      } 
      else if (enemy.state === 'dying') {
        const progress = (Date.now() - enemy.deathStartTime) / 1000; // 1-second death animation
        
        if (progress >= 1) {
          this.removeEnemy(i);
          i--; // Adjust index after removal
          needsUpdate = true;
          continue;
        }
        
        // Update position
        positions.array[i * 3] = enemy.position.x;
        positions.array[i * 3 + 1] = enemy.position.y;
        positions.array[i * 3 + 2] = enemy.position.z;
        
        // Scale down while dying
        sizes.array[i] = 0.6 * (1 - progress);
        
        // No need to set colors as we're just inverting the background
        
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
      // Mark attributes as needing update
      positions.needsUpdate = true;
      colors.needsUpdate = true;
      sizes.needsUpdate = true;
    }
  }

  /**
   * Update all particle positions after changes
   */
  updateInstances() {
    // Call update with delta=0 to refresh particle positions without movement
    this.update(0);
  }

  /**
   * Handle damage events for particle enemies
   * @param {Object} data - Damage event data
   */
  handleDamage(data) {
    // Find the enemy with this ID that isn't already dead
    const index = this.findEnemyIndexById(data.id);
    if (index === -1) return;
    
    const enemy = this.enemyData[index];
    const previousHealth = enemy.health;
    enemy.health = Math.max(0, enemy.health - data.amount);
    
    // Update colors to reflect new health
    const healthPercent = enemy.health / enemy.maxHealth;
    const color = new THREE.Color().setHSL(healthPercent * 0.3, 1, 0.5);
    this.instancedMesh.setColorAt(index, color);
    this.instancedMesh.instanceColor.needsUpdate = true;
    
    // If not a networked event and we're handling it for the first time,
    // forward it along to ensure server is notified
    if (data.isNetworked !== true && !data.isLocalEvent) {
      this.eventBus.emit('entity:damage', {
        id: enemy.id,
        amount: data.amount,
        damageType: data.damageType || 'generic',
        sourceId: typeof data.sourceId === 'string' ? data.sourceId : null,
        isEnemy: true,
        isLocalEvent: true
      });
    }
  }

  /**
   * Handle death events for particle enemies
   * @param {Object} data - Death event data
   */
  handleDeath(data) {
    const index = this.findEnemyIndexById(data.id);
    if (index === -1) return;
    
    const enemy = this.enemyData[index];
    if (enemy.state === 'alive') {
      enemy.state = 'dying';
      enemy.deathStartTime = Date.now();
    }
  }

  /**
   * Find enemy index by ID
   * @param {string} id - Enemy ID to find
   * @return {number} Index of the enemy or -1 if not found
   */
  findEnemyIndexById(id) {
    for (let i = 0; i < this.activeCount; i++) {
      if (this.enemyData[i].id === id && this.enemyData[i].state !== 'dead') {
        return i;
      }
    }
    return -1;
  }

  /**
   * Remove an enemy from the active set
   * @param {number} index - Index of enemy to remove
   */
  removeEnemy(index) {
    if (index < 0 || index >= this.activeCount) return;
    
    // Get buffer attributes
    const positions = this.particleMesh.geometry.getAttribute('position');
    const colors = this.particleMesh.geometry.getAttribute('color');
    const sizes = this.particleMesh.geometry.getAttribute('size');
    
    const enemy = this.enemyData[index];
    enemy.state = 'dead';
    
    // If this is not the last active enemy, swap with the last one to keep array dense
    if (index < this.activeCount - 1) {
      // Copy the last active enemy to this slot
      this.enemyData[index] = this.enemyData[this.activeCount - 1];
      
      // Move the "removed" enemy to the end
      this.enemyData[this.activeCount - 1] = enemy;
      
      // Update the buffers for the swapped element
      const swappedEnemy = this.enemyData[index];
      
      // Update position
      positions.array[index * 3] = swappedEnemy.position.x;
      positions.array[index * 3 + 1] = swappedEnemy.position.y;
      positions.array[index * 3 + 2] = swappedEnemy.position.z;
      
      // No need to set colors since we're just inverting the background
      
      // Update size based on phase
      let size = 1.2;
      if (swappedEnemy.phase === 'idle') size = 1.0;
      else if (swappedEnemy.phase === 'attack') size = 1.6;
      sizes.array[index] = size;
    }
    
    // Decrease active count
    this.activeCount--;
    
    // Mark buffers as needing update
    positions.needsUpdate = true;
    colors.needsUpdate = true;
    sizes.needsUpdate = true;
    
    // Let the health manager know this entity is gone
    this.eventBus.emit('entity:removed', {
      id: enemy.id,
      isEnemy: true
    });
  }

  /**
   * Get enemy ID from instance ID (for raycasting results)
   * @param {number} instanceId - The instanceId from a raycast hit
   * @return {string|null} The enemy ID or null if not found
   */
  getEnemyIdFromInstance(instanceId) {
    if (instanceId >= 0 && instanceId < this.activeCount) {
      return this.enemyData[instanceId].id;
    }
    return null;
  }

  /**
   * Update render target when window is resized
   * @param {number} width - New width
   * @param {number} height - New height
   */
  resize(width, height) {
    // Get window dimensions if not provided
    const container = document.getElementById('phone3d');
    width = width || (container ? container.clientWidth : window.innerWidth);
    height = height || (container ? container.clientHeight : window.innerHeight);
    
    // Resize render target
    this.backgroundRT.setSize(width, height);
    
    // Update shader uniforms if available
    if (this.customShader && this.customShader.uniforms) {
      // Update resolution uniform
      if (this.customShader.uniforms.resolution) {
        this.customShader.uniforms.resolution.value.set(width, height);
      }
    }
  }

  /**
   * Prepare for rendering - make particles invisible for background capture
   */
  prepareBackgroundCapture() {
    this.particleMesh.visible = false;
  }

  /**
   * Restore visibility after background capture
   */
  restoreAfterBackgroundCapture() {
    this.particleMesh.visible = true;
  }
  
  /**
   * Set the alpha (transparency) value for the inverted background effect
   * @param {number} alpha - Alpha value between 0.0 and 1.0
   */
  setAlpha(alpha) {
    this.alpha = Math.max(0, Math.min(1, alpha)); // Clamp between 0 and 1
    
    // Update the shader uniform 
    if (this.particleMesh.material.uniforms && this.particleMesh.material.uniforms.particleAlpha) {
      this.particleMesh.material.uniforms.particleAlpha.value = this.alpha;
    }
    
    return this.alpha;
  }

  /**
   * Remove all particle enemies
   */
  removeAll() {
    // Clone the enemy data to avoid issues during iteration
    const enemiesToRemove = [...this.enemyData].slice(0, this.activeCount);
    
    // Remove each enemy
    for (const enemy of enemiesToRemove) {
      this.eventBus.emit('entity:removed', {
        id: enemy.id,
        isEnemy: true
      });
    }
    
    // Reset all enemy states
    this.enemyData.forEach(enemy => {
      enemy.state = 'dead';
    });
    
    // Reset active count
    this.activeCount = 0;
    
    // Update the scene to reflect changes
    this.updateInstances();
  }
}
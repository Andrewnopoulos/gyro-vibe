import * as THREE from 'three';

/**
 * Manages a group of particle-based enemies using instanced rendering
 * for efficient display of many enemies simultaneously
 */
export class ParticleEnemyGroup {
  /**
   * @param {Object} options - Configuration options
   * @param {THREE.Scene} options.scene - Three.js scene
   * @param {EventBus} options.eventBus - Application event bus
   * @param {number} [options.maxEnemies=1000] - Maximum number of enemies to support
   */
  constructor(options) {
    this.scene = options.scene;
    this.eventBus = options.eventBus;
    this.maxEnemies = options.maxEnemies || 1000;
    this.activeCount = 0;

    // Initialize InstancedMesh
    const geometry = new THREE.SphereGeometry(0.3, 8, 8); // Simple shape for enemies
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ff00, // Green by default, will vary per instance
    });
    this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.maxEnemies);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.castShadow = true;
    this.instancedMesh.receiveShadow = true;
    this.instancedMesh.count = 0; // Start with no visible instances
    
    // Enable raycasting on the instanced mesh
    this.instancedMesh.frustumCulled = false; // Ensure all instances are considered for raycasting
    this.instancedMesh.name = 'particleEnemyGroup'; // Set name for easier identification
    
    // Add userData to identify this as a particle enemy group
    this.instancedMesh.userData = {
      isParticleEnemyGroup: true,
      particleEnemyGroupId: `particleGroup_${Math.random().toString(36).substr(2, 9)}`
    };
    
    // Enable instance color variations
    this.instancedMesh.material.vertexColors = true;
    this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(
      new Float32Array(this.maxEnemies * 3), 3
    );
    
    this.scene.add(this.instancedMesh);

    // Initialize enemy data array
    this.enemyData = Array.from({ length: this.maxEnemies }, (_, i) => ({
      id: `particle_enemy_${i}_${Math.random().toString(36).substr(2, 9)}`,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      health: 0,
      maxHealth: 5,
      state: 'dead', // 'alive', 'dying', 'dead'
      deathStartTime: 0,
    }));
    
    // Matrix and Object3D for position updates
    this.dummy = new THREE.Object3D();

    // Setup event listeners
    this.setupEventListeners();
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
    
    for (let i = 0; i < spawnCount; i++) {
      const index = this.findFreeSlot();
      if (index === -1) break; // No more free slots
      
      const enemy = this.enemyData[index];
      enemy.position.set(
        positions[i].x,
        positions[i].y,
        positions[i].z
      );
      
      // Add a small random velocity for movement
      enemy.velocity.set(
        (Math.random() - 0.5) * 0.02,
        (Math.random() - 0.5) * 0.01,
        (Math.random() - 0.5) * 0.02
      );
      
      enemy.health = enemy.maxHealth;
      enemy.state = 'alive';

      // Register with HealthManager
      this.eventBus.emit('entity:register', {
        id: enemy.id,
        health: enemy.health,
        maxHealth: enemy.maxHealth,
        isEnemy: true,
      });
    }
    
    this.updateInstances();
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
    let needsUpdate = false;
    
    for (let i = 0; i < this.activeCount; i++) {
      const enemy = this.enemyData[i];
      
      if (enemy.state === 'alive') {
        // Update position based on velocity
        enemy.position.x += enemy.velocity.x;
        enemy.position.y += enemy.velocity.y; 
        enemy.position.z += enemy.velocity.z;
        
        // Simple oscillation effect
        enemy.position.y += Math.sin(Date.now() * 0.001 + i) * 0.005;
        
        // Position the instance
        this.dummy.position.copy(enemy.position);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        
        // Update color based on health
        const healthPercent = enemy.health / enemy.maxHealth;
        const color = new THREE.Color().setHSL(healthPercent * 0.3, 1, 0.5);
        this.instancedMesh.setColorAt(i, color);
        
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
        
        // Scale down while dying
        this.dummy.position.copy(enemy.position);
        this.dummy.scale.setScalar(1 - progress);
        this.dummy.updateMatrix();
        this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        
        // Red color while dying
        const fadeColor = new THREE.Color(1, 0, 0);
        this.instancedMesh.setColorAt(i, fadeColor);
        
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
      this.instancedMesh.instanceMatrix.needsUpdate = true;
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
    
    // Update the visible count
    this.instancedMesh.count = this.activeCount;
  }

  /**
   * Update all instance matrices after changes
   */
  updateInstances() {
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
    
    const enemy = this.enemyData[index];
    enemy.state = 'dead';
    
    // If this is not the last active enemy, swap with the last one to keep array dense
    if (index < this.activeCount - 1) {
      // Copy the last active enemy to this slot
      this.enemyData[index] = this.enemyData[this.activeCount - 1];
      
      // Move the "removed" enemy to the end
      this.enemyData[this.activeCount - 1] = enemy;
      
      // Update the matrix and color for the swapped element
      const swappedEnemy = this.enemyData[index];
      this.dummy.position.copy(swappedEnemy.position);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.instancedMesh.setMatrixAt(index, this.dummy.matrix);
      
      const healthPercent = swappedEnemy.health / swappedEnemy.maxHealth;
      const color = new THREE.Color().setHSL(healthPercent * 0.3, 1, 0.5);
      this.instancedMesh.setColorAt(index, color);
    }
    
    // Decrease active count
    this.activeCount--;
    
    // Update instance data
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.instancedMesh.instanceColor.needsUpdate = true;
    this.instancedMesh.count = this.activeCount;
    
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
    
    // Reset active count and update mesh
    this.activeCount = 0;
    this.instancedMesh.count = 0;
    this.updateInstances();
  }
}
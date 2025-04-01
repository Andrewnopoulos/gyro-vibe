import { TrainingDummy } from './training-dummy.js';
import { ParticleEnemyGroup } from './particle-enemy-group.js';

/**
 * Manages all enemies in the game
 */
export class EnemyManager {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {THREE.Scene} scene - Three.js scene
   * @param {CANNON.World} world - Physics world
   */
  constructor(eventBus, scene, world) {
    this.eventBus = eventBus;
    this.scene = scene;
    this.world = world;
    this.enemies = new Map(); // Map of enemy ID -> enemy instance
    
    // Initialize particle enemy group for efficient rendering
    this.particleEnemyGroup = new ParticleEnemyGroup({
      scene: scene,
      eventBus: eventBus,
      maxEnemies: 1000
    });
    
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for scene updates to update enemies
    this.eventBus.on('scene:update', this.update.bind(this));
    
    // Listen for enemy death events to handle scoring/rewards
    this.eventBus.on('entity:death', this.handleEntityDeath.bind(this));
    
    // Listen for enemy removal to clean up references
    this.eventBus.on('entity:removed', this.handleEntityRemoved.bind(this));
    
    // Listen for spell damage events
    this.eventBus.on('spell:hit', this.handleSpellHit.bind(this));
    
    // Network synchronization events
    this.eventBus.on('enemy:spawn', this.handleEnemySpawn.bind(this));
    this.eventBus.on('enemy:update', this.handleEnemyUpdate.bind(this));
    this.eventBus.on('enemy:death', this.handleEnemyDeath.bind(this));
  }
  
  /**
   * Update all enemies
   * @param {Object} data - Update data containing delta time
   */
  update(data) {
    const { delta } = data;
    
    // Update each regular enemy
    this.enemies.forEach(enemy => {
      enemy.update(delta);
    });
    
    // Update particle enemies
    this.particleEnemyGroup.update(delta);
  }
  
  /**
   * Handle entity death events
   * @param {Object} data - Death event data
   */
  handleEntityDeath(data) {
    // Process only if it's an enemy and we have it registered
    if (data.isEnemy && this.enemies.has(data.id)) {
      const enemy = this.enemies.get(data.id);
      
      // Currently just logs the death - could trigger rewards, scores, etc.
      console.log(`Enemy ${enemy.type} has been defeated!`);
    }
  }
  
  /**
   * Handle entity removed events
   * @param {Object} data - Remove event data
   */
  handleEntityRemoved(data) {
    // Clean up reference when an enemy is fully removed
    if (data.isEnemy && this.enemies.has(data.id)) {
      this.enemies.delete(data.id);
    }
  }
  
  /**
   * Handle spell hit events and convert to damage
   * @param {Object} data - Spell hit data
   */
  handleSpellHit(data) {
    const { targetId, spellId, power, instanceId } = data;
    
    let finalTargetId = targetId;
    
    // If we have an instanceId but no targetId, get the particle enemy ID
    if (instanceId !== undefined && !targetId) {
      finalTargetId = this.particleEnemyGroup.getEnemyIdFromInstance(instanceId);
    }
    
    // Ignore if no valid target ID
    if (!finalTargetId) return;
    
    // Check if this is a regular enemy
    const isRegularEnemy = this.enemies.has(finalTargetId);
    
    // Calculate damage based on spell power
    const damage = power || 1;
    
    // Apply damage to the entity - both regular and particle enemies
    // will be handled by the HealthManager through event system
    this.eventBus.emit('entity:damage', {
      id: finalTargetId,
      amount: damage,
      damageType: 'spell',
      sourceId: spellId
    });
  }
  
  /**
   * Spawn training dummy enemies
   * @param {number} count - Number of dummies to spawn
   */
  spawnTrainingDummies(count = 1) {
    for (let i = 0; i < count; i++) {
      // Place dummies in a circle pattern around the center
      const angle = (Math.PI * 2 / count) * i;
      const radius = 10; // Distance from center
      
      const position = {
        x: Math.cos(angle) * radius,
        y: 1, // Just above the ground
        z: Math.sin(angle) * radius
      };
      
      this.spawnTrainingDummy(position);
    }
  }
  
  /**
   * Spawn a single training dummy at the specified position
   * @param {Object} position - Position {x, y, z} to spawn at
   * @return {TrainingDummy} The created dummy
   */
  spawnTrainingDummy(position) {
    const dummy = new TrainingDummy({
      scene: this.scene,
      world: this.world,
      eventBus: this.eventBus,
      position: position,
      health: 5 // Training dummies have 5 health
    });

    console.log("spawning a training dummy at", position);
    
    // Register the enemy
    this.enemies.set(dummy.id, dummy);
    
    return dummy;
  }
  
  /**
   * Spawn a group of particle-based enemies
   * @param {number} count - Number of enemies to spawn
   * @param {Array<{x:number, y:number, z:number}>} [positions] - Optional array of positions, or will generate positions
   * @return {number} Number of enemies actually spawned
   */
  spawnParticleEnemies(count = 100, positions = null) {
    // Generate positions if not provided
    if (!positions) {
      positions = [];
      const radius = 20; // Spawn area radius
      const heightVariation = 5; // Vertical spawning range
      
      for (let i = 0; i < count; i++) {
        // Random position in a circular area, with some height variation
        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * radius;
        
        positions.push({
          x: Math.cos(angle) * distance,
          y: 1 + Math.random() * heightVariation, // Start at least 1 unit above ground
          z: Math.sin(angle) * distance
        });
      }
    }
    
    // Ensure we have enough positions
    const spawnCount = Math.min(count, positions.length);
    
    // Spawn the enemies
    this.particleEnemyGroup.spawn(spawnCount, positions);
    
    console.log(`Spawned ${spawnCount} particle enemies`);
    return spawnCount;
  }
  
  /**
   * Remove all enemies
   */
  removeAllEnemies() {
    // Clone the keys to avoid modification during iteration
    const enemyIds = [...this.enemies.keys()];
    
    // Remove each enemy
    enemyIds.forEach(id => {
      const enemy = this.enemies.get(id);
      if (enemy) {
        enemy.remove();
      }
    });
    
    // Also remove any particle enemies
    this.particleEnemyGroup.removeAll();
  }
  
  /**
   * Get enemy by ID
   * @param {string} id - Enemy ID
   * @return {Enemy|null} The enemy or null if not found
   */
  getEnemy(id) {
    return this.enemies.get(id) || null;
  }
  
  /**
   * Get all enemies
   * @return {Array} Array of enemy instances
   */
  getAllEnemies() {
    return Array.from(this.enemies.values());
  }
  
  /**
   * Get enemy count
   * @return {number} Number of active enemies
   */
  getEnemyCount() {
    return this.enemies.size;
  }
  
  /**
   * Handle networked enemy spawn event
   * @param {Object} data - Enemy spawn data
   */
  handleEnemySpawn(data) {
    const { id, type, position, health, isNetworked } = data;
    
    // Check if we already have this enemy (prevent duplicates)
    if (this.enemies.has(id)) {
      console.log(`Enemy with ID ${id} already exists, updating instead of spawning`);
      this.handleEnemyUpdate({
        id,
        position,
        health,
        isNetworked
      });
      return;
    }
    
    // Spawn appropriate enemy type
    if (type === 'training-dummy' || !type) {
      // For networked enemies, create with the provided ID directly
      if (isNetworked) {
        const dummy = new TrainingDummy({
          scene: this.scene,
          world: this.world,
          eventBus: this.eventBus,
          position: position,
          health: health || 5,
          id: id, // Use the network-provided ID
          isNetworked: true,
          type: 'training-dummy'
        });
        
        // Register the enemy
        this.enemies.set(id, dummy);
        
        console.log(`Spawned networked training dummy with ID ${id} at position`, 
          position.x.toFixed(2), position.y.toFixed(2), position.z.toFixed(2));
      } else {
        // For local enemies, use the standard spawn method
        const dummy = this.spawnTrainingDummy(position);
        
        // Update health if provided
        if (health !== undefined) {
          dummy.setHealth(health);
        }
      }
    } else {
      console.warn(`Unknown enemy type: ${type} - cannot spawn`);
    }
  }
  
  /**
   * Handle networked enemy update event
   * @param {Object} data - Enemy update data
   */
  handleEnemyUpdate(data) {
    const { id, position, health, state, isNetworked } = data;
    
    // Only process networked updates
    if (!isNetworked) return;
    
    const enemy = this.enemies.get(id);
    if (!enemy) {
      console.warn(`Received update for non-existent enemy: ${id}`);
      // If we get an update for an enemy we don't have, spawn it
      this.handleEnemySpawn({
        id,
        type: 'training-dummy', // Default type
        position,
        health,
        isNetworked: true
      });
      return;
    }
    
    // Update position if provided
    if (position) {
      enemy.setPosition(position);
    }
    
    // Update health if provided
    if (health !== undefined) {
      enemy.setHealth(health);
    }
    
    // Update state if provided
    if (state) {
      enemy.setState(state);
    }
  }
  
  /**
   * Handle networked enemy death event
   * @param {Object} data - Enemy death data
   */
  handleEnemyDeath(data) {
    const { id, enemyId, killerPlayerId, isNetworked, reason } = data;
    
    // Use enemyId if provided (server format) otherwise use id (client format)
    const targetId = enemyId || id;
    
    // Handle both networked deaths and "enemy not found" cleanup cases
    if (!isNetworked && reason !== 'not_found') {
      return;
    }
    
    const enemy = this.enemies.get(targetId);
    
    // Special case: server couldn't find this enemy, so we should clean it up locally
    if (reason === 'not_found') {
      if (enemy) {
        console.log(`Cleaning up enemy ${targetId} that doesn't exist on server`);
        enemy.remove();
        this.enemies.delete(targetId);
      }
      return;
    }
    
    // Regular enemy death case
    if (!enemy) {
      console.warn(`Received death for non-existent enemy: ${targetId}`);
      return;
    }
    
    console.log(`Enemy ${targetId} killed by player ${killerPlayerId}`);
    
    // Trigger death animation and cleanup
    enemy.die();
  }
}
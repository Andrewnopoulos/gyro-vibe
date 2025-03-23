import { TrainingDummy } from './training-dummy.js';

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
  }
  
  /**
   * Update all enemies
   * @param {Object} data - Update data containing delta time
   */
  update(data) {
    const { delta } = data;
    
    // Update each enemy
    this.enemies.forEach(enemy => {
      enemy.update(delta);
    });
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
    const { targetId, spellId, power } = data;
    
    // Check if target is an enemy we're tracking
    if (targetId && this.enemies.has(targetId)) {
      // Calculate damage based on spell power
      const damage = power || 1;
      
      // Apply damage to the entity
      this.eventBus.emit('entity:damage', {
        id: targetId,
        amount: damage,
        damageType: 'spell',
        sourceId: spellId
      });
    }
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
}
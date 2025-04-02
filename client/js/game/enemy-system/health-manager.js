/**
 * Manages health and damage for entities in the game
 */
export class HealthManager {
  /**
   * @param {EventBus} eventBus - Application event bus
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.entities = new Map(); // Map of entity ID -> health data
    
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    // Listen for entity registration
    this.eventBus.on('entity:register', this.registerEntity.bind(this));
    
    // Listen for damage events
    this.eventBus.on('entity:damage', this.applyDamage.bind(this));
    
    // Listen for entity removal
    this.eventBus.on('entity:removed', this.removeEntity.bind(this));
  }
  
  /**
   * Register an entity with the health system
   * @param {Object} data - Entity data
   */
  registerEntity(data) {
    const { id, health = 100, maxHealth = 100, isEnemy = false } = data;
    
    // Register entity with health data
    this.entities.set(id, {
      currentHealth: health,
      maxHealth,
      isEnemy,
      isDead: false
    });
  }
  
  /**
   * Apply damage to an entity
   * @param {Object} data - Damage data
   */
  applyDamage(data) {
    const { id, amount, damageType = 'generic', sourceId } = data;
    
    // Verify entity exists
    if (!this.entities.has(id)) {
      console.warn(`Cannot damage entity ${id}: not registered with health system`);
      return;
    }
    
    // Get entity health data
    const entity = this.entities.get(id);
    
    // Skip if already dead
    if (entity.isDead) return;
    
    // Apply damage
    const previousHealth = entity.currentHealth;
    entity.currentHealth = Math.max(0, entity.currentHealth - amount);
    
    console.log(`Entity ${id} took ${amount} damage (${damageType}). Health: ${entity.currentHealth}/${entity.maxHealth}`);
    
    // Emit hit effect event
    this.eventBus.emit('entity:hit-effect', {
      id,
      damageAmount: amount,
      damageType,
      healthPercent: entity.currentHealth / entity.maxHealth
    });
    
    // Check for death
    if (previousHealth > 0 && entity.currentHealth <= 0) {
      entity.isDead = true;
      
      // Emit death event
      this.eventBus.emit('entity:death', {
        id,
        isEnemy: entity.isEnemy,
        killedBy: sourceId
      });
    }
  }
  
  /**
   * Remove an entity from the health system
   * @param {Object} data - Entity data with ID
   */
  removeEntity(data) {
    const { id } = data;
    if (this.entities.has(id)) {
      this.entities.delete(id);
    }
  }
  
  /**
   * Get health data for an entity
   * @param {string} id - Entity ID
   * @return {Object|null} Health data or null if not found
   */
  getEntityHealth(id) {
    return this.entities.get(id) || null;
  }
  
  /**
   * Get current health value for an entity
   * @param {string} id - Entity ID
   * @return {number|null} Current health or null if not found
   */
  getCurrentHealth(id) {
    const entity = this.entities.get(id);
    return entity ? entity.currentHealth : null;
  }
  
  /**
   * Check if an entity is dead
   * @param {string} id - Entity ID
   * @return {boolean} True if entity is dead or not found
   */
  isEntityDead(id) {
    const entity = this.entities.get(id);
    return !entity || entity.isDead;
  }
}
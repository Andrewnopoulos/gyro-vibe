import { Spell } from './spell.js';
import { ObjectSpawnerSpell } from './object-spawner-spell.js';
import { GravityGunSpell } from './gravity-gun-spell.js';
import { BlackHoleSpell } from './black-hole-spell.js';
import { LaserBeamSpell } from './laser-beam-spell.js';

/**
 * Registry for all available spells
 */
export class SpellRegistry {
  /**
   * @param {EventBus} eventBus - Application event bus
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.spells = [];
    this.spellsById = new Map();
    this.spellsByPage = new Map();
    this.spellsByShape = new Map();
    this.nextAvailablePage = 1; // Start at 1, page 0 is reserved for instructions
    
    // Initialize predefined spells
    this.registerDefaultSpells();
    
    // Listen for remote spell casts
    this.eventBus.on('spell:remote-cast', this.handleRemoteSpellCast.bind(this));
  }

  /**
   * Register a spell in the registry
   * @param {Spell} spell - Spell to register
   * @returns {boolean} Whether registration was successful
   */
  registerSpell(spell) {
    // Check for existing spell with same ID
    if (this.spellsById.has(spell.id)) {
      console.error(`Spell with ID ${spell.id} already exists`);
      return false;
    }
    
    // Check for existing spell on the same page
    if (this.spellsByPage.has(spell.page)) {
      console.error(`Page ${spell.page} already contains a spell`);
      return false;
    }
    
    // Add spell to collections
    this.spells.push(spell);
    this.spellsById.set(spell.id, spell);
    this.spellsByPage.set(spell.page, spell);
    
    // Index by shape for faster lookup
    if (!this.spellsByShape.has(spell.shape)) {
      this.spellsByShape.set(spell.shape, []);
    }
    this.spellsByShape.get(spell.shape).push(spell);
    
    // Update next available page
    this.nextAvailablePage = Math.max(this.nextAvailablePage, spell.page + 1);
    
    return true;
  }

  /**
   * Register a new spell with auto-assigned page number
   * @param {Object} spellOptions - Options for the spell
   * @returns {Spell} The registered spell
   */
  createSpell(spellOptions) {
    // Auto-assign page number if not provided
    if (spellOptions.page === undefined) {
      spellOptions.page = this.nextAvailablePage;
    }
    
    const spell = new Spell(spellOptions);
    this.registerSpell(spell);
    return spell;
  }

  /**
   * Get all registered spells
   * @returns {Array<Spell>} Array of spells
   */
  getAllSpells() {
    return [...this.spells];
  }

  /**
   * Get spell by ID
   * @param {string} id - Spell ID
   * @returns {Spell|null} The spell or null if not found
   */
  getSpellById(id) {
    return this.spellsById.get(id) || null;
  }

  /**
   * Get spell by page number
   * @param {number} page - Page number
   * @returns {Spell|null} The spell or null if not found
   */
  getSpellByPage(page) {
    return this.spellsByPage.get(page) || null;
  }

  /**
   * Get spells by shape
   * @param {string} shape - Shape name (circle, triangle, etc.)
   * @returns {Array<Spell>} Array of spells with the given shape
   */
  getSpellsByShape(shape) {
    return this.spellsByShape.get(shape) || [];
  }

  /**
   * Get total number of pages including instruction page
   * @returns {number} Total number of pages
   */
  getTotalPages() {
    return this.nextAvailablePage;
  }

  /**
   * Register default spells
   */
  registerDefaultSpells() {
    // Object Spawner Spell
    const objectSpawnerSpell = new ObjectSpawnerSpell({
      eventBus: this.eventBus,
      page: 1,
      cooldown: 2
    });
    this.registerSpell(objectSpawnerSpell);
    
    // Gravity Gun Spell
    const gravityGunSpell = new GravityGunSpell({
      eventBus: this.eventBus,
      page: 2,
      cooldown: 0.5
    });
    this.registerSpell(gravityGunSpell);
    
    // Black Hole Spell
    const blackHoleSpell = new BlackHoleSpell({
      eventBus: this.eventBus,
      page: 3,
      cooldown: 10, // Longer cooldown for this powerful spell
      duration: 10,  // How long the black hole lasts
      strength: 12  // Gravitational strength
    });
    this.registerSpell(blackHoleSpell);
    
    // Laser Beam Spell
    const laserBeamSpell = new LaserBeamSpell({
      eventBus: this.eventBus,
      page: 4,
      cooldown: 0 // No cooldown as specified
    });
    this.registerSpell(laserBeamSpell);
  }

  /**
   * Generate instruction page texture
   * @param {CanvasRenderingContext2D} context - Canvas context to draw on
   * @param {boolean} isLeftPage - Whether this is the left page
   */
  /**
   * Get the main scene for visual effects
   * @returns {THREE.Scene|null} The main scene or null if not available
   */
  getMainScene() {
    let scene = null;
    this.eventBus.emit('scene:get-scene', (sceneObj) => {
      scene = sceneObj;
    });
    return scene;
  }
  
  /**
   * Get the main camera for proper positioning
   * @returns {THREE.Camera|null} The main camera or null if not available
   */
  getMainCamera() {
    let camera = null;
    this.eventBus.emit('scene:get-camera', (cameraObj) => {
      camera = cameraObj;
    });
    return camera;
  }

  /**
   * Handle remote spell cast from another player
   * @param {Object} data - Remote spell cast data
   */
  handleRemoteSpellCast(data) {
    const { playerId, spellId, targetPosition, targetId, cameraPosition, targetDirection } = data;
    
    // Get the spell by ID
    const spell = this.getSpellById(spellId);
    if (!spell) {
      console.error(`Received remote cast for unknown spell: ${spellId}`);
      return;
    }
    
    // Find remote player model if available
    let remotePlayerModel = null;
    this.eventBus.emit('multiplayer:get-player', playerId, (player) => {
      remotePlayerModel = player;
    });
    
    // Get accurate player position and direction data if not provided in the event
    let accuratePosition = cameraPosition;
    let accurateDirection = targetDirection;
    
    if (!accuratePosition || !accurateDirection) {
      // Try to get position from GameStateManager
      this.eventBus.emit('multiplayer:get-player-position', playerId, (position) => {
        if (position) {
          accuratePosition = {
            x: position.x,
            y: position.y,
            z: position.z
          };
          console.log(`Got player position from GameStateManager: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
        }
      });
      
      // Try to get direction from GameStateManager
      this.eventBus.emit('multiplayer:get-player-direction', playerId, (direction) => {
        if (direction) {
          accurateDirection = {
            x: direction.x,
            y: direction.y,
            z: direction.z
          };
          console.log(`Got player direction from GameStateManager: (${direction.x.toFixed(2)}, ${direction.y.toFixed(2)}, ${direction.z.toFixed(2)})`);
        }
      });
    }
    
    // Create context with the required information
    const context = {
      eventBus: this.eventBus,
      targetPosition,
      targetId,
      // Get the main scene for visual effects
      scene: this.getMainScene(),
      // Get main camera for proper positioning
      camera: this.getMainCamera(),
      // Mark as a remote cast
      isRemote: true,
      // Include the remote player's ID and model information
      remotePlayerId: playerId,
      remotePlayerModel: remotePlayerModel,
      // Add camera position and direction from remote player for accurate positioning
      // Prioritize network-provided data, then fall back to GameStateManager data
      cameraPosition: accuratePosition,
      targetDirection: accurateDirection
      // Other context properties will be added by the specific spell implementation
    };
    
    spell.remotecast(data, context);
    
    // Emit an event for UI feedback
    this.eventBus.emit('ui:remote-spell-cast', {
      playerId,
      spellId,
      spellName: spell.name
    });
  }
  
  /**
   * Generate instruction page texture
   * @param {CanvasRenderingContext2D} context - Canvas context to draw on
   * @param {boolean} isLeftPage - Whether this is the left page
   */
  generateInstructionPageTexture(context, isLeftPage) {
    const width = context.canvas.width;
    const height = context.canvas.height;
    const margin = 25;
    
    // Clear canvas with parchment color
    context.fillStyle = '#f5f5dc';
    context.fillRect(0, 0, width, height);
    
    if (isLeftPage) {
      // Draw title
      context.font = 'bold 40px serif';
      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.fillStyle = '#8B4513';
      context.fillText('Spellbook', width / 2, margin);
      
      // Draw decorative line
      context.strokeStyle = '#8B4513';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(margin, margin + 60);
      context.lineTo(width - margin, margin + 60);
      context.stroke();
      
      // Draw instructions heading
      context.font = 'bold 28px serif';
      context.textAlign = 'center';
      context.fillText('Instructions', width / 2, margin + 80);
      
      // Draw basic instructions
      context.font = '22px serif';
      context.textAlign = 'left';
      context.fillStyle = '#000000';
      
      const instructions = [
        'Welcome, wizard!',
        '',
        '- Use Q/E keys to turn pages',
        '- Use Space to use spells',
        '- Each page contains a different spell',
        '- Try out the object spawner, gravity gun,',
        '  black hole and Zoltraak',
        '',
        'Start your journey on the next page...'
      ];
      
      let y = margin + 130;
      for (const line of instructions) {
        context.fillText(line, margin, y);
        y += 30;
      }
      
      // Draw a simple illustration of available spells at the bottom
      context.strokeStyle = '#8B4513';
      context.lineWidth = 3;
      
      // Object spawner illustration
      context.beginPath();
      context.rect(width / 2 - 60, height - 120, 40, 40);
      context.stroke();
      context.font = '22px serif';
      context.textAlign = 'center';
      context.fillText('Object', width / 2 - 40, height - 60);
      
      // Gravity Gun illustration
      context.beginPath();
      context.moveTo(width / 2 + 20, height - 120);
      context.lineTo(width / 2 + 60, height - 120);
      context.lineTo(width / 2 + 60, height - 90);
      context.lineTo(width / 2 + 40, height - 80);
      context.lineTo(width / 2 + 20, height - 90);
      context.closePath();
      context.stroke();
      context.fillText('Gravity', width / 2 + 40, height - 60);
      
    } else {
      // Right page - image or additional instructions
      
      // Draw heading
      context.font = 'bold 32px serif';
      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.fillStyle = '#8B4513';
      context.fillText('Spell Usage Tips', width / 2, margin);
      
      // Draw decorative line
      context.strokeStyle = '#8B4513';
      context.lineWidth = 3;
      context.beginPath();
      context.moveTo(margin, margin + 50);
      context.lineTo(width - margin, margin + 50);
      context.stroke();
      
      // Draw additional tips
      context.font = '22px serif';
      context.textAlign = 'left';
      context.fillStyle = '#000000';
      
      const tips = [
        '1. Object Spawner: Creates random objects',
        '2. Gravity Gun: Pick up and throw objects',
        '3. Black Hole: Creates a gravity well',
        '4. Laser Beam: Damages enemies in its path',
        '5. Use Space to activate the current spell',
        '6. Objects interact with physics',
        '',
        'Cast on the correct page:',
        'Each spell requires its specific page',
        'to be open when casting'
      ];
      
      let y = margin + 70;
      for (const tip of tips) {
        context.fillText(tip, margin, y);
        y += 30;
      }
      
      // Draw page number
      context.font = 'bold 20px serif';
      context.textAlign = 'right';
      context.textBaseline = 'bottom';
      context.fillStyle = '#8B4513';
      context.fillText('Page 0', width - 20, height - 20);
    }
  }
}
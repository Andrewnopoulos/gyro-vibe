import { Spell } from './spell.js';
import { CircleSpell } from './circle-spell.js';
import { TriangleSpell } from './triangle-spell.js';
import { ObjectSpawnerSpell } from './object-spawner-spell.js';
import { GravityGunSpell } from './gravity-gun-spell.js';
import { BlackHoleSpell } from './black-hole-spell.js';

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
    // Shield Spell
    const shieldSpell = new CircleSpell({
      eventBus: this.eventBus,
      page: 1,
      duration: 8,
      cooldown: 10
    });
    this.registerSpell(shieldSpell);

    // Fireball Spell
    const fireballSpell = new TriangleSpell({
      eventBus: this.eventBus,
      page: 2,
      power: 5,
      cooldown: 5
    });
    this.registerSpell(fireballSpell);
    
    // Object Spawner Spell
    const objectSpawnerSpell = new ObjectSpawnerSpell({
      eventBus: this.eventBus,
      page: 3,
      cooldown: 2
    });
    this.registerSpell(objectSpawnerSpell);
    
    // Gravity Gun Spell
    const gravityGunSpell = new GravityGunSpell({
      eventBus: this.eventBus,
      page: 4,
      cooldown: 0.5
    });
    this.registerSpell(gravityGunSpell);
    
    // Black Hole Spell
    const blackHoleSpell = new BlackHoleSpell({
      eventBus: this.eventBus,
      page: 5,
      cooldown: 10, // Longer cooldown for this powerful spell
      duration: 3,  // How long the black hole lasts
      strength: 12  // Gravitational strength
    });
    this.registerSpell(blackHoleSpell);
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
        'Welcome, apprentice mage!',
        '',
        '- Use Q/E keys to turn pages',
        '- Draw shapes on mobile device',
        '- Match the spell\'s shape to cast',
        '- Each page contains a different spell',
        '',
        'Start your journey on the next page...'
      ];
      
      let y = margin + 130;
      for (const line of instructions) {
        context.fillText(line, margin, y);
        y += 30;
      }
      
      // Draw small circle and triangle as examples at the bottom
      context.strokeStyle = '#8B4513';
      context.lineWidth = 3;
      
      // Circle example
      context.beginPath();
      context.arc(width / 3, height - 120, 40, 0, Math.PI * 2);
      context.stroke();
      context.font = '22px serif';
      context.fillText('Circle', width / 3, height - 60);
      
      // Triangle example
      const triangleY = height - 120;
      context.beginPath();
      context.moveTo(width * 2/3, triangleY - 40);
      context.lineTo(width * 2/3 - 40, triangleY + 30);
      context.lineTo(width * 2/3 + 40, triangleY + 30);
      context.closePath();
      context.stroke();
      context.fillText('Triangle', width * 2/3, height - 60);
      
    } else {
      // Right page - image or additional instructions
      
      // Draw heading
      context.font = 'bold 32px serif';
      context.textAlign = 'center';
      context.textBaseline = 'top';
      context.fillStyle = '#8B4513';
      context.fillText('Shape Recognition Tips', width / 2, margin);
      
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
        '1. Draw shapes clearly and deliberately',
        '2. Make sure to close your shapes',
        '3. Try to maintain consistent size',
        '4. Draw in the center of the screen',
        '5. Practice makes perfect!',
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
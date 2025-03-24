import { Spell } from './spell.js';

/**
 * GravityGunSpell - Controls gravity gun interactions
 */
export class GravityGunSpell extends Spell {
  /**
   * @param {Object} options - Spell configuration options
   * @param {EventBus} options.eventBus - Event bus for communication
   * @param {number} options.page - Page number in the spellbook
   * @param {number} [options.cooldown=0.5] - Cooldown time in seconds
   */
  constructor(options) {
    super({
      id: 'gravityGun',
      name: 'Gravity Control',
      shape: 'space', // Special shape triggered by space bar
      description: 'Control physical objects with your mind. Press SPACE to pick up or drop objects.',
      page: options.page,
      cooldown: options.cooldown || 0.5,
      visualOptions: {
        strokeColor: '#8B4513',
        lineWidth: 3
      },
      effectKeyDown: (context) => this.toggleGravityGun(context)
    });

    this.eventBus = options.eventBus;
    this.isHolding = false;
    
    // Listen for physics events to keep our state synchronized
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners to keep track of physics state
   */
  setupEventListeners() {
    // Listen for physics events to update our holding state
    this.eventBus.on('physics:object-pickup', (data) => {
      if (data.playerId === 'local') {
        this.isHolding = true;
      }
    });
    
    this.eventBus.on('physics:object-drop', (data) => {
      if (data.playerId === 'local') {
        this.isHolding = false;
      }
    });
  }

  /**
   * Toggle gravity gun pickup/drop
   * @param {Object} context - Casting context
   */
  toggleGravityGun(context) {
    // Get current holdingObject state from the physics system
    let physicsIsHolding = false;
    
    // Check if something is actually being held in the physics system
    this.eventBus.emit('physics:request-manager', (physicsManager) => {
      if (physicsManager && physicsManager.heldBody) {
        physicsIsHolding = true;
      }
    });
    
    // If something is being held, drop it
    if (physicsIsHolding) {
      this.eventBus.emit('gravity-gun:action-drop');
      this.isHolding = false; // Update our state
      
      // Play release sound
      this.eventBus.emit('audio:play', { 
        sound: 'gravityRelease', 
        volume: 0.7
      });
    } else {
      // Not holding anything, attempt to pick up
      this.eventBus.emit('gravity-gun:action-pickup');
      
      // We'll update isHolding in the event listener after we know if pickup was successful
      // But play the capture sound anyway since it's a good feedback for casting the spell
      this.eventBus.emit('audio:play', { 
        sound: 'gravityCapture', 
        volume: 0.7
      });
    }
  }
  
  /**
   * Override draw shape to show a custom graphic for space bar trigger
   * @param {CanvasRenderingContext2D} context - Canvas context
   */
  drawShape(context) {
    const width = context.canvas.width;
    const height = context.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Clear canvas
    context.fillStyle = '#f5f5dc'; // Beige parchment color
    context.fillRect(0, 0, width, height);
    
    // Draw a space bar icon
    context.strokeStyle = this.visualOptions.strokeColor || '#8B4513';
    context.lineWidth = this.visualOptions.lineWidth || 3;
    
    // Draw space bar rectangle
    const barWidth = width * 0.5;
    const barHeight = height * 0.12;
    context.beginPath();
    context.roundRect(centerX - barWidth/2, centerY + 50, barWidth, barHeight, 10);
    context.stroke();
    
    // Label the space bar
    context.font = 'bold 24px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#8B4513';
    context.fillText('SPACE', centerX, centerY + 50 + barHeight/2);
    
    // Draw gravity beam icon
    this.drawGravityBeam(context, centerX, centerY - 50);
    
    // Draw page number
    context.font = 'bold 20px serif';
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillStyle = '#8B4513';
    context.fillText(`Page ${this.page}`, 20, height - 20);
  }
  
  /**
   * Draw gravity beam illustration
   * @param {CanvasRenderingContext2D} context - Canvas context
   * @param {number} centerX - Center X position
   * @param {number} centerY - Center Y position
   */
  drawGravityBeam(context, centerX, centerY) {
    // Draw "hand" emitting the beam
    context.fillStyle = '#8B4513';
    context.beginPath();
    context.arc(centerX, centerY + 80, 20, 0, Math.PI * 2);
    context.fill();
    
    // Draw beam
    const gradient = context.createLinearGradient(centerX, centerY + 80, centerX, centerY - 80);
    gradient.addColorStop(0, 'rgba(0, 170, 255, 0.8)');
    gradient.addColorStop(1, 'rgba(0, 170, 255, 0.2)');
    
    context.fillStyle = gradient;
    
    // Draw the beam as a rectangle with rounded ends
    context.beginPath();
    context.moveTo(centerX - 5, centerY + 80);
    context.lineTo(centerX - 5, centerY - 80);
    context.lineTo(centerX + 5, centerY - 80);
    context.lineTo(centerX + 5, centerY + 80);
    context.closePath();
    context.fill();
    
    // Draw little circles along the beam for effect
    context.fillStyle = 'rgba(255, 255, 255, 0.8)';
    for (let y = centerY + 70; y > centerY - 80; y -= 20) {
      const radius = 2 + Math.random() * 2;
      const xOffset = (Math.random() - 0.5) * 6;
      context.beginPath();
      context.arc(centerX + xOffset, y, radius, 0, Math.PI * 2);
      context.fill();
    }
    
    // Draw the object being affected
    context.fillStyle = '#666';
    context.strokeStyle = '#333';
    context.lineWidth = 2;
    
    context.beginPath();
    const objectSize = 40;
    context.rect(centerX - objectSize/2, centerY - 120, objectSize, objectSize);
    context.fill();
    context.stroke();
    
    // Draw levitation effect around the object
    context.strokeStyle = 'rgba(0, 170, 255, 0.6)';
    context.lineWidth = 1.5;
    
    // Draw circular aura
    for (let i = 0; i < 2; i++) {
      const radius = objectSize/2 + 10 + i * 10;
      context.beginPath();
      context.arc(centerX, centerY - 100, radius, 0, Math.PI * 2);
      context.stroke();
    }
  }
  
  /**
   * Override the description page
   * @param {CanvasRenderingContext2D} context - Canvas context
   */
  drawDescription(context) {
    const width = context.canvas.width;
    const height = context.canvas.height;
    const margin = 30;
    
    // Clear canvas
    context.fillStyle = '#f5f5dc'; // Beige parchment color
    context.fillRect(0, 0, width, height);
    
    // Draw spell name
    context.font = 'bold 32px serif';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#8B4513';
    context.fillText(this.name, width / 2, margin);
    
    // Draw horizontal divider
    context.strokeStyle = '#8B4513';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(margin, margin + 50);
    context.lineTo(width - margin, margin + 50);
    context.stroke();
    
    // Draw description - with word wrapping
    context.font = '24px serif';
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillStyle = '#000000';
    
    this.wrapText(
      context,
      this.description,
      margin,
      margin + 70,
      width - (margin * 2),
      32
    );
    
    // Draw additional instructions
    const instructions = 'Aim at physical objects to grab them with your gravity beam. ' +
      'Once grabbed, you can move objects by moving your wand. ' +
      'Press SPACE again to release the object.';
    
    this.wrapText(
      context,
      instructions,
      margin,
      margin + 180,
      width - (margin * 2),
      32
    );
    
    // Draw key binding at the bottom
    context.font = 'bold 24px serif';
    context.fillStyle = '#8B4513';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.fillText('Press SPACE key to grab/release', width / 2, height - margin - 30);
    
    // Draw space bar shape hint
    context.beginPath();
    const barWidth = width * 0.3;
    const barHeight = height * 0.06;
    context.roundRect(width/2 - barWidth/2, height - margin - 30 + 10, barWidth, barHeight, 10);
    context.stroke();
    
    // Draw page number
    context.font = 'bold 20px serif';
    context.textAlign = 'right';
    context.textBaseline = 'bottom';
    context.fillText(`Page ${this.page}`, width - 20, height - 20);
  }
}
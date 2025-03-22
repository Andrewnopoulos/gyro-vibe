import { Spell } from './spell.js';
import { SpellEffects } from './spell-effects.js';

/**
 * Shield spell created using the circle shape
 */
export class CircleSpell extends Spell {
  /**
   * @param {Object} options - Spell configuration options
   */
  constructor(options = {}) {
    super({
      id: options.id || 'shield',
      name: options.name || 'Arcane Shield',
      shape: 'circle',
      description: options.description || 
        'Conjures a magical shield that protects against harmful effects. The shield absorbs damage and lasts for several seconds.',
      page: options.page || 1,
      effect: (context) => this.castEffect(context),
      visualOptions: options.visualOptions || {
        strokeColor: '#00AAFF',
        lineWidth: 4
      },
      cooldown: options.cooldown || 10
    });
    
    this.eventBus = options.eventBus;
    this.duration = options.duration || 8;
    this.activeEffect = null;
  }

  /**
   * Cast the shield effect
   * @param {Object} context - Casting context
   */
  castEffect(context) {
    // Clear any existing effect
    if (this.activeEffect) {
      this.activeEffect.cleanup();
      this.activeEffect = null;
    }
    
    // Create new shield effect
    const effect = SpellEffects.createShield(context, {
      duration: this.duration,
      color: 0x00AAFF
    });
    
    this.activeEffect = effect;
    
    // Emit event for other systems to react
    if (this.eventBus) {
      this.eventBus.emit('spell:shield-cast', { 
        duration: this.duration,
        spellId: this.id
      });
    }
    
    console.log(`Shield spell cast with duration ${this.duration}s`);
    
    // Return a cleanup function
    return () => {
      if (this.activeEffect) {
        this.activeEffect.cleanup();
        this.activeEffect = null;
      }
    };
  }

  /**
   * Draw the shield shape on the spellbook page
   * @param {CanvasRenderingContext2D} context - Canvas context
   */
  drawShape(context) {
    const width = context.canvas.width;
    const height = context.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;
    
    // Clear canvas with parchment background
    context.fillStyle = '#f5f5dc';
    context.fillRect(0, 0, width, height);
    
    // Draw circle
    context.strokeStyle = this.visualOptions.strokeColor || '#00AAFF';
    context.lineWidth = this.visualOptions.lineWidth || 4;
    context.beginPath();
    context.arc(centerX, centerY, radius, 0, Math.PI * 2);
    context.stroke();
    
    // Add glow effect
    const gradient = context.createRadialGradient(
      centerX, centerY, radius * 0.7,
      centerX, centerY, radius * 1.3
    );
    gradient.addColorStop(0, 'rgba(0, 170, 255, 0.0)');
    gradient.addColorStop(0.5, 'rgba(0, 170, 255, 0.1)');
    gradient.addColorStop(1, 'rgba(0, 170, 255, 0.0)');
    
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(centerX, centerY, radius * 1.3, 0, Math.PI * 2);
    context.fill();
    
    // Draw shield icon in center
    this.drawShieldIcon(context, centerX, centerY, radius * 0.5);
    
    // Add rune markings around the circle
    this.drawRuneMarkings(context, centerX, centerY, radius);
    
    // Draw title
    context.font = 'bold 24px serif';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#00478F';
    context.fillText('Shield Spell', centerX, 30);
    
    // Draw page number
    context.font = '16px serif';
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillStyle = '#8B4513';
    context.fillText(`Page ${this.page}`, 20, height - 20);
  }

  /**
   * Draw a shield icon
   * @param {CanvasRenderingContext2D} context - Canvas context
   * @param {number} x - Center X coordinate
   * @param {number} y - Center Y coordinate
   * @param {number} size - Size of the icon
   */
  drawShieldIcon(context, x, y, size) {
    // Save context state
    context.save();
    
    // Shield outline
    context.strokeStyle = '#00478F';
    context.lineWidth = 2;
    context.beginPath();
    
    // Medieval shield shape
    context.moveTo(x, y - size);
    context.lineTo(x + size * 0.7, y - size * 0.5);
    context.lineTo(x + size * 0.7, y + size * 0.5);
    context.quadraticCurveTo(x, y + size * 1.2, x - size * 0.7, y + size * 0.5);
    context.lineTo(x - size * 0.7, y - size * 0.5);
    context.closePath();
    
    // Fill with gradient
    const gradient = context.createLinearGradient(
      x - size, y, x + size, y
    );
    gradient.addColorStop(0, '#4D88C4');
    gradient.addColorStop(0.5, '#78B5ED');
    gradient.addColorStop(1, '#4D88C4');
    
    context.fillStyle = gradient;
    context.fill();
    context.stroke();
    
    // Add emblem
    context.beginPath();
    context.arc(x, y, size * 0.4, 0, Math.PI * 2);
    context.strokeStyle = '#00478F';
    context.lineWidth = 1;
    context.stroke();
    
    // Restore context state
    context.restore();
  }

  /**
   * Draw rune markings around the circle
   * @param {CanvasRenderingContext2D} context - Canvas context
   * @param {number} centerX - Center X coordinate
   * @param {number} centerY - Center Y coordinate
   * @param {number} radius - Circle radius
   */
  drawRuneMarkings(context, centerX, centerY, radius) {
    context.save();
    
    context.strokeStyle = '#00478F';
    context.lineWidth = 1;
    
    // Draw several rune symbols around the circle
    const runeCount = 8;
    for (let i = 0; i < runeCount; i++) {
      const angle = (i / runeCount) * Math.PI * 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;
      
      context.save();
      context.translate(x, y);
      context.rotate(angle + Math.PI / 2);
      
      // Draw simple rune symbol
      context.beginPath();
      context.moveTo(-10, -5);
      context.lineTo(0, -15);
      context.lineTo(10, -5);
      context.lineTo(0, 15);
      context.closePath();
      context.stroke();
      
      context.restore();
    }
    
    context.restore();
  }

  /**
   * Draw spell description
   * @param {CanvasRenderingContext2D} context - Canvas context
   */
  drawDescription(context) {
    const width = context.canvas.width;
    const height = context.canvas.height;
    const margin = 30;
    
    // Clear canvas with parchment background
    context.fillStyle = '#f5f5dc';
    context.fillRect(0, 0, width, height);
    
    // Draw spell name
    context.font = 'bold 24px serif';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#00478F';
    context.fillText(this.name, width / 2, margin);
    
    // Draw horizontal divider
    context.strokeStyle = '#00478F';
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(margin, margin + 40);
    context.lineTo(width - margin, margin + 40);
    context.stroke();
    
    // Draw description
    context.font = '18px serif';
    context.textAlign = 'left';
    context.textBaseline = 'top';
    context.fillStyle = '#000000';
    
    this.wrapText(
      context,
      this.description,
      margin,
      margin + 60,
      width - (margin * 2),
      24
    );
    
    // Draw cooldown info
    context.font = '16px serif';
    context.fillStyle = '#00478F';
    context.fillText(`Cooldown: ${this.cooldown} seconds`, margin, height - 100);
    context.fillText(`Duration: ${this.duration} seconds`, margin, height - 75);
    
    // Draw "How to Cast" section
    context.font = 'italic 18px serif';
    context.fillStyle = '#8B4513';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.fillText(`Cast with ${this.shape} shape`, width / 2, height - margin - 20);
    
    // Draw small circle symbol
    context.beginPath();
    context.arc(width / 2, height - margin - 40, 15, 0, Math.PI * 2);
    context.strokeStyle = '#00478F';
    context.lineWidth = 2;
    context.stroke();
    
    // Draw page number
    context.font = '16px serif';
    context.textAlign = 'right';
    context.textBaseline = 'bottom';
    context.fillStyle = '#8B4513';
    context.fillText(`Page ${this.page}`, width - 20, height - 20);
  }
}
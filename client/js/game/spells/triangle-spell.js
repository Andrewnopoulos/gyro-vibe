import { Spell } from './spell.js';
import { SpellEffects } from './spell-effects.js';

/**
 * Fireball spell created using the triangle shape
 */
export class TriangleSpell extends Spell {
  /**
   * @param {Object} options - Spell configuration options
   */
  constructor(options = {}) {
    super({
      id: options.id || 'fireball',
      name: options.name || 'Fireball',
      shape: 'triangle',
      description: options.description || 
        'Launches a searing ball of fire that damages enemies and can ignite flammable objects in its path.',
      page: options.page || 2,
      effect: (context) => this.castEffect(context),
      visualOptions: options.visualOptions || {
        strokeColor: '#FF5500',
        lineWidth: 4
      },
      cooldown: options.cooldown || 5
    });
    
    this.eventBus = options.eventBus;
    this.power = options.power || 5;
    this.activeEffect = null;
  }

  /**
   * Cast the fireball effect
   * @param {Object} context - Casting context
   */
  castEffect(context) {
    // Clear any existing effect
    if (this.activeEffect) {
      this.activeEffect.cleanup();
      this.activeEffect = null;
    }
    
    // Create new fireball effect
    const effect = SpellEffects.createFireball(context, {
      power: this.power
    });
    
    this.activeEffect = effect;
    
    // Emit event for other systems to react
    if (this.eventBus) {
      this.eventBus.emit('spell:fireball-cast', { 
        power: this.power,
        spellId: this.id
      });
    }
    
    console.log(`Fireball spell cast with power ${this.power}`);
    
    // Return a cleanup function
    return () => {
      if (this.activeEffect) {
        this.activeEffect.cleanup();
        this.activeEffect = null;
      }
    };
  }

  /**
   * Draw the triangle shape on the spellbook page
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
    
    // Draw triangle
    const triangleHeight = radius * Math.sqrt(3);
    context.strokeStyle = this.visualOptions.strokeColor || '#FF5500';
    context.lineWidth = this.visualOptions.lineWidth || 4;
    
    context.beginPath();
    context.moveTo(centerX, centerY - radius);
    context.lineTo(centerX - radius, centerY + triangleHeight/2);
    context.lineTo(centerX + radius, centerY + triangleHeight/2);
    context.closePath();
    context.stroke();
    
    // Add glow effect
    const gradient = context.createRadialGradient(
      centerX, centerY, radius * 0.7,
      centerX, centerY, radius * 1.3
    );
    gradient.addColorStop(0, 'rgba(255, 85, 0, 0.0)');
    gradient.addColorStop(0.5, 'rgba(255, 85, 0, 0.1)');
    gradient.addColorStop(1, 'rgba(255, 85, 0, 0.0)');
    
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(centerX, centerY, radius * 1.3, 0, Math.PI * 2);
    context.fill();
    
    // Draw fire icon in center
    this.drawFireIcon(context, centerX, centerY, radius * 0.5);
    
    // Add rune markings inside the triangle
    this.drawRuneMarkings(context, centerX, centerY, radius);
    
    // Draw title
    context.font = 'bold 24px serif';
    context.textAlign = 'center';
    context.textBaseline = 'top';
    context.fillStyle = '#8B2500';
    context.fillText('Fireball Spell', centerX, 30);
    
    // Draw page number
    context.font = '16px serif';
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillStyle = '#8B4513';
    context.fillText(`Page ${this.page}`, 20, height - 20);
  }

  /**
   * Draw a fire icon
   * @param {CanvasRenderingContext2D} context - Canvas context
   * @param {number} x - Center X coordinate
   * @param {number} y - Center Y coordinate
   * @param {number} size - Size of the icon
   */
  drawFireIcon(context, x, y, size) {
    // Save context state
    context.save();
    
    // Create flame shapes
    context.beginPath();
    
    // Main flame
    context.moveTo(x, y - size);
    context.quadraticCurveTo(x + size * 0.5, y - size * 0.5, x + size * 0.2, y);
    context.quadraticCurveTo(x + size * 0.8, y, x + size * 0.3, y + size * 0.6);
    context.quadraticCurveTo(x, y + size * 0.3, x - size * 0.3, y + size * 0.6);
    context.quadraticCurveTo(x - size * 0.8, y, x - size * 0.2, y);
    context.quadraticCurveTo(x - size * 0.5, y - size * 0.5, x, y - size);
    
    // Fill with gradient
    const gradient = context.createLinearGradient(
      x, y - size, x, y + size * 0.6
    );
    gradient.addColorStop(0, '#FFCC00');
    gradient.addColorStop(0.5, '#FF6600');
    gradient.addColorStop(1, '#CC3300');
    
    context.fillStyle = gradient;
    context.fill();
    
    // Inner flame
    context.beginPath();
    context.moveTo(x, y - size * 0.7);
    context.quadraticCurveTo(x + size * 0.3, y - size * 0.3, x + size * 0.1, y);
    context.quadraticCurveTo(x + size * 0.4, y + size * 0.1, x, y + size * 0.3);
    context.quadraticCurveTo(x - size * 0.4, y + size * 0.1, x - size * 0.1, y);
    context.quadraticCurveTo(x - size * 0.3, y - size * 0.3, x, y - size * 0.7);
    
    const innerGradient = context.createLinearGradient(
      x, y - size * 0.7, x, y + size * 0.3
    );
    innerGradient.addColorStop(0, '#FFFFAA');
    innerGradient.addColorStop(1, '#FFCC00');
    
    context.fillStyle = innerGradient;
    context.fill();
    
    // Restore context state
    context.restore();
  }

  /**
   * Draw rune markings for the triangle
   * @param {CanvasRenderingContext2D} context - Canvas context
   * @param {number} centerX - Center X coordinate
   * @param {number} centerY - Center Y coordinate
   * @param {number} radius - Triangle radius
   */
  drawRuneMarkings(context, centerX, centerY, radius) {
    context.save();
    
    const triangleHeight = radius * Math.sqrt(3);
    
    // Get triangle points
    const top = { x: centerX, y: centerY - radius };
    const bottomLeft = { x: centerX - radius, y: centerY + triangleHeight/2 };
    const bottomRight = { x: centerX + radius, y: centerY + triangleHeight/2 };
    
    // Draw rune lines along edges
    context.strokeStyle = '#8B2500';
    context.lineWidth = 1;
    
    // Draw runes on edges
    for (let i = 0; i < 3; i++) {
      let startX, startY, endX, endY;
      
      if (i === 0) {
        // Top edge to bottom left
        startX = top.x;
        startY = top.y;
        endX = bottomLeft.x;
        endY = bottomLeft.y;
      } else if (i === 1) {
        // Bottom left to bottom right
        startX = bottomLeft.x;
        startY = bottomLeft.y;
        endX = bottomRight.x;
        endY = bottomRight.y;
      } else {
        // Bottom right to top
        startX = bottomRight.x;
        startY = bottomRight.y;
        endX = top.x;
        endY = top.y;
      }
      
      // Draw small rune marks along edge
      const steps = 5;
      for (let j = 1; j < steps; j++) {
        const t = j / steps;
        const x = startX + (endX - startX) * t;
        const y = startY + (endY - startY) * t;
        
        // Small ticks perpendicular to edge
        const dx = endX - startX;
        const dy = endY - startY;
        const len = Math.sqrt(dx*dx + dy*dy);
        
        // Perpendicular direction
        const perpX = -dy / len * 5;
        const perpY = dx / len * 5;
        
        context.beginPath();
        context.moveTo(x - perpX, y - perpY);
        context.lineTo(x + perpX, y + perpY);
        context.stroke();
      }
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
    context.fillStyle = '#8B2500';
    context.fillText(this.name, width / 2, margin);
    
    // Draw horizontal divider
    context.strokeStyle = '#8B2500';
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
    
    // Draw power info
    context.font = '16px serif';
    context.fillStyle = '#8B2500';
    context.fillText(`Power: ${this.power}`, margin, height - 100);
    context.fillText(`Cooldown: ${this.cooldown} seconds`, margin, height - 75);
    
    // Draw warning text
    context.font = 'italic 16px serif';
    context.fillText('Warning: May cause fire damage to surroundings', margin, height - 120);
    
    // Draw "How to Cast" section
    context.font = 'italic 18px serif';
    context.fillStyle = '#8B4513';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.fillText(`Cast with ${this.shape} shape`, width / 2, height - margin - 20);
    
    // Draw small triangle symbol
    const triangleSize = 15;
    const triangleHeight = triangleSize * Math.sqrt(3);
    const triangleY = height - margin - 40;
    
    context.beginPath();
    context.moveTo(width / 2, triangleY - triangleHeight / 2);
    context.lineTo(width / 2 - triangleSize, triangleY + triangleHeight / 2);
    context.lineTo(width / 2 + triangleSize, triangleY + triangleHeight / 2);
    context.closePath();
    context.strokeStyle = '#8B2500';
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
import * as THREE from 'three';

/**
 * Base class for all spells
 */
export class Spell {
  /**
   * @param {Object} options - Spell configuration options
   * @param {string} options.id - Unique identifier for the spell
   * @param {string} options.name - Display name of the spell
   * @param {string} options.shape - Shape required to cast this spell (circle, triangle, etc.)
   * @param {string} options.description - Description of what the spell does
   * @param {number} options.page - Page number in the spellbook
   * @param {Function} options.effect - Function to execute when spell is cast
   * @param {Object} [options.visualOptions] - Options for visual representation
   * @param {string} [options.icon] - Icon identifier for the spell
   */
  constructor(options) {
    this.id = options.id;
    this.name = options.name;
    this.shape = options.shape;
    this.description = options.description;
    this.page = options.page;
    this.effect = options.effect || (() => console.log(`Spell ${this.name} cast but no effect implemented`));
    this.visualOptions = options.visualOptions || {};
    this.icon = options.icon;
    this.cooldown = options.cooldown || 0; // Cooldown in seconds
    this.lastCastTime = 0; // Timestamp of last cast
  }

  /**
   * Check if spell is ready to cast (not on cooldown)
   * @returns {boolean} Whether spell can be cast
   */
  isReady() {
    if (this.cooldown <= 0) return true;
    
    const now = Date.now();
    const elapsed = (now - this.lastCastTime) / 1000;
    return elapsed >= this.cooldown;
  }

  /**
   * Get cooldown progress (0-1, where 1 is ready)
   * @returns {number} Cooldown progress
   */
  getCooldownProgress() {
    if (this.cooldown <= 0) return 1;
    
    const now = Date.now();
    const elapsed = (now - this.lastCastTime) / 1000;
    return Math.min(1, elapsed / this.cooldown);
  }

  /**
   * Cast the spell
   * @param {Object} context - Context for spell casting (camera, scene, etc.)
   * @param {boolean} [isRemote=false] - Whether this is a remote cast (from another player)
   * @returns {boolean} Whether casting was successful
   */
  cast(context, isRemote = false) {
    if (!isRemote && !this.isReady()) {
      return false;
    }
    
    // Record cast time for cooldown (only for local casts)
    if (!isRemote) {
      this.lastCastTime = Date.now();
    }
    
    // Execute the spell effect
    this.effect(context);
    
    // Emit event for multiplayer synchronization (only for local casts)
    if (!isRemote && context.eventBus) {
      // Get camera position (for spawn point)
      let cameraPosition = null;
      if (context.camera) {
        cameraPosition = {
          x: context.camera.position.x,
          y: context.camera.position.y,
          z: context.camera.position.z
        };
      }
      
      // Get camera direction (for object trajectory)
      let cameraDirection = null;
      if (context.camera && context.camera.getWorldDirection) {
        const dir = new THREE.Vector3();
        context.camera.getWorldDirection(dir);
        cameraDirection = {
          x: dir.x,
          y: dir.y,
          z: dir.z
        };
      }
      
      // Determine target position and optional target ID
      const targetPosition = context.targetPosition || cameraPosition;
      
      const targetId = context.targetId || null;
      
      context.eventBus.emit('spell:cast', {
        spellId: this.id,
        targetPosition,
        targetId,
        cameraPosition, // Include camera position
        targetDirection: cameraDirection // Include camera direction for orientation
      });
    }
    
    return true;
  }
  
  /**
   * Handle a remote cast of this spell (from another player)
   * @param {Object} data - Remote cast data
   * @param {Object} context - Context for spell casting
   * @returns {boolean} Whether remote casting was successful
   */
  remotecast(data, context) {
    // Create a modified context that includes the remote player's data
    const remoteContext = {
      ...context,
      isRemote: true,
      playerId: data.playerId,
      remotePlayerId: data.playerId, // Explicit property for clarity
      targetPosition: data.targetPosition,
      targetId: data.targetId,
      // Add camera position and direction from the remote player
      // for accurate positioning of complex effects
      cameraPosition: data.cameraPosition,
      targetDirection: data.targetDirection,
      // Pass channel data if present
      channelData: data.channelData,
      // Pass whether this is an initial cast
      initialCast: data.initialCast
    };
    
    // Enhanced debug logging for remote casts, especially on initial cast which is crucial for positioning
    if (data.initialCast) {
      console.log(`Initial remote cast of ${this.name} from player ${data.playerId}`, {
        targetPosition: data.targetPosition ? 
          `(${data.targetPosition.x.toFixed(2)}, ${data.targetPosition.y.toFixed(2)}, ${data.targetPosition.z.toFixed(2)})` : 
          'none',
        cameraPosition: data.cameraPosition ?
          `(${data.cameraPosition.x.toFixed(2)}, ${data.cameraPosition.y.toFixed(2)}, ${data.cameraPosition.z.toFixed(2)})` :
          'none',
        targetDirection: data.targetDirection ?
          `(${data.targetDirection.x.toFixed(2)}, ${data.targetDirection.y.toFixed(2)}, ${data.targetDirection.z.toFixed(2)})` :
          'none'
      });
    } else {
      console.log(`Remote cast of ${this.name} from player ${data.playerId}`, {
        targetPosition: data.targetPosition ? 
          `(${data.targetPosition.x.toFixed(2)}, ${data.targetPosition.y.toFixed(2)}, ${data.targetPosition.z.toFixed(2)})` : 
          'none',
        cameraPosition: data.cameraPosition ?
          `(${data.cameraPosition.x.toFixed(2)}, ${data.cameraPosition.y.toFixed(2)}, ${data.cameraPosition.z.toFixed(2)})` :
          'none',
        hasChannelData: !!data.channelData,
        channelProgress: data.channelData?.channelProgress
      });
    }
    
    // Call the normal cast method but with remote flag
    return this.cast(remoteContext, true);
  }
  
  /**
   * Check if a raycast hit an enemy and trigger damage
   * @param {THREE.Raycaster} raycaster - Raycaster to use for hit detection
   * @param {THREE.Scene} scene - Scene to check for intersections
   * @param {EventBus} eventBus - Event bus for emitting hit events
   * @param {number} [damage=1] - Amount of damage to deal
   * @returns {boolean} Whether an enemy was hit
   */
  checkEnemyHit(raycaster, scene, eventBus, damage = 1) {
    // Perform raycast
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    // Check for enemy hit
    for (const intersect of intersects) {
      // Traverse up the parent hierarchy to find the root model with enemyId
      let currentObject = intersect.object;
      let enemyId = null;
      
      // Check current object and its parents for enemyId
      while (currentObject && !enemyId) {
        if (currentObject.userData && currentObject.userData.enemyId) {
          enemyId = currentObject.userData.enemyId;
          break;
        }
        currentObject = currentObject.parent;
      }
      
      // If found enemy ID, emit hit event
      if (enemyId) {
        // Emit spell hit event
        eventBus.emit('spell:hit', {
          targetId: enemyId,
          spellId: this.id,
          power: damage,
          hitPoint: intersect.point
        });
        
        return true;
      }
    }
    
    return false;
  }

  /**
   * Generate texture for spell page
   * @param {CanvasRenderingContext2D} context - Canvas context to draw on
   * @param {boolean} isLeftPage - Whether this is the left page
   */
  generatePageTexture(context, isLeftPage) {
    // To be implemented by specific spell types or overridden
    if (isLeftPage) {
      // Draw the shape and visual representation
      this.drawShape(context);
    } else {
      // Draw name and description
      this.drawDescription(context);
    }
  }

  /**
   * Draw spell shape on canvas
   * @param {CanvasRenderingContext2D} context - Canvas context
   */
  drawShape(context) {
    const width = context.canvas.width;
    const height = context.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.3;
    
    // Clear canvas
    context.fillStyle = '#f5f5dc'; // Beige parchment color
    context.fillRect(0, 0, width, height);
    
    // Default shape drawing
    context.strokeStyle = this.visualOptions.strokeColor || '#8B4513';
    context.lineWidth = this.visualOptions.lineWidth || 3;
    
    switch (this.shape.toLowerCase()) {
      case 'circle':
        context.beginPath();
        context.arc(centerX, centerY, radius, 0, Math.PI * 2);
        context.stroke();
        break;
        
      case 'triangle':
        const triangleHeight = radius * Math.sqrt(3);
        context.beginPath();
        context.moveTo(centerX, centerY - radius);
        context.lineTo(centerX - radius, centerY + triangleHeight/2);
        context.lineTo(centerX + radius, centerY + triangleHeight/2);
        context.closePath();
        context.stroke();
        break;
        
      case 'hexagram':
        // Draw a hexagram (Star of David) for black hole spell
        const outerRadius = radius;
        const innerRadius = radius * 0.6;
        
        // Draw first triangle (pointing up)
        context.beginPath();
        for (let i = 0; i < 3; i++) {
          const angle = (i * 2 * Math.PI / 3) - Math.PI / 2; // Start from top
          const x = centerX + outerRadius * Math.cos(angle);
          const y = centerY + outerRadius * Math.sin(angle);
          
          if (i === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.closePath();
        context.stroke();
        
        // Draw second triangle (pointing down)
        context.beginPath();
        for (let i = 0; i < 3; i++) {
          const angle = (i * 2 * Math.PI / 3) + Math.PI / 2; // Start from bottom
          const x = centerX + outerRadius * Math.cos(angle);
          const y = centerY + outerRadius * Math.sin(angle);
          
          if (i === 0) context.moveTo(x, y);
          else context.lineTo(x, y);
        }
        context.closePath();
        context.stroke();
        break;
        
      default:
        // Draw a question mark for unknown shapes
        context.font = `${radius}px serif`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#8B4513';
        context.fillText('?', centerX, centerY);
    }
    
    // Draw page number
    context.font = 'bold 20px serif';
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillStyle = '#8B4513';
    context.fillText(`Page ${this.page}`, 20, height - 20);
  }

  /**
   * Draw spell description on canvas
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
    
    // Draw shape name at the bottom
    context.font = 'italic 24px serif';
    context.fillStyle = '#8B4513';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.fillText(`Cast with ${this.shape} shape`, width / 2, height - margin);
    
    // Draw page number
    context.font = 'bold 20px serif';
    context.textAlign = 'right';
    context.textBaseline = 'bottom';
    context.fillText(`Page ${this.page}`, width - 20, height - 20);
  }

  /**
   * Wrap text within a given width
   * @param {CanvasRenderingContext2D} context - Canvas context
   * @param {string} text - Text to wrap
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} maxWidth - Maximum width for text
   * @param {number} lineHeight - Height of each line
   */
  wrapText(context, text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;
      
      if (testWidth > maxWidth && i > 0) {
        context.fillText(line, x, y);
        line = words[i] + ' ';
        y += lineHeight;
      } else {
        line = testLine;
      }
    }
    
    context.fillText(line, x, y);
  }
}
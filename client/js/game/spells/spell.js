import * as THREE from 'three';

export class Spell {
  constructor(options) {
    this.id = options.id;
    this.name = options.name;
    this.shape = options.shape;
    this.description = options.description;
    this.page = options.page;
    this.effectKeyDown = options.effectKeyDown || (() => console.log(`Spell ${this.name} keydown but no effect implemented`));
    this.effectKeyUp = options.effectKeyUp || (() => console.log(`Spell ${this.name} keyup but no effect implemented`));
    this.visualOptions = options.visualOptions || {};
    this.icon = options.icon;
    this.cooldown = options.cooldown || 0;
    this.lastCastTime = 0;
    this.isKeyDown = false;
  }

  isReady() {
    if (this.cooldown <= 0) return true;
    
    const now = Date.now();
    const elapsed = (now - this.lastCastTime) / 1000;
    return elapsed >= this.cooldown;
  }

  getCooldownProgress() {
    if (this.cooldown <= 0) return 1;
    
    const now = Date.now();
    const elapsed = (now - this.lastCastTime) / 1000;
    return Math.min(1, elapsed / this.cooldown);
  }

  castDown(context, isRemote = false) {
    if (!isRemote && !this.isReady()) {
      return false;
    }
    
    if (!isRemote) {
      this.lastCastTime = Date.now();
    }

    this.isKeyDown = true;
    
    const cast_data = this.effectKeyDown(context);
    
    if (!isRemote && context.eventBus) {
      let cameraPosition = null;
      if (context.camera) {
        cameraPosition = {
          x: context.camera.position.x,
          y: context.camera.position.y,
          z: context.camera.position.z
        };
      }
      
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

      // Add spellData information about this being a keydown event
      const spellData = {
        isKeyDown: true,
        isKeyUp: false
      };

      if (cast_data) {
        // Add spellData to cast_data if it doesn't already have it
        if (!cast_data.spellData) {
          cast_data.spellData = spellData;
        }
        context.eventBus.emit('spell:cast', cast_data);
      } else {
        // context.eventBus.emit('spell:cast', {
        //   spellId: this.id,
        //   targetPosition,
        //   targetId,
        //   cameraPosition, // Include camera position
        //   targetDirection: cameraDirection, // Include camera direction for orientation
        //   spellData // Include information about the cast type
        // });
      }
    }
    
    return true;
  }

  castUp(context, isRemote = false) {
    if (!isRemote && !this.isKeyDown) {
      return false;
    }

    this.isKeyDown = false;
    
    const cast_data = this.effectKeyUp(context);
    
    if (!isRemote && context.eventBus) {
      let cameraPosition = null;
      if (context.camera) {
        cameraPosition = {
          x: context.camera.position.x,
          y: context.camera.position.y,
          z: context.camera.position.z
        };
      }
      
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
      
      const targetPosition = context.targetPosition || cameraPosition;
      
      const targetId = context.targetId || null;
      
      // Add spellData information about this being a keyup event
      const spellData = {
        isKeyDown: false,
        isKeyUp: true
      };

      if (cast_data) {
        console.log("emitting generated cast data");
        // Add spellData to cast_data if it doesn't already have it
        if (!cast_data.spellData) {
          cast_data.spellData = spellData;
        }
        context.eventBus.emit('spell:cast', cast_data);
      } else {
        console.log("don't emit generic cast data");
        // context.eventBus.emit('spell:cast', {
        //   spellId: this.id,
        //   targetPosition,
        //   targetId,
        //   cameraPosition, // Include camera position
        //   targetDirection: cameraDirection, // Include camera direction for orientation
        //   spellData // Include information about the cast type
        // });
      }
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
      cameraPosition: data.cameraPosition,
      targetDirection: data.targetDirection,
      spellData: data.spellData || {}
    };
    
    console.log(`Initial remote cast of ${this.name} from player ${data.playerId}`, {
      targetPosition: data.targetPosition ? 
        `(${data.targetPosition.x.toFixed(2)}, ${data.targetPosition.y.toFixed(2)}, ${data.targetPosition.z.toFixed(2)})` : 
        'none',
      cameraPosition: data.cameraPosition ?
        `(${data.cameraPosition.x.toFixed(2)}, ${data.cameraPosition.y.toFixed(2)}, ${data.cameraPosition.z.toFixed(2)})` :
        'none',
      targetDirection: data.targetDirection ?
        `(${data.targetDirection.x.toFixed(2)}, ${data.targetDirection.y.toFixed(2)}, ${data.targetDirection.z.toFixed(2)})` :
        'none',
      spellData: data.spellData
    });
    
    // Determine if this is a keydown or keyup event
    if (data.spellData && data.spellData.isKeyUp) {
      return this.castUp(remoteContext, true);
    } else {
      return this.castDown(remoteContext, true);
    }
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
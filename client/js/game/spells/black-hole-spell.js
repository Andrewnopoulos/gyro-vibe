import * as THREE from 'three';
import { Spell } from './spell.js';
import { SpellEffects } from './spell-effects.js';

/**
 * BlackHoleSpell - Creates a singularity that attracts and then explodes physics objects
 */
export class BlackHoleSpell extends Spell {
  /**
   * @param {Object} options - Spell configuration options
   * @param {EventBus} options.eventBus - Event bus for communication
   * @param {number} options.page - Page number in the spellbook
   * @param {number} [options.cooldown=8] - Cooldown time in seconds
   * @param {number} [options.duration=3] - Duration of black hole effect in seconds
   * @param {number} [options.strength=10] - Gravitational pull strength
   */
  constructor(options) {
    super({
      id: 'blackHole',
      name: 'Singularity',
      shape: 'space', // Changed to use spacebar like object spawner
      description: 'Creates a localized gravitational singularity that attracts nearby objects before violently exploding.',
      page: options.page,
      cooldown: options.cooldown || 8, // Longer cooldown due to power
      visualOptions: {
        strokeColor: '#6600CC',
        lineWidth: 3
      },
      effect: (context) => this.castBlackHole(context)
    });

    this.eventBus = options.eventBus;
    this.duration = options.duration || 3; // Default 3 seconds duration
    this.strength = options.strength || 10;
    this.effectRadius = 15; // Increased area of effect radius
    
    // Store active effect references for cleanup
    this.activeEffects = [];
  }
  
  /**
   * Cast black hole spell
   * @param {Object} context - Casting context with camera, scene, etc.
   */
  castBlackHole(context) {
    console.log('Casting black hole spell');
    
    // Check if this is a remote cast
    const isRemote = context?.isRemote;
    
    // For logging
    if (context.scene) {
      console.log('Using scene:', context.scene.type);
    } else {
      console.warn('No scene provided in context');
    }
    
    // Get main camera for positioning if available
    let mainCamera = context.mainCamera;
    if (!mainCamera) {
      // Try to get it via event bus as a fallback
      this.eventBus.emit('scene:get-camera', (camera) => {
        mainCamera = camera;
      });
    }

    // Always use the main scene if available, not the weapon scene
    const effectContext = {
      ...context,
      // If both scene and mainCamera are provided, use them
      scene: context.scene,
      camera: mainCamera || context.camera,
      eventBus: this.eventBus // Make sure to pass the event bus to the effect
    };
    
    // If this is a remote cast, use the provided target position
    if (isRemote && context.targetPosition) {
      // Override the default camera-based positioning for remote casts
      console.log('Using remote target position for black hole:', context.targetPosition);
      effectContext.fixedPosition = new THREE.Vector3(
        context.targetPosition.x,
        context.targetPosition.y,
        context.targetPosition.z
      );
    }
    
    // Create black hole effect as a static object in the world
    const blackHoleEffect = SpellEffects.createBlackHole(effectContext, {
      duration: this.duration,
      strength: this.strength,
      radius: 0.5, // Visual size of black hole
      effectRadius: this.effectRadius, // Range of gravitational effect
      damagePerSecond: 2, // Damage enemies at a rate of 2 HP per second if caught in the effect
      isRemote: isRemote // Pass along remote flag
    });
    
    // Store reference to active effect
    if (blackHoleEffect) {
      this.activeEffects.push(blackHoleEffect);
      
      // Set up cleanup after effect is done
      setTimeout(() => {
        const index = this.activeEffects.indexOf(blackHoleEffect);
        if (index >= 0) {
          this.activeEffects.splice(index, 1);
        }
      }, (this.duration + 1) * 1000); // Duration + explosion time
      
      // Log where the black hole was created
      console.log('Black hole created successfully');
      
      // Notify user about the black hole creation with some visual feedback
      // Only show notification for local casts
      if (!isRemote) {
        this.eventBus.emit('notification:show', {
          message: 'Singularity created!',
          duration: 2000,
          type: 'spell'
        });
      }
    } else {
      console.error('Failed to create black hole effect');
    }
    
    // Play sound effect (only for local casts)
    if (!isRemote) {
      this.eventBus.emit('audio:play', { 
        sound: 'blackHole', 
        volume: 0.8
      });
    }
  }
  
  /**
   * Update main camera reference if provided after initialization
   * @param {THREE.Camera} camera - Main world camera
   */
  updateMainCamera(camera) {
    if (camera && this.activeEffects.length > 0) {
      console.log('Updated main camera reference for black hole');
    }
  }
  
  /**
   * Clean up any active effects
   */
  dispose() {
    // Clean up any active effects
    this.activeEffects.forEach(effect => {
      if (effect.cleanup) {
        effect.cleanup();
      }
    });
    this.activeEffects = [];
  }
  
  /**
   * Override draw shape to show a black hole icon for space bar activation
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
    context.strokeStyle = this.visualOptions.strokeColor || '#6600CC';
    context.lineWidth = this.visualOptions.lineWidth || 3;
    
    // Draw space bar rectangle
    const barWidth = width * 0.5;
    const barHeight = height * 0.12;
    context.beginPath();
    context.roundRect(centerX - barWidth/2, centerY, barWidth, barHeight, 10);
    context.stroke();
    
    // Label the space bar with hold instruction
    context.font = 'bold 24px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#6600CC'; // Match black hole color
    context.fillText('SPACE', centerX, centerY + barHeight/2);
    
    // Draw black hole above the space bar
    const holeRadius = Math.min(width, height) * 0.15;
    
    // Draw a dark circle in the center for the black hole
    context.fillStyle = 'rgba(0, 0, 0, 0.8)';
    context.beginPath();
    context.arc(centerX, centerY - holeRadius, holeRadius, 0, Math.PI * 2);
    context.fill();
    
    // Add purple glow around the black hole
    const gradient = context.createRadialGradient(
      centerX, centerY - holeRadius, holeRadius * 0.8,
      centerX, centerY - holeRadius, holeRadius * 2
    );
    gradient.addColorStop(0, 'rgba(102, 0, 204, 0.8)');
    gradient.addColorStop(1, 'rgba(102, 0, 204, 0)');
    
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(centerX, centerY - holeRadius, holeRadius * 2, 0, Math.PI * 2);
    context.fill();
    
    // Draw particles around the black hole to show gravity
    this.drawGravityParticles(context, centerX, centerY - holeRadius, holeRadius * 1.5);
    
    // Draw a label for the black hole
    context.font = 'italic 20px serif';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.fillStyle = '#6600CC';
    context.fillText('Press SPACE to cast singularity', centerX, centerY - holeRadius * 2.5);
    
    // Draw page number
    context.font = 'bold 20px serif';
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillStyle = '#8B4513';
    context.fillText(`Page ${this.page}`, 20, height - 20);
  }
  
  /**
   * Draw particles being pulled into the black hole
   * @param {CanvasRenderingContext2D} context - Canvas context
   * @param {number} centerX - Center X position
   * @param {number} centerY - Center Y position
   * @param {number} radius - Radius of particle area
   */
  drawGravityParticles(context, centerX, centerY, radius) {
    const particleCount = 20;
    
    // Save context for animation
    const now = Date.now() / 1000;
    
    for (let i = 0; i < particleCount; i++) {
      // Calculate particle position on spiral
      const angle = (i / particleCount) * Math.PI * 10 + now * 0.5;
      const distance = (radius * 0.6) + (radius * 1.0 * (i / particleCount));
      
      const distanceFactor = 1 - (distance / (radius * 2));
      
      // Adjust position to create spiral effect
      const spiralFactor = 2.5 * (1 - i / particleCount); // Tighter spiral as we get closer
      const x = centerX + Math.cos(angle * spiralFactor) * distance;
      const y = centerY + Math.sin(angle * spiralFactor) * distance;
      
      // Particle size decreases as it gets closer to center
      const size = 2 + (distanceFactor * 5);
      
      // Particle color changes from light purple to dark
      const colorIntensity = 0.3 + distanceFactor * 0.7;
      context.fillStyle = `rgba(${102 * colorIntensity}, ${0 * colorIntensity}, ${204 * colorIntensity}, ${0.5 + distanceFactor * 0.5})`;
      
      // Draw particle
      context.beginPath();
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();
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
    context.fillStyle = '#6600CC'; // Purple for black hole spell
    context.fillText(this.name, width / 2, margin);
    
    // Draw horizontal divider
    context.strokeStyle = '#6600CC';
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
    
    // Draw additional description
    const additionalText = 
      'Creates a stationary gravitational singularity in front of you. The black hole remains fixed in place, ' +
      'pulling nearby objects toward it. After 3 seconds, it collapses violently, pushing all objects outward with explosive force.';
    
    this.wrapText(
      context,
      additionalText,
      margin,
      margin + 200,
      width - (margin * 2),
      32
    );
    
    // Draw warning
    context.fillStyle = '#AA0000';
    this.wrapText(
      context,
      'WARNING: Use with caution! Powerful singularities can disrupt the fabric of reality itself.',
      margin,
      margin + 400,
      width - (margin * 2),
      32
    );
    
    // Draw phased sequence icons
    this.drawPhaseSequence(context, width, height);
    
    // Draw key binding at the bottom
    context.font = 'bold 24px serif';
    context.fillStyle = '#6600CC';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.fillText('Press SPACE key to cast', width / 2, height - margin - 30);
    
    // Draw space bar shape hint
    context.beginPath();
    const barWidth = width * 0.35;
    const barHeight = height * 0.06;
    context.roundRect(width/2 - barWidth/2, height - margin - 30 + 10, barWidth, barHeight, 10);
    context.stroke();
    
    // Draw page number
    context.font = 'bold 20px serif';
    context.textAlign = 'right';
    context.textBaseline = 'bottom';
    context.fillStyle = '#8B4513';
    context.fillText(`Page ${this.page}`, width - 20, height - 20);
  }
  
  /**
   * Draw phase sequence icons showing how the spell works
   * @param {CanvasRenderingContext2D} context - Canvas context
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   */
  drawPhaseSequence(context, width, height) {
    const margin = 30;
    const iconSize = 60;
    const spacing = 40;
    const y = height - 120;
    const x1 = margin + iconSize/2;
    const x2 = width/2;
    const x3 = width - margin - iconSize/2;
    
    // Phase 1: Creation
    context.fillStyle = '#6600CC';
    context.beginPath();
    context.arc(x1, y, iconSize/2, 0, Math.PI * 2);
    context.fill();
    
    context.font = '16px serif';
    context.textAlign = 'center';
    context.fillStyle = '#000000';
    context.fillText('Creation', x1, y + iconSize/2 + 20);
    
    // Arrow
    context.beginPath();
    context.moveTo(x1 + iconSize/2 + 10, y);
    context.lineTo(x2 - iconSize/2 - 10, y);
    context.stroke();
    context.beginPath();
    context.moveTo(x2 - iconSize/2 - 10, y);
    context.lineTo(x2 - iconSize/2 - 20, y - 5);
    context.lineTo(x2 - iconSize/2 - 20, y + 5);
    context.fill();
    
    // Phase 2: Attraction
    context.strokeStyle = '#6600CC';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(x2, y, iconSize/2, 0, Math.PI * 2);
    context.stroke();
    
    // Draw arrows pointing inward
    const arrowCount = 8;
    const arrowLength = iconSize/2 - 5;
    for (let i = 0; i < arrowCount; i++) {
      const angle = (i / arrowCount) * Math.PI * 2;
      const startX = x2 + Math.cos(angle) * (iconSize/2 + 10);
      const startY = y + Math.sin(angle) * (iconSize/2 + 10);
      const endX = x2 + Math.cos(angle) * (iconSize/4);
      const endY = y + Math.sin(angle) * (iconSize/4);
      
      context.beginPath();
      context.moveTo(startX, startY);
      context.lineTo(endX, endY);
      context.stroke();
    }
    
    context.fillText('Attraction', x2, y + iconSize/2 + 20);
    
    // Arrow
    context.beginPath();
    context.moveTo(x2 + iconSize/2 + 10, y);
    context.lineTo(x3 - iconSize/2 - 10, y);
    context.stroke();
    context.beginPath();
    context.moveTo(x3 - iconSize/2 - 10, y);
    context.lineTo(x3 - iconSize/2 - 20, y - 5);
    context.lineTo(x3 - iconSize/2 - 20, y + 5);
    context.fill();
    
    // Phase 3: Explosion
    context.fillStyle = '#FF5500';
    context.beginPath();
    context.arc(x3, y, iconSize/2, 0, Math.PI * 2);
    context.fill();
    
    // Draw explosive rays
    const rayCount = 8;
    for (let i = 0; i < rayCount; i++) {
      const angle = (i / rayCount) * Math.PI * 2;
      const innerX = x3 + Math.cos(angle) * (iconSize/2 - 5);
      const innerY = y + Math.sin(angle) * (iconSize/2 - 5);
      const outerX = x3 + Math.cos(angle) * (iconSize/2 + 15);
      const outerY = y + Math.sin(angle) * (iconSize/2 + 15);
      
      context.lineWidth = 3;
      context.strokeStyle = '#FFAA00';
      context.beginPath();
      context.moveTo(innerX, innerY);
      context.lineTo(outerX, outerY);
      context.stroke();
    }
    
    context.fillStyle = '#000000';
    context.fillText('Explosion', x3, y + iconSize/2 + 20);
  }
}
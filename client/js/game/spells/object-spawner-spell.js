import * as THREE from 'three';
import { Spell } from './spell.js';

/**
 * ObjectSpawnerSpell - Spawns random objects in front of the player
 */
export class ObjectSpawnerSpell extends Spell {
  /**
   * @param {Object} options - Spell configuration options
   * @param {EventBus} options.eventBus - Event bus for communication
   * @param {number} options.page - Page number in the spellbook
   * @param {number} [options.cooldown=3] - Cooldown time in seconds
   */
  constructor(options) {
    super({
      id: 'objectSpawner',
      name: 'Object Conjuring',
      shape: 'space', // This is a special shape triggered by space bar
      description: 'Conjure a random physical object in front of you. Press SPACE to cast this spell.',
      page: options.page,
      cooldown: options.cooldown || 3,
      visualOptions: {
        strokeColor: '#8B4513',
        lineWidth: 3
      },
      effect: (context) => this.spawnObject(context)
    });

    this.eventBus = options.eventBus;
  }

  /**
   * Spawn a random object in front of the player
   * @param {Object} context - Casting context with camera, scene, etc.
   */
  spawnObject(context) {
    // Get camera position and direction from the main scene camera
    let cameraPosition, cameraDirection;
    
    this.eventBus.emit('camera:get-position', (position) => {
      cameraPosition = position;
    });
    
    this.eventBus.emit('camera:get-direction', (direction) => {
      cameraDirection = direction;
    });
    
    if (!cameraPosition || !cameraDirection) {
      console.error('Failed to get camera position/direction for object spawning');
      return;
    }
    
    // Adjust spawn position to be from the player's hands
    // Spawn position 1.5-2.5 meters in front of the camera, slightly lower than camera height
    const distance = 1.5 + Math.random();
    const spawnPosition = cameraPosition.clone().add(
      cameraDirection.clone().multiplyScalar(distance)
    );
    
    // Offset a bit downward to appear from hands
    spawnPosition.y -= 0.3;
    
    // Add some random offset to prevent objects spawning exactly on top of each other
    spawnPosition.x += (Math.random() - 0.5) * 0.2;
    spawnPosition.y += (Math.random() - 0.5) * 0.2;
    spawnPosition.z += (Math.random() - 0.5) * 0.2;
    
    // Generate random properties for the object
    const randomObject = this.generateRandomObjectProps();
    
    // Command physics system to create the object
    this.eventBus.emit('physics:spawn-object', {
      ...randomObject,
      position: {
        x: spawnPosition.x,
        y: spawnPosition.y,
        z: spawnPosition.z
      },
      // Add initial velocity to push object away from player
      velocity: {
        x: cameraDirection.x * 2,
        y: cameraDirection.y * 2 + 1, // Add slight upward motion
        z: cameraDirection.z * 2
      }
    });
    
    // Play sound effect
    this.eventBus.emit('audio:play', { 
      sound: 'spawnObject', 
      volume: 0.7
    });
  }
  
  /**
   * Generate random properties for a physics object
   * @returns {Object} Random object properties
   */
  generateRandomObjectProps() {
    // Random shape type
    const shapeTypes = ['box', 'sphere', 'cylinder'];
    const randomShape = shapeTypes[Math.floor(Math.random() * shapeTypes.length)];
    
    // Random size (not too large or too small)
    const baseSize = 0.3 + Math.random() * 0.7;
    let size;
    
    if (randomShape === 'box') {
      // Slightly varied dimensions for boxes
      size = {
        x: baseSize * (0.8 + Math.random() * 0.4),
        y: baseSize * (0.8 + Math.random() * 0.4),
        z: baseSize * (0.8 + Math.random() * 0.4)
      };
    } else if (randomShape === 'cylinder') {
      // Cylinders have consistent x/z, but varied height
      size = {
        x: baseSize,
        y: baseSize * (1 + Math.random()),
        z: baseSize
      };
    } else {
      // Spheres are uniform
      size = {
        x: baseSize,
        y: baseSize,
        z: baseSize
      };
    }
    
    // Random mass - heavier objects are less common
    const mass = Math.random() < 0.7 ? 
      0.5 + Math.random() * 1.5 : // Light (70% chance)
      2 + Math.random() * 5;     // Heavy (30% chance)
    
    // Random color - generate a nice color
    const hue = Math.random();
    const saturation = 0.5 + Math.random() * 0.5;
    const lightness = 0.4 + Math.random() * 0.4;
    
    // Convert HSL to RGB hex
    const color = new THREE.Color().setHSL(hue, saturation, lightness);
    
    // Random material properties
    const metallic = Math.random() < 0.3; // 30% chance of metallic
    const restitution = 0.2 + Math.random() * 0.6; // Bounciness
    
    return {
      size,
      mass,
      color: color.getHex(),
      shape: randomShape,
      metallic,
      restitution
    };
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
    context.roundRect(centerX - barWidth/2, centerY, barWidth, barHeight, 10);
    context.stroke();
    
    // Label the space bar
    context.font = 'bold 24px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#8B4513';
    context.fillText('SPACE', centerX, centerY + barHeight/2);
    
    // Draw small objects coming out of the space bar
    this.drawSpawnedObjects(context, centerX, centerY - barHeight, width, height);
    
    // Draw page number
    context.font = 'bold 20px serif';
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillStyle = '#8B4513';
    context.fillText(`Page ${this.page}`, 20, height - 20);
  }
  
  /**
   * Draw spawned objects
   * @param {CanvasRenderingContext2D} context - Canvas context 
   * @param {number} centerX - Center X position
   * @param {number} baseY - Base Y position
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   */
  drawSpawnedObjects(context, centerX, baseY, width, height) {
    const objects = [
      { x: centerX - 80, y: baseY - 40, size: 30, type: 'box' },
      { x: centerX, y: baseY - 70, size: 25, type: 'circle' },
      { x: centerX + 70, y: baseY - 45, size: 28, type: 'triangle' }
    ];
    
    // Draw motion lines from space bar to objects
    context.strokeStyle = '#8B4513';
    context.lineWidth = 1.5;
    context.setLineDash([5, 3]);
    
    objects.forEach(obj => {
      context.beginPath();
      context.moveTo(centerX, baseY);
      context.lineTo(obj.x, obj.y + obj.size/2);
      context.stroke();
    });
    
    context.setLineDash([]);
    
    // Draw objects with different colors
    objects.forEach((obj, i) => {
      const hue = (i * 120) / 360; // Spread colors evenly
      context.fillStyle = `hsl(${hue * 360}, 70%, 60%)`;
      context.strokeStyle = `hsl(${hue * 360}, 70%, 40%)`;
      context.lineWidth = 2;
      
      context.beginPath();
      if (obj.type === 'circle') {
        context.arc(obj.x, obj.y, obj.size/2, 0, Math.PI * 2);
      } else if (obj.type === 'box') {
        context.rect(obj.x - obj.size/2, obj.y - obj.size/2, obj.size, obj.size);
      } else if (obj.type === 'triangle') {
        const h = obj.size * 0.866; // height of equilateral triangle
        context.moveTo(obj.x, obj.y - h/2);
        context.lineTo(obj.x + obj.size/2, obj.y + h/2);
        context.lineTo(obj.x - obj.size/2, obj.y + h/2);
        context.closePath();
      }
      
      context.fill();
      context.stroke();
    });
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
    const instructions = 'This spell will conjure random physical objects that you can manipulate with your gravity gun.';
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
    context.fillText('Press SPACE key to cast', width / 2, height - margin - 30);
    
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
import * as THREE from 'three';
import { Spell } from './spell.js';

/**
 * ObjectSpawnerSpell - Spawns random objects in front of the player
 * Supports channeling by holding the space bar to increase object size
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
      description: 'Conjure a random physical object in front of you. Hold SPACE to increase the size and mass of the object.',
      page: options.page,
      cooldown: options.cooldown || 3,
      visualOptions: {
        strokeColor: '#8B4513',
        lineWidth: 3
      },
      effect: (context) => this.startChanneling(context)
    });

    this.eventBus = options.eventBus;
    
    // Channeling state
    this.isChanneling = false;
    this.channelStartTime = 0;
    this.channelObject = null;
    this.channelObjectId = null;
    this.channelMaxDuration = 3; // Max channeling duration in seconds
    
    // Bind the keyup handler to this instance for proper cleanup
    this.keyUpHandler = this.handleKeyUp.bind(this);
    
    // Listen for keyup to detect when space is released
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for space key release
   */
  setupEventListeners() {
    // Listen for space bar release
    document.addEventListener('keyup', this.keyUpHandler);
    
    // Set up update loop for channeling
    this.updateInterval = setInterval(() => {
      if (this.isChanneling) {
        this.updateChanneledObject();
      }
    }, 50); // Update every 50ms
  }
  
  /**
   * Handle key up event
   * @param {KeyboardEvent} event - The keyboard event
   */
  handleKeyUp(event) {
    if (event.code === 'Space' && this.isChanneling) {
      this.finishChanneling();
    }
  }
  
  /**
   * Start the channeling process for the spell
   * @param {Object} context - Casting context with camera, scene, etc.
   */
  startChanneling(context) {
    if (this.isChanneling) {
      return; // Already channeling
    }
    
    this.isChanneling = true;
    this.channelStartTime = Date.now();
    this.channelContext = context;
    
    // Spawn the initial small object
    this.spawnChanneledObject(0); // 0 = starting size
    
    // Play start channeling sound
    this.eventBus.emit('audio:play', { 
      sound: 'spawnObject', 
      volume: 0.5
    });
    
    // Create visual feedback on spellbook
    this.createChannelingVisual(context);
    
    // Set timeout to auto-finish channeling after max duration
    this.channelTimeout = setTimeout(() => {
      if (this.isChanneling) {
        this.finishChanneling();
      }
    }, this.channelMaxDuration * 1000);
  }
  
  /**
   * Create visual feedback on the spellbook while channeling
   * @param {Object} context - Casting context
   */
  createChannelingVisual(context) {
    if (!context || !context.spellbook) return;
    
    // Create a glow effect on the book
    const spellbook = context.spellbook;
    
    // Create a growing pulse ring
    const geometry = new THREE.RingGeometry(0.05, 0.08, 32);
    const material = new THREE.MeshBasicMaterial({
      color: 0xFFAA00,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide
    });
    
    this.channelRing = new THREE.Mesh(geometry, material);
    this.channelRing.position.set(0, 0, 0.05); // Slightly in front of the book
    this.channelRing.userData.isChannelingEffect = true;
    spellbook.add(this.channelRing);
    
    // Create a progress bar for channeling
    const barGeometry = new THREE.PlaneGeometry(0.01, 0.03);
    const barMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFAA00,
      transparent: true,
      opacity: 0.8
    });
    
    this.channelBar = new THREE.Mesh(barGeometry, barMaterial);
    this.channelBar.position.set(-0.2, -0.28, 0.02); // Bottom of the book
    this.channelBar.userData.isChannelingEffect = true;
    spellbook.add(this.channelBar);
    
    // Create background for progress bar
    const bgGeometry = new THREE.PlaneGeometry(0.4, 0.03);
    const bgMaterial = new THREE.MeshBasicMaterial({
      color: 0x222222,
      transparent: true,
      opacity: 0.5
    });
    
    this.channelBarBg = new THREE.Mesh(bgGeometry, bgMaterial);
    this.channelBarBg.position.set(0, -0.28, 0.015); // Slightly behind the bar
    this.channelBarBg.userData.isChannelingEffect = true;
    spellbook.add(this.channelBarBg);
  }
  
  /**
   * Update the channeled object's size and mass based on channel duration
   */
  updateChanneledObject() {
    if (!this.isChanneling || !this.channelObjectId) return;
    
    const elapsed = (Date.now() - this.channelStartTime) / 1000; // seconds
    const channelProgress = Math.min(1, elapsed / this.channelMaxDuration);
    
    // Calculate new scale and mass
    const newScale = this.calculateChannelScale(channelProgress);
    const newMass = this.calculateChannelMass(channelProgress);
    
    // Log the growth for debugging (once per second)
    if (Math.floor(elapsed) > Math.floor((elapsed - 0.05)) && elapsed < this.channelMaxDuration) {
      console.log(`Object growing: ${elapsed.toFixed(1)}s - Scale: ${newScale.toFixed(2)}, Mass: ${newMass.toFixed(2)}`);
    }
    
    // Update the object's size and mass through physics system
    this.eventBus.emit('physics:update-object', {
      id: this.channelObjectId,
      scale: newScale,
      mass: newMass
    });
    
    // Visual feedback through pulse effect
    const pulseIntensity = 0.2 + (channelProgress * 0.6);
    const pulsePeriod = 0.5 - (channelProgress * 0.3); // Pulse faster as we channel longer
    const pulse = 1 + (Math.sin(elapsed / pulsePeriod) * pulseIntensity * 0.2);
    
    this.eventBus.emit('physics:update-object', {
      id: this.channelObjectId,
      visualEffect: {
        type: 'pulse',
        intensity: pulse
      }
    });
    
    // Update visual effects on spellbook
    this.updateChannelingVisuals(channelProgress, elapsed);
  }
  
  /**
   * Update visual effects on the spellbook while channeling
   * @param {number} progress - 0 to 1 progress value
   * @param {number} elapsed - Seconds elapsed
   */
  updateChannelingVisuals(progress, elapsed) {
    if (!this.channelRing || !this.channelBar) return;
    
    // Update the progress bar
    if (this.channelBar.geometry) {
      this.channelBar.geometry.dispose();
      // Width grows from 0.01 to 0.4 (full width)
      const width = 0.4 * progress;
      this.channelBar.geometry = new THREE.PlaneGeometry(width, 0.03);
      
      // Update position to keep left-aligned
      this.channelBar.position.x = -0.2 + (width / 2);
    }
    
    // Update ring size based on progress
    if (this.channelRing.geometry) {
      this.channelRing.geometry.dispose();
      // Inner radius grows from 0.05 to 0.15
      const innerRadius = 0.05 + (progress * 0.1);
      // Outer radius grows from 0.08 to 0.25
      const outerRadius = innerRadius + 0.03 + (progress * 0.1);
      this.channelRing.geometry = new THREE.RingGeometry(innerRadius, outerRadius, 32);
    }
    
    // Pulse the ring
    if (this.channelRing.material) {
      // Color shifts from yellow to red as progress increases
      const r = 1.0;
      const g = 0.7 - (progress * 0.5);
      const b = 0.0;
      this.channelRing.material.color.setRGB(r, g, b);
      
      // Pulsing opacity
      const pulseFactor = 0.7 + Math.sin(elapsed * 5) * 0.3;
      this.channelRing.material.opacity = pulseFactor * 0.8;
    }
    
    // Change color of the progress bar based on progress
    if (this.channelBar.material) {
      // Color shifts from yellow to red as progress increases
      const r = 1.0;
      const g = 0.7 - (progress * 0.5);
      const b = 0.0;
      this.channelBar.material.color.setRGB(r, g, b);
    }
    
    // Scale the ring slightly for a pulsing effect
    const ringPulse = 1 + Math.sin(elapsed * 8) * 0.05;
    this.channelRing.scale.set(ringPulse, ringPulse, 1);
  }
  
  /**
   * Calculate scale factor based on channel progress
   * @param {number} progress - 0 to 1 progress of channeling
   * @returns {number} Scale factor
   */
  calculateChannelScale(progress) {
    // Start very small (0.2) and grow up to 4x size at max channel
    // Using a more pronounced quadratic curve for dramatic effect
    return 0.7 + (progress * progress * 4.8); // Quadratic growth curve
  }
  
  /**
   * Calculate mass based on channel progress
   * @param {number} progress - 0 to 1 progress of channeling
   * @returns {number} Mass value
   */
  calculateChannelMass(progress) {
    // Start very light (0.2) and grow heavier up to 10 at max channel
    // Cubic curve gives rapid growth toward the end for dramatic effect
    return 0.2 + (progress * progress * progress * 9.8); // Cubic growth for mass
  }
  
  /**
   * Finish channeling the spell and finalize the object
   */
  finishChanneling() {
    if (!this.isChanneling) return;
    
    this.isChanneling = false;
    clearTimeout(this.channelTimeout);
    
    // Final update to the object
    if (this.channelObjectId) {
      const elapsed = (Date.now() - this.channelStartTime) / 1000;
      const finalProgress = Math.min(1, elapsed / this.channelMaxDuration);
      
      // Add velocity on release, stronger for more channeled objects
      let velocity = {
        x: 0, y: 0, z: 0
      };
      
      // Get camera direction for launch
      let cameraDirection;
      this.eventBus.emit('camera:get-direction', (direction) => {
        cameraDirection = direction;
      });
      
      if (cameraDirection) {
        // Launch power based on channel time
        const launchPower = 1 + (finalProgress * 5);
        velocity = {
          x: cameraDirection.x * launchPower,
          y: cameraDirection.y * launchPower + 2, // Add upward motion
          z: cameraDirection.z * launchPower
        };
      }
      
      // Final update to physics object
      this.eventBus.emit('physics:update-object', {
        id: this.channelObjectId,
        velocity: velocity,
        visualEffect: {
          type: 'release',
          intensity: finalProgress
        }
      });
      
      // Play release sound, louder for bigger objects
      this.eventBus.emit('audio:play', { 
        sound: 'objectRelease', 
        volume: 0.6 + (finalProgress * 0.4),
        pitch: 1.0 - (finalProgress * 0.3) // Lower pitch for bigger objects
      });
    }
    
    // Remove visual effects from spellbook
    this.removeChannelingVisuals();
    
    // Clear references
    this.channelObjectId = null;
    this.channelObject = null;
    this.channelContext = null;
  }
  
  /**
   * Remove all channeling visual effects from the spellbook
   */
  removeChannelingVisuals() {
    // Clean up ring
    if (this.channelRing) {
      if (this.channelRing.parent) {
        this.channelRing.parent.remove(this.channelRing);
      }
      if (this.channelRing.geometry) {
        this.channelRing.geometry.dispose();
      }
      if (this.channelRing.material) {
        this.channelRing.material.dispose();
      }
      this.channelRing = null;
    }
    
    // Clean up progress bar
    if (this.channelBar) {
      if (this.channelBar.parent) {
        this.channelBar.parent.remove(this.channelBar);
      }
      if (this.channelBar.geometry) {
        this.channelBar.geometry.dispose();
      }
      if (this.channelBar.material) {
        this.channelBar.material.dispose();
      }
      this.channelBar = null;
    }
    
    // Clean up background bar
    if (this.channelBarBg) {
      if (this.channelBarBg.parent) {
        this.channelBarBg.parent.remove(this.channelBarBg);
      }
      if (this.channelBarBg.geometry) {
        this.channelBarBg.geometry.dispose();
      }
      if (this.channelBarBg.material) {
        this.channelBarBg.material.dispose();
      }
      this.channelBarBg = null;
    }
    
    // Additionally, if there's any spellbook we can access, clean up any channeling effects
    if (this.channelContext && this.channelContext.spellbook) {
      const spellbook = this.channelContext.spellbook;
      spellbook.traverse((child) => {
        if (child.userData && child.userData.isChannelingEffect) {
          if (child.parent) {
            child.parent.remove(child);
          }
        }
      });
    }
  }
  
  /**
   * Spawn a channeled object at the given scale
   * @param {number} channelProgress - Progress of channeling (0-1)
   */
  spawnChanneledObject(channelProgress) {
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
    
    // Spawn position closer to player during channeling
    const distance = 1.2 + (channelProgress * 0.3);
    const spawnPosition = cameraPosition.clone().add(
      cameraDirection.clone().multiplyScalar(distance)
    );
    
    // Positioned higher to better interact with black hole
    spawnPosition.y -= 0.3;
    
    // Less random offset during channeling to make it feel more controlled
    spawnPosition.x += (Math.random() - 0.5) * 0.1;
    spawnPosition.y += (Math.random() - 0.5) * 0.1;
    spawnPosition.z += (Math.random() - 0.5) * 0.1;
    
    // Generate object properties but override size and mass
    const objectProps = this.generateRandomObjectProps();
    const scaleFactor = this.calculateChannelScale(channelProgress);
    const mass = this.calculateChannelMass(channelProgress);
    
    // Adjust size based on scale factor
    Object.keys(objectProps.size).forEach(axis => {
      objectProps.size[axis] *= scaleFactor;
    });
    
    // Override mass
    objectProps.mass = mass;
    
    // Add unique ID to track this object
    const objectId = 'channeled_' + Date.now();
    
    // Command physics system to create the object with minimal initial velocity
    this.eventBus.emit('physics:spawn-object', {
      ...objectProps,
      id: objectId,
      position: {
        x: spawnPosition.x,
        y: spawnPosition.y,
        z: spawnPosition.z
      },
      // Very little initial velocity during channeling
      velocity: {
        x: 0,
        y: 0.1, // Slight upward drift
        z: 0
      },
      // Special visual effect for channeled objects
      visualEffect: {
        type: 'channeling',
        intensity: 0.2
      }
    });
    
    // Store reference to this object
    this.channelObjectId = objectId;
  }
  
  /**
   * Spawn a random object in front of the player (non-channeled version)
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
    
    // Adjust spawn position to be high above player for better black hole interaction
    // Spawn position 1.5-2.5 meters in front of the camera, but much higher
    const distance = 1.5 + Math.random();
    const spawnPosition = cameraPosition.clone().add(
      cameraDirection.clone().multiplyScalar(distance)
    );
    
    // Positioned much higher to better interact with black hole
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
    
    // Label the space bar with hold instruction
    context.font = 'bold 24px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#8B4513';
    context.fillText('HOLD SPACE', centerX, centerY + barHeight/2);
    
    // Draw objects in different sizes to illustrate the channeling
    this.drawChannelingObjects(context, centerX, centerY - barHeight, width, height);
    
    // Add an instruction for holding
    context.font = 'italic 20px serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#8B4513';
    context.fillText('Hold longer for larger objects', centerX, centerY + barHeight + 40);
    
    // Draw page number
    context.font = 'bold 20px serif';
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillStyle = '#8B4513';
    context.fillText(`Page ${this.page}`, 20, height - 20);
  }
  
  /**
   * Draw objects demonstrating channeling effect
   * @param {CanvasRenderingContext2D} context - Canvas context 
   * @param {number} centerX - Center X position
   * @param {number} baseY - Base Y position
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   */
  drawChannelingObjects(context, centerX, baseY, width, height) {
    // Three objects of increasing size to demonstrate channeling
    const objects = [
      { x: centerX - 100, y: baseY - 30, scale: 0.5, type: 'sphere' },
      { x: centerX, y: baseY - 60, scale: 1.0, type: 'box' },
      { x: centerX + 100, y: baseY - 100, scale: 1.6, type: 'cylinder' }
    ];
    
    // Draw arrows pointing from space bar to objects
    context.strokeStyle = '#8B4513';
    context.lineWidth = 1.5;
    context.setLineDash([5, 3]);
    
    // Draw a horizontal arrow from center
    context.beginPath();
    context.moveTo(centerX, baseY);
    context.lineTo(centerX, baseY - 20);
    context.stroke();
    
    // Draw arrows to each object
    objects.forEach(obj => {
      context.beginPath();
      context.moveTo(centerX, baseY - 20);
      context.lineTo(obj.x, obj.y + (obj.scale * 15));
      context.stroke();
    });
    
    context.setLineDash([]);
    
    // Draw hold time labels
    context.font = 'italic 16px serif';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.fillStyle = '#8B4513';
    
    context.fillText('Tap', objects[0].x, objects[0].y + 40);
    context.fillText('Short Hold', objects[1].x, objects[1].y + 50);
    context.fillText('Long Hold', objects[2].x, objects[2].y + 65);
    
    // Draw objects with different sizes
    objects.forEach((obj, i) => {
      const hue = (i * 120) / 360; // Spread colors evenly
      context.fillStyle = `hsl(${hue * 360}, 70%, 60%)`;
      context.strokeStyle = `hsl(${hue * 360}, 70%, 40%)`;
      context.lineWidth = 2;
      
      let baseSize = 20 * obj.scale;
      
      context.beginPath();
      if (obj.type === 'sphere') {
        context.arc(obj.x, obj.y, baseSize, 0, Math.PI * 2);
      } else if (obj.type === 'box') {
        context.rect(obj.x - baseSize, obj.y - baseSize, baseSize * 2, baseSize * 2);
      } else if (obj.type === 'cylinder') {
        // Draw cylinder (top ellipse)
        context.save();
        context.scale(1, 0.4);
        context.arc(obj.x, obj.y / 0.4, baseSize, 0, Math.PI * 2);
        context.restore();
        
        // Draw sides
        context.moveTo(obj.x - baseSize, obj.y);
        context.lineTo(obj.x - baseSize, obj.y + baseSize * 1.5);
        context.moveTo(obj.x + baseSize, obj.y);
        context.lineTo(obj.x + baseSize, obj.y + baseSize * 1.5);
        
        // Draw bottom ellipse
        context.save();
        context.scale(1, 0.4);
        context.arc(obj.x, (obj.y + baseSize * 1.5) / 0.4, baseSize, 0, Math.PI * 2);
        context.restore();
      }
      
      context.fill();
      context.stroke();
    });
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
    
    // Draw additional instructions about channeling
    const instructions = 'This spell creates objects that grow larger and heavier the longer you hold the SPACE key. Quickly tap for small light objects or hold for massive heavy ones.';
    this.wrapText(
      context,
      instructions,
      margin,
      margin + 180,
      width - (margin * 2),
      32
    );
    
    // Draw channeling instructions
    context.font = 'bold 18px serif';
    context.fillStyle = '#8B4513';
    context.textAlign = 'left';
    context.textBaseline = 'top';
    
    const tips = [
      '• Tap SPACE - Small, light object',
      '• Hold SPACE briefly - Medium object',
      '• Hold SPACE long - Large, heavy object'
    ];
    
    tips.forEach((tip, i) => {
      context.fillText(
        tip,
        margin + 20,
        margin + 280 + (i * 30),
        width - (margin * 2) - 20
      );
    });
    
    // Draw key binding at the bottom
    context.font = 'bold 24px serif';
    context.fillStyle = '#8B4513';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.fillText('HOLD SPACE key to channel', width / 2, height - margin - 30);
    
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
    context.fillText(`Page ${this.page}`, width - 20, height - 20);
  }
  
  /**
   * Clean up resources when spell is no longer needed
   * Called when being unloaded or application is closing
   */
  dispose() {
    // Stop any active channeling
    if (this.isChanneling) {
      this.finishChanneling();
    }
    
    // Clear the update interval
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    // Remove event listeners
    document.removeEventListener('keyup', this.keyUpHandler);
    
    // Clear any timeouts
    if (this.channelTimeout) {
      clearTimeout(this.channelTimeout);
      this.channelTimeout = null;
    }
  }
}
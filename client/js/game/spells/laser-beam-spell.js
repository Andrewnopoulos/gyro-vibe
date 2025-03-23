import * as THREE from 'three';
import { Spell } from './spell.js';

/**
 * LaserBeamSpell - A powerful white laser beam that damages enemies in its path
 * The player can charge it up via channeling, similar to the object spawner
 * The laser is only fired once the channeling is released
 */
export class LaserBeamSpell extends Spell {
  /**
   * @param {Object} options - Spell configuration options
   * @param {EventBus} options.eventBus - Event bus for communication
   * @param {number} options.page - Page number in the spellbook
   * @param {number} [options.cooldown=0] - Cooldown time in seconds (no cooldown by default)
   */
  constructor(options) {
    super({
      id: 'laserBeam',
      name: 'Laser Beam',
      shape: 'space', // This is triggered by space bar similar to object spawner
      description: 'Channel a powerful white laser beam that damages all enemies in its path. Hold longer to increase the beam\'s thickness and damage.',
      page: options.page,
      cooldown: options.cooldown || 0, // No cooldown as requested
      visualOptions: {
        strokeColor: '#FFFFFF',
        lineWidth: 3
      },
      effect: (context) => this.startChanneling(context)
    });

    this.eventBus = options.eventBus;
    
    // Channeling state
    this.isChanneling = false;
    this.channelStartTime = 0;
    this.channelMaxDuration = 3; // Max channeling duration in seconds
    this.laserDuration = 0.3; // Laser effect lasts 0.3 seconds as specified
    this.laserActive = false;
    
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
        this.updateChannelingVisuals();
      }
    }, 50); // Update every 50ms
  }
  
  /**
   * Handle key up event
   * @param {KeyboardEvent} event - The keyboard event
   */
  handleKeyUp(event) {
    if (event.code === 'Space' && this.isChanneling) {
      this.fireLaser();
    }
  }
  
  /**
   * Start the channeling process for the spell
   * @param {Object} context - Casting context with camera, scene, etc.
   */
  startChanneling(context) {
    if (this.isChanneling || this.laserActive) {
      return; // Already channeling or laser is active
    }
    
    this.isChanneling = true;
    this.channelStartTime = Date.now();
    this.channelContext = context;
    
    // Play start channeling sound
    this.eventBus.emit('audio:play', { 
      sound: 'spawnObject', // Reuse existing sound as placeholder
      volume: 0.5
    });
    
    // Create visual feedback on spellbook
    this.createChannelingVisual(context);
    
    // Set timeout to auto-fire laser after max duration
    this.channelTimeout = setTimeout(() => {
      if (this.isChanneling) {
        this.fireLaser();
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
      color: 0xFFFFFF, // White color for laser
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
      color: 0xFFFFFF, // White color
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
   * Update visual effects on the spellbook while channeling
   */
  updateChannelingVisuals() {
    if (!this.isChanneling || !this.channelRing || !this.channelBar) return;
    
    const elapsed = (Date.now() - this.channelStartTime) / 1000; // seconds
    const channelProgress = Math.min(1, elapsed / this.channelMaxDuration);
    
    // Update the progress bar
    if (this.channelBar.geometry) {
      this.channelBar.geometry.dispose();
      // Width grows from 0.01 to 0.4 (full width)
      const width = 0.4 * channelProgress;
      this.channelBar.geometry = new THREE.PlaneGeometry(width, 0.03);
      
      // Update position to keep left-aligned
      this.channelBar.position.x = -0.2 + (width / 2);
    }
    
    // Update ring size based on progress
    if (this.channelRing.geometry) {
      this.channelRing.geometry.dispose();
      // Inner radius grows from 0.05 to 0.15
      const innerRadius = 0.05 + (channelProgress * 0.1);
      // Outer radius grows from 0.08 to 0.25
      const outerRadius = innerRadius + 0.03 + (channelProgress * 0.1);
      this.channelRing.geometry = new THREE.RingGeometry(innerRadius, outerRadius, 32);
    }
    
    // Pulse the ring
    if (this.channelRing.material) {
      // Color becomes more intense as progress increases
      const intensity = 0.7 + (channelProgress * 0.3);
      this.channelRing.material.color.setRGB(intensity, intensity, intensity);
      
      // Pulsing opacity
      const pulseFactor = 0.7 + Math.sin(elapsed * 5) * 0.3;
      this.channelRing.material.opacity = pulseFactor * 0.8;
    }
    
    // Change brightness of the progress bar based on progress
    if (this.channelBar.material) {
      // Color becomes more intense
      const intensity = 0.7 + (channelProgress * 0.3);
      this.channelBar.material.color.setRGB(intensity, intensity, intensity);
    }
    
    // Scale the ring slightly for a pulsing effect
    const ringPulse = 1 + Math.sin(elapsed * 8) * 0.05;
    this.channelRing.scale.set(ringPulse, ringPulse, 1);
  }
  
  /**
   * Calculate beam width based on channel progress
   * @param {number} progress - 0 to 1 progress of channeling
   * @returns {number} Beam width
   */
  calculateBeamWidth(progress) {
    // Start thin (0.05) and grow up to 0.5 units wide at max channel
    return 0.05 + (progress * progress * 0.45); // Quadratic growth curve
  }
  
  /**
   * Calculate damage based on channel progress
   * @param {number} progress - 0 to 1 progress of channeling
   * @returns {number} Damage value
   */
  calculateDamage(progress) {
    // Start with base damage (1) and grow up to 10 at max channel
    // Cubic curve gives rapid growth toward the end for dramatic effect
    return 1 + (progress * progress * progress * 9); // Cubic growth for damage
  }
  
  /**
   * Fire the laser beam after channeling
   */
  fireLaser() {
    if (!this.isChanneling) return;
    
    this.isChanneling = false;
    this.laserActive = true;
    clearTimeout(this.channelTimeout);
    
    // Calculate channel time and progress
    const elapsed = (Date.now() - this.channelStartTime) / 1000;
    const channelProgress = Math.min(1, elapsed / this.channelMaxDuration);
    
    // Calculate beam width and damage based on channel time
    const beamWidth = this.calculateBeamWidth(channelProgress);
    const damage = this.calculateDamage(channelProgress);
    
    // Play laser fire sound effect
    this.eventBus.emit('audio:play', { 
      sound: 'objectRelease', // Reuse existing sound as placeholder
      volume: 0.8 + (channelProgress * 0.2),
      pitch: 1.2 - (channelProgress * 0.4) // Higher pitch for laser
    });
    
    // Get camera position and direction for laser origin
    let cameraPosition, cameraDirection;
    
    this.eventBus.emit('camera:get-position', (position) => {
      cameraPosition = position;
    });
    
    this.eventBus.emit('camera:get-direction', (direction) => {
      cameraDirection = direction;
    });
    
    if (!cameraPosition || !cameraDirection || !this.channelContext?.scene) {
      console.error('Missing context for laser beam');
      this.laserActive = false;
      this.removeChannelingVisuals();
      return;
    }
    
    // Create the laser beam visual
    const laserOrigin = cameraPosition.clone();
    const laserDirection = cameraDirection.clone();
    
    // Create a raycaster to check for enemy hits
    const raycaster = new THREE.Raycaster(laserOrigin, laserDirection);
    raycaster.camera = this.channelContext.camera; // Set camera for proper sprite raycasting
    
    // Create the laser visual effect
    const laserOptions = {
      width: beamWidth,
      color: 0xFFFFFF,
      duration: this.laserDuration,
      origin: laserOrigin,
      direction: laserDirection
    };
    
    // Check for hits and apply damage to all enemies in the path
    this.damageEnemiesInLaserPath(raycaster, this.channelContext.scene, damage);
    
    // Create laser beam visual effect
    this.createLaserVisual(laserOptions);
    
    // Remove channeling visuals
    this.removeChannelingVisuals();
    
    // Reset laser active state after duration
    setTimeout(() => {
      this.laserActive = false;
    }, this.laserDuration * 1000);
  }
  
  /**
   * Create visual laser beam effect
   * @param {Object} options - Options for the laser beam
   */
  createLaserVisual(options) {
    const { width, color, duration, origin, direction } = options;
    const scene = this.channelContext?.scene;
    
    if (!scene) return;
    
    // Set a long distance for the laser beam
    const laserLength = 100; // Very long to ensure it goes beyond the scene
    
    // Create laser geometry - cylinder pointing in the z direction
    const laserGeometry = new THREE.CylinderGeometry(width, width, laserLength, 16, 1, true);
    laserGeometry.rotateX(Math.PI / 2); // Rotate to point forward
    laserGeometry.translate(0, 0, laserLength / 2); // Move origin to start of beam
    
    // Create material with glow effect
    const laserMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    
    // Create glow effect material (larger radius)
    const glowGeometry = new THREE.CylinderGeometry(width * 2, width * 2, laserLength, 16, 1, true);
    glowGeometry.rotateX(Math.PI / 2);
    glowGeometry.translate(0, 0, laserLength / 2);
    
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    
    // Create meshes
    const laserMesh = new THREE.Mesh(laserGeometry, laserMaterial);
    const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
    
    // Create container for the laser
    const laserContainer = new THREE.Group();
    laserContainer.add(laserMesh);
    laserContainer.add(glowMesh);
    
    // Position and orient the laser from camera
    laserContainer.position.copy(origin);
    
    // Look in the direction of the laser
    const lookTarget = origin.clone().add(direction);
    laserContainer.lookAt(lookTarget);
    
    console.log(scene);

    // Add to scene
    scene.add(laserContainer);
    
    // Start animation for fading out
    const startTime = Date.now();
    let animationFrameId = null;
    
    const animate = () => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      
      if (elapsedTime >= duration) {
        // Effect duration complete
        cleanup();
        return;
      }
      
      // Calculate fade progress (0 to 1)
      const fadeProgress = elapsedTime / duration;
      
      // Fade out opacity
      laserMaterial.opacity = 0.8 * (1 - fadeProgress);
      glowMaterial.opacity = 0.3 * (1 - fadeProgress);
      
      // Slight pulse effect
      const pulse = 1 + Math.sin(elapsedTime * 20) * 0.1 * (1 - fadeProgress);
      laserMesh.scale.set(pulse, 1, pulse);
      glowMesh.scale.set(pulse * 0.8, 1, pulse * 0.8);
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    // Start animation
    animate();
    
    // Cleanup function
    const cleanup = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      scene.remove(laserContainer);
      
      // Dispose of geometries and materials
      laserGeometry.dispose();
      laserMaterial.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
    };
  }
  
  /**
   * Apply damage to all enemies in the laser beam's path
   * @param {THREE.Raycaster} raycaster - Raycaster for hit detection
   * @param {THREE.Scene} scene - Three.js scene
   * @param {number} damage - Amount of damage to deal
   */
  damageEnemiesInLaserPath(raycaster, scene, damage) {
    // Perform raycast
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    // Track which enemies have been damaged to avoid duplicate hits
    const hitEnemies = new Set();
    
    // Check each intersection for enemy objects
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
      
      // If found enemy ID and haven't hit this enemy already
      if (enemyId && !hitEnemies.has(enemyId)) {
        // Add to set of hit enemies
        hitEnemies.add(enemyId);
        
        // Emit spell hit event
        this.eventBus.emit('spell:hit', {
          targetId: enemyId,
          spellId: this.id,
          power: damage,
          hitPoint: intersect.point
        });
        
        // Create hit effect at the impact point
        this.createLaserImpactEffect(intersect.point);
      }
    }
    
    // Return number of enemies hit
    return hitEnemies.size;
  }
  
  /**
   * Create a visual effect at the laser impact point
   * @param {THREE.Vector3} position - Impact position
   */
  createLaserImpactEffect(position) {
    const scene = this.channelContext?.scene;
    if (!scene) return;
    
    // Create a flash of light at the impact point
    const impactGeometry = new THREE.SphereGeometry(0.2, 16, 16);
    const impactMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    
    const impactMesh = new THREE.Mesh(impactGeometry, impactMaterial);
    impactMesh.position.copy(position);
    
    scene.add(impactMesh);
    
    // Animate the impact effect
    const startTime = Date.now();
    const duration = 0.3; // Duration of impact effect
    let animationFrameId = null;
    
    const animate = () => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      
      if (elapsedTime >= duration) {
        // Effect duration complete
        cleanup();
        return;
      }
      
      // Expand and fade out
      const size = 0.2 + elapsedTime * 2;
      impactMesh.scale.set(size, size, size);
      
      // Fade out
      impactMaterial.opacity = 0.8 * (1 - elapsedTime / duration);
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    // Start animation
    animate();
    
    // Cleanup function
    const cleanup = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      scene.remove(impactMesh);
      impactGeometry.dispose();
      impactMaterial.dispose();
    };
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
   * Override drawShape to show a custom graphic for space bar trigger
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
    context.strokeStyle = this.visualOptions.strokeColor || '#FFFFFF';
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
    context.fillStyle = '#000000';
    context.fillText('HOLD SPACE', centerX, centerY + barHeight/2);
    
    // Draw laser beam illustration
    this.drawLaserIllustration(context, centerX, centerY - 100, width, height);
    
    // Add an instruction for holding
    context.font = 'italic 20px serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#555555';
    context.fillText('Hold longer for more powerful laser', centerX, centerY + barHeight + 40);
    
    // Draw page number
    context.font = 'bold 20px serif';
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillStyle = '#555555';
    context.fillText(`Page ${this.page}`, 20, height - 20);
  }
  
  /**
   * Draw laser beam illustration
   * @param {CanvasRenderingContext2D} context - Canvas context 
   * @param {number} centerX - Center X position
   * @param {number} centerY - Center Y position
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   */
  drawLaserIllustration(context, centerX, centerY, width, height) {
    // Draw three laser beams of different thicknesses
    
    // Create a gradient for beam glow
    const beamGradient = context.createLinearGradient(centerX - 100, 0, centerX + 100, 0);
    beamGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    beamGradient.addColorStop(0.5, 'rgba(255, 255, 255, 1)');
    beamGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    
    // Draw person figure (simplified shooter)
    context.fillStyle = '#555555';
    context.beginPath();
    context.arc(centerX - 120, centerY, 10, 0, Math.PI * 2); // Head
    context.fill();
    
    context.beginPath();
    context.moveTo(centerX - 120, centerY + 10);
    context.lineTo(centerX - 120, centerY + 30); // Body
    context.lineTo(centerX - 110, centerY + 25); // Arm pointing forward
    context.stroke();
    
    const beams = [
      { x: centerX - 90, width: 2, label: 'Quick Tap' },
      { x: centerX, width: 5, label: 'Medium Hold' },
      { x: centerX + 90, width: 10, label: 'Full Charge' }
    ];
    
    // Draw beams
    beams.forEach(beam => {
      // Draw beam
      context.lineWidth = beam.width;
      context.strokeStyle = '#FFFFFF';
      context.beginPath();
      context.moveTo(centerX - 110, centerY + 25); // Start from the "arm"
      context.lineTo(beam.x + 100, centerY + 25); // Extend to the right
      context.stroke();
      
      // Draw glow effect
      context.lineWidth = beam.width + 4;
      context.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      context.beginPath();
      context.moveTo(centerX - 110, centerY + 25);
      context.lineTo(beam.x + 100, centerY + 25);
      context.stroke();
      
      // Draw hit impact
      context.fillStyle = '#FFFFFF';
      context.beginPath();
      context.arc(beam.x + 100, centerY + 25, beam.width * 1.5, 0, Math.PI * 2);
      context.fill();
      
      // Draw glow around impact
      context.fillStyle = 'rgba(255, 255, 255, 0.3)';
      context.beginPath();
      context.arc(beam.x + 100, centerY + 25, beam.width * 3, 0, Math.PI * 2);
      context.fill();
      
      // Label the beam
      context.font = 'italic 16px serif';
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      context.fillStyle = '#555555';
      context.fillText(beam.label, beam.x + 50, centerY + 65);
    });
    
    // Draw enemy hit by strongest beam
    context.fillStyle = '#AA3333';
    context.beginPath();
    context.arc(centerX + 100, centerY + 25, 15, 0, Math.PI * 2);
    context.fill();
    
    // Draw damage visualization
    context.font = 'bold 14px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#FFFFFF';
    context.fillText('!', centerX + 100, centerY + 25);
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
    context.fillStyle = '#555555';
    context.fillText(this.name, width / 2, margin);
    
    // Draw horizontal divider
    context.strokeStyle = '#555555';
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
    const instructions = 'This spell fires a powerful white laser beam that damages all enemies in its path. Hold the SPACE key longer to increase the beam\'s thickness and damage potential. The laser fires upon releasing the key.';
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
    context.fillStyle = '#555555';
    context.textAlign = 'left';
    context.textBaseline = 'top';
    
    const tips = [
      '• Tap SPACE - Thin laser beam (1 damage)',
      '• Hold SPACE briefly - Medium laser beam (3-4 damage)',
      '• Hold SPACE long - Thick devastating beam (8-10 damage)'
    ];
    
    tips.forEach((tip, i) => {
      context.fillText(
        tip,
        margin + 20,
        margin + 320 + (i * 30),
        width - (margin * 2) - 20
      );
    });
    
    // Draw key binding at the bottom
    context.font = 'bold 24px serif';
    context.fillStyle = '#555555';
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
   */
  dispose() {
    // Stop any active channeling
    if (this.isChanneling) {
      this.removeChannelingVisuals();
      this.isChanneling = false;
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
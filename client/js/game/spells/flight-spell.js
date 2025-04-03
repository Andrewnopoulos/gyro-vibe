import * as THREE from 'three';
import { Spell } from './spell.js';

export class FlightSpell extends Spell {
  constructor(options) {
    super({
      id: 'flight',
      name: 'Leviosa',
      shape: 'space',
      description: 'Channel magical energy to propel yourself through the air. Hold longer to build up more momentum.',
      page: options.page,
      cooldown: options.cooldown || 1,
      visualOptions: {
        strokeColor: '#00AAFF',
        lineWidth: 3
      },
      effectKeyDown: (context) => this.startChanneling(context),
      effectKeyUp: (context) => this.releaseFlight(context)
    });

    this.eventBus = options.eventBus;
    
    this.isChanneling = false;
    this.channelStartTime = 0;
    this.channelMaxDuration = 2.5; // Maximum channel time in seconds
    this.maxVelocity = 35; // Maximum velocity multiplier (further increased for stronger effect)
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.updateInterval = setInterval(() => {
      if (this.isChanneling) {
        this.updateChannelingVisuals();
      }
    }, 50);
  }

  startChanneling(context) {
    if (this.isChanneling) {
      return; // Already channeling
    }
    
    this.isChanneling = true;
    this.channelStartTime = Date.now();
    this.channelContext = context;
    
    const isRemote = context?.isRemote;
    
    if (!isRemote) {
      // Get camera position and direction for visual effects
      let cameraPosition = null;
      let cameraDirection = null;
      
      this.eventBus.emit('camera:get-position', (position) => {
        if (position) {
          cameraPosition = {
            x: position.x,
            y: position.y,
            z: position.z
          };
        }
      });
      
      this.eventBus.emit('camera:get-direction', (direction) => {
        if (direction) {
          cameraDirection = {
            x: direction.x,
            y: direction.y,
            z: direction.z
          };
        }
      });
      
      // Play channeling sound
      this.eventBus.emit('audio:play', { 
        sound: 'spawnObject',
        volume: 0.5,
        pitch: 1.2
      });
      
      // Create visual effect for channeling
      this.createChannelingVisual(context);
    }
    
    // Set a maximum channel time
    this.channelTimeout = setTimeout(() => {
      if (this.isChanneling) {
        this.releaseFlight(this.channelContext);
      }
    }, this.channelMaxDuration * 1000);
  }
  
  /**
   * Create visual feedback on the spellbook while channeling
   * @param {Object} context - Casting context
   */
  createChannelingVisual(context) {
    if (!context || !context.spellbook) return;
    
    // Get the spellbook for visual effects
    const spellbook = context.spellbook;
    
    // Create a wind effect around the book
    const windGroup = new THREE.Group();
    windGroup.position.set(0, 0.2, 0.05);
    
    // Create wind particle effect
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const distance = 0.15 + Math.random() * 0.1;
      const particleGeometry = new THREE.SphereGeometry(0.002 + Math.random() * 0.004);
      const particleMaterial = new THREE.MeshBasicMaterial({
        color: 0x00AAFF,
        transparent: true,
        opacity: 0.7,
      });
      
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      particle.position.set(
        distance * Math.cos(angle),
        0.05 + Math.random() * 0.2,
        distance * Math.sin(angle)
      );
      
      // Store initial position for animation
      particle.userData.initialY = particle.position.y;
      particle.userData.speed = 0.002 + Math.random() * 0.004;
      particle.userData.angle = angle;
      
      windGroup.add(particle);
    }
    
    this.windEffect = windGroup;
    this.windEffect.userData.isChannelingEffect = true;
    spellbook.add(this.windEffect);
    
    // Create a progress bar for channeling
    const barGeometry = new THREE.PlaneGeometry(0.01, 0.03);
    const barMaterial = new THREE.MeshBasicMaterial({
      color: 0x00AAFF,
      transparent: true,
      opacity: 0.8
    });
    
    this.channelBar = new THREE.Mesh(barGeometry, barMaterial);
    this.channelBar.position.set(-0.2, -0.28, 0.02);
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
    this.channelBarBg.position.set(0, -0.28, 0.015);
    this.channelBarBg.userData.isChannelingEffect = true;
    spellbook.add(this.channelBarBg);
  }
  
  /**
   * Update visual effects on the spellbook while channeling
   */
  updateChannelingVisuals() {
    if (!this.isChanneling || !this.windEffect || !this.channelBar) return;
    
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
    
    // Update wind particle movement and color
    if (this.windEffect && this.windEffect.children) {
      const intensity = 0.7 + (channelProgress * 0.3);
      
      // Animate each particle
      for (let i = 0; i < this.windEffect.children.length; i++) {
        const particle = this.windEffect.children[i];
        
        // Spiral upward movement
        particle.position.y += particle.userData.speed * (1 + channelProgress);
        if (particle.position.y > particle.userData.initialY + 0.3) {
          particle.position.y = particle.userData.initialY;
        }
        
        // Spiral around center
        const angle = particle.userData.angle + (elapsed * 2 * (1 + (i % 3) * 0.2));
        const distance = 0.15 + (Math.sin(elapsed * 3 + i) * 0.05) + (channelProgress * 0.05);
        particle.position.x = distance * Math.cos(angle);
        particle.position.z = distance * Math.sin(angle);
        
        // Update color and opacity based on channel progress
        if (particle.material) {
          // Shift from blue to white as charging progresses
          const blue = 1.0;
          const green = 0.6 + (channelProgress * 0.4);
          const red = 0.0 + (channelProgress * 1.0);
          particle.material.color.setRGB(red, green, blue);
          
          // Pulsing opacity
          const opacityPulse = 0.5 + Math.sin(elapsed * 8 + i) * 0.3 + (channelProgress * 0.3);
          particle.material.opacity = opacityPulse;
        }
      }
    }
    
    // Change brightness of the progress bar based on progress
    if (this.channelBar.material) {
      // Color becomes more intense as it charges
      const r = 0.0 + (channelProgress * 1.0);
      const g = 0.6 + (channelProgress * 0.4);
      const b = 1.0;
      this.channelBar.material.color.setRGB(r, g, b);
      
      // Add pulsing effect
      const barPulse = 0.7 + Math.sin(elapsed * 10) * 0.2;
      this.channelBar.material.opacity = barPulse;
    }
  }
  
  /**
   * Release the flight spell and apply velocity to player
   */
  releaseFlight(context) {
    // If not channeling, return an empty cast data object
    if (!this.isChanneling) {
      return null;
    }
    
    this.isChanneling = false;
    clearTimeout(this.channelTimeout);
    
    // Calculate channel time and progress
    const elapsed = (Date.now() - this.channelStartTime) / 1000;
    const channelProgress = Math.min(1, elapsed / this.channelMaxDuration);
    
    // Calculate velocity based on channel time
    const velocityMultiplier = this.calculateVelocity(channelProgress);
    
    // Play flight launch sound effect
    this.eventBus.emit('audio:play', { 
      sound: 'objectRelease',
      volume: 0.8 + (channelProgress * 0.2),
      pitch: 0.8 + (channelProgress * 0.4)
    });
    
    // Get weapon direction for applying velocity
    let weaponOrigin = null;
    let weaponDirection = null;
    let hasWeaponData = false;
    
    // Try to get data from gravity gun controller first
    if (this.channelContext && this.channelContext.gravityGunController) {
      const raycastData = this.channelContext.gravityGunController.getWeaponRaycastData();
      if (raycastData && raycastData.valid) {
        weaponOrigin = raycastData.position.clone();
        weaponDirection = raycastData.direction.clone().normalize();
        hasWeaponData = true;
      }
    }
    
    // Try weapon raycast data as fallback
    if (!hasWeaponData) {
      this.eventBus.emit('weapon:get-raycast-data', (raycastData) => {
        if (raycastData && raycastData.origin && raycastData.direction) {
          weaponOrigin = raycastData.origin.clone();
          weaponDirection = raycastData.direction.clone();
          hasWeaponData = true;
        }
      });
    }
    
    // If we still couldn't get weapon data, fall back to camera data
    if (!hasWeaponData) {
      let cameraPosition, cameraDirection;
      
      this.eventBus.emit('camera:get-position', (position) => {
        cameraPosition = position;
      });
      
      this.eventBus.emit('camera:get-direction', (direction) => {
        cameraDirection = direction;
      });
      
      if (!cameraPosition || !cameraDirection) {
        console.error('Missing context for flight spell');
        this.removeChannelingVisuals();
        return null;
      }
      
      weaponOrigin = cameraPosition.clone();
      weaponDirection = cameraDirection.clone();
    }
    
    // Apply velocity to player
    if (weaponDirection) {
      // Create velocity vector from weapon direction
      const velocity = weaponDirection.clone().multiplyScalar(velocityMultiplier);
      
      // Apply velocity to player through FirstPersonController
      this.eventBus.emit('firstperson:apply-velocity', {
        velocity: {
          x: velocity.x,
          y: velocity.y,
          z: velocity.z
        },
        gravityDelay: 5, // 5 second gravity delay as requested
        preventGroundPenetration: true  // Prevent going below ground
      });
      
      // Create visual effect at player position
      this.createFlightEffect(weaponOrigin.clone(), weaponDirection.clone().negate(), channelProgress);
    }
    
    // Remove channeling visuals
    this.removeChannelingVisuals();
    
    // Return cast data with flight information
    return {
      spellId: this.id,
      targetPosition: weaponOrigin,
      targetId: null,
      cameraPosition: weaponOrigin,
      targetDirection: weaponDirection,
      spellData: {
        channelProgress: channelProgress,
        velocityMultiplier: velocityMultiplier,
        isKeyDown: false,
        isKeyUp: true
      }
    };
  }
  
  /**
   * Calculate velocity multiplier based on channel progress
   * @param {number} progress - 0 to 1 progress of channeling
   * @returns {number} Velocity multiplier
   */
  calculateVelocity(progress) {
    // Use a quadratic curve for better feel - slow start, fast finish
    // Add a higher minimum boost even for quick taps
    return 12 + (progress * progress * this.maxVelocity); 
  }
  
  /**
   * Create visual flight effect at player position
   * @param {THREE.Vector3} position - Origin position
   * @param {THREE.Vector3} direction - Direction vector (opposite of flight direction)
   * @param {number} channelProgress - Channel progress 0-1
   */
  createFlightEffect(position, direction, channelProgress) {
    const scene = this.channelContext?.scene;
    if (!scene) return;
    
    // Create a burst effect at the player position
    const burstGeometry = new THREE.SphereGeometry(0.5, 16, 16);
    const burstMaterial = new THREE.MeshBasicMaterial({
      color: 0x00AAFF,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    
    const burstMesh = new THREE.Mesh(burstGeometry, burstMaterial);
    burstMesh.position.copy(position);
    
    // Create trail particles
    const trailGroup = new THREE.Group();
    trailGroup.position.copy(position);
    
    // Create trail particles behind the player
    const particleCount = 20 + Math.floor(channelProgress * 30);
    for (let i = 0; i < particleCount; i++) {
      const particleGeometry = new THREE.SphereGeometry(0.05 + Math.random() * 0.1);
      const particleMaterial = new THREE.MeshBasicMaterial({
        color: 0x00AAFF,
        transparent: true,
        opacity: 0.5 + Math.random() * 0.3,
        blending: THREE.AdditiveBlending
      });
      
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      
      // Position particles in a cone shape behind the player
      const distance = (Math.random() * 2) * (1 + channelProgress);
      const spreadAngle = Math.PI / 4; // 45-degree cone
      
      // Random angle within cone
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * spreadAngle;
      
      // Convert spherical to cartesian coordinates
      const x = distance * Math.sin(phi) * Math.cos(theta);
      const y = distance * Math.sin(phi) * Math.sin(theta);
      const z = distance * Math.cos(phi);
      
      // Create direction-aligned vector
      const localPos = new THREE.Vector3(x, y, z);
      
      // Create rotation matrix from direction
      const rotationMatrix = new THREE.Matrix4();
      const up = new THREE.Vector3(0, 1, 0);
      rotationMatrix.lookAt(new THREE.Vector3(0, 0, 0), direction, up);
      
      // Apply rotation to local position
      localPos.applyMatrix4(rotationMatrix);
      
      // Set final position
      particle.position.copy(localPos);
      
      // Store random speed for animation
      particle.userData.speed = 0.1 + Math.random() * 0.2;
      particle.userData.direction = localPos.clone().normalize();
      
      trailGroup.add(particle);
    }
    
    // Add to scene
    scene.add(burstMesh);
    scene.add(trailGroup);
    
    // Animate the flight effect
    const startTime = Date.now();
    const duration = 0.8; // Effect duration in seconds
    let animationFrameId = null;
    
    const animate = () => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      
      if (elapsedTime >= duration) {
        // Effect duration complete
        cleanup();
        return;
      }
      
      // Animation progress (0 to 1)
      const progress = elapsedTime / duration;
      
      // Expand and fade out burst
      const burstScale = 1 + progress * 2 * (1 + channelProgress);
      burstMesh.scale.set(burstScale, burstScale, burstScale);
      burstMaterial.opacity = 0.7 * (1 - progress);
      
      // Animate trail particles
      trailGroup.children.forEach((particle, index) => {
        // Move particles along their direction
        const moveSpeed = particle.userData.speed * (1 + progress) * (1 + channelProgress);
        particle.position.add(particle.userData.direction.clone().multiplyScalar(moveSpeed));
        
        // Fade out particles
        if (particle.material) {
          particle.material.opacity = 0.5 * (1 - progress);
        }
      });
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    // Start animation
    animate();
    
    // Cleanup function
    const cleanup = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      // Remove meshes from scene
      scene.remove(burstMesh);
      scene.remove(trailGroup);
      
      // Dispose geometries and materials
      burstGeometry.dispose();
      burstMaterial.dispose();
      
      // Clean up trail particles
      trailGroup.children.forEach(particle => {
        if (particle.geometry) particle.geometry.dispose();
        if (particle.material) particle.material.dispose();
      });
    };
  }
  
  /**
   * Remove all channeling visual effects from the spellbook
   */
  removeChannelingVisuals() {
    // Clean up wind effect
    if (this.windEffect) {
      if (this.windEffect.parent) {
        this.windEffect.parent.remove(this.windEffect);
      }
      this.windEffect = null;
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
    
    // Additionally clean up any other channeling effects
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
    context.strokeStyle = this.visualOptions.strokeColor || '#00AAFF';
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
    
    // Draw flight illustration
    this.drawFlightIllustration(context, centerX, centerY - 100, width, height);
    
    // Add an instruction for holding
    context.font = 'italic 20px serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#555555';
    context.fillText('Hold longer to gain more momentum', centerX, centerY + barHeight + 40);
    
    // Draw page number
    context.font = 'bold 20px serif';
    context.textAlign = 'left';
    context.textBaseline = 'bottom';
    context.fillStyle = '#555555';
    context.fillText(`Page ${this.page}`, 20, height - 20);
  }
  
  /**
   * Draw flight spell illustration
   * @param {CanvasRenderingContext2D} context - Canvas context 
   * @param {number} centerX - Center X position
   * @param {number} centerY - Center Y position
   * @param {number} width - Canvas width
   * @param {number} height - Canvas height
   */
  drawFlightIllustration(context, centerX, centerY, width, height) {
    // Draw figure being propelled through the air
    
    // Draw person figure
    context.fillStyle = '#555555';
    context.beginPath();
    context.arc(centerX, centerY, 10, 0, Math.PI * 2); // Head
    context.fill();
    
    context.beginPath();
    context.moveTo(centerX, centerY + 10);
    context.lineTo(centerX, centerY + 30); // Body
    context.moveTo(centerX, centerY + 15);
    context.lineTo(centerX - 15, centerY + 5); // Left arm up
    context.lineTo(centerX + 15, centerY + 5); // Right arm up
    context.moveTo(centerX, centerY + 30);
    context.lineTo(centerX - 10, centerY + 45); // Left leg
    context.lineTo(centerX + 10, centerY + 45); // Right leg
    context.stroke();
    
    // Draw three flight trajectories of different strengths
    const trajectories = [
      { x: centerX - 100, height: 30, label: 'Quick Tap' },
      { x: centerX, height: 60, label: 'Medium Hold' },
      { x: centerX + 100, height: 100, label: 'Full Charge' }
    ];
    
    // Draw trajectories
    trajectories.forEach(traj => {
      // Draw trajectory arc
      context.strokeStyle = '#00AAFF';
      context.lineWidth = 2;
      context.beginPath();
      
      // Arc path
      context.moveTo(traj.x - 40, centerY + 20);
      context.quadraticCurveTo(
        traj.x,
        centerY - traj.height,
        traj.x + 40,
        centerY + 20
      );
      context.stroke();
      
      // Draw small figure at peak of arc
      if (traj === trajectories[2]) { // Only for full charge
        const figureX = traj.x;
        const figureY = centerY - traj.height + 15;
        
        context.fillStyle = '#555555';
        context.beginPath();
        context.arc(figureX, figureY, 5, 0, Math.PI * 2); // Head
        context.fill();
        
        context.beginPath();
        context.moveTo(figureX, figureY + 5);
        context.lineTo(figureX, figureY + 15); // Body
        context.moveTo(figureX, figureY + 7);
        context.lineTo(figureX - 7, figureY + 2); // Left arm
        context.lineTo(figureX + 7, figureY + 2); // Right arm
        context.moveTo(figureX, figureY + 15);
        context.lineTo(figureX - 5, figureY + 22); // Left leg
        context.lineTo(figureX + 5, figureY + 22); // Right leg
        context.stroke();
      }
      
      // Draw wind/propulsion lines
      context.strokeStyle = '#00AAFF';
      context.lineWidth = 1;
      
      const windCount = traj === trajectories[0] ? 3 : 
                         traj === trajectories[1] ? 5 : 7;
      
      for (let i = 0; i < windCount; i++) {
        const windX = traj.x - 40 + (80 * (i / (windCount - 1)));
        const baseY = centerY + 20;
        const windHeight = 15 + (traj === trajectories[2] ? 10 : 0);
        
        context.beginPath();
        context.moveTo(windX, baseY);
        context.lineTo(windX, baseY - windHeight);
        context.stroke();
      }
      
      // Label the trajectory
      context.font = 'italic 16px serif';
      context.textAlign = 'center';
      context.textBaseline = 'bottom';
      context.fillStyle = '#555555';
      context.fillText(traj.label, traj.x, centerY + 65);
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
    context.fillStyle = '#00AAFF';
    context.fillText(this.name, width / 2, margin);
    
    // Draw horizontal divider
    context.strokeStyle = '#00AAFF';
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
    const instructions = 'This spell channels magical energy to propel you through the air in the direction you are aiming. The longer you hold the SPACE key, the more momentum you will gain upon release.';
    this.wrapText(
      context,
      instructions,
      margin,
      margin + 180,
      width - (margin * 2),
      32
    );
    
    // Draw usage tips
    context.font = 'bold 18px serif';
    context.fillStyle = '#00AAFF';
    context.textAlign = 'left';
    context.textBaseline = 'top';
    
    const tips = [
      '• Tap SPACE - Small boost (minimum flight)',
      '• Hold SPACE briefly - Medium boost (moderate flight)',
      '• Hold SPACE for maximum - Powerful boost (maximum flight)',
      '• Point upward for more height, forward for distance',
      '• This spell prevents you from going below ground level'
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
    context.fillStyle = '#00AAFF';
    context.textAlign = 'center';
    context.textBaseline = 'bottom';
    context.fillText('HOLD SPACE key to channel', width / 2, height - margin - 30);
    
    // Draw space bar shape hint
    context.strokeStyle = '#00AAFF';
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
    
    // Clear any timeouts
    if (this.channelTimeout) {
      clearTimeout(this.channelTimeout);
      this.channelTimeout = null;
    }
  }
}
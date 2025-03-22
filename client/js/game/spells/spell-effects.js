import * as THREE from 'three';

/**
 * Collection of spell effect implementations
 */
export const SpellEffects = {
  /**
   * Creates a shield effect
   * @param {Object} context - Casting context
   * @param {Object} options - Effect options
   * @returns {Object} Effect instance and cleanup function
   */
  createShield(context, options = {}) {
    const { spellbook, scene } = context;
    const duration = options.duration || 8;
    const shieldColor = options.color || 0x00AAFF;
    
    // Create shield mesh
    const radius = 1.5;
    const geometry = new THREE.SphereGeometry(radius, 32, 32);
    const material = new THREE.MeshBasicMaterial({
      color: shieldColor,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    
    // Create second layer for better visual effect
    const innerGeometry = new THREE.SphereGeometry(radius * 0.95, 24, 24);
    const innerMaterial = new THREE.MeshBasicMaterial({
      color: 0xFFFFFF,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    
    // Get camera position for shield placement
    const shield = new THREE.Mesh(geometry, material);
    const innerShield = new THREE.Mesh(innerGeometry, innerMaterial);
    
    // Create shield container
    const shieldContainer = new THREE.Group();
    shieldContainer.add(shield);
    shieldContainer.add(innerShield);
    
    // Position shield around player
    if (context.camera) {
      shieldContainer.position.copy(context.camera.position);
    } else {
      // Fallback position if camera not available
      shieldContainer.position.set(0, 0, 0);
    }
    
    // Add to scene
    if (scene) {
      scene.add(shieldContainer);
    } else {
      console.warn('No scene available in context');
    }
    
    // Setup animation
    const startTime = Date.now();
    let animationFrameId = null;
    
    const animate = () => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      
      if (elapsedTime >= duration) {
        // Effect duration complete
        cleanup();
        return;
      }
      
      // Update shield position to follow camera
      if (context.camera) {
        shieldContainer.position.copy(context.camera.position);
      }
      
      // Pulse effect
      const pulseFactor = 1 + Math.sin(elapsedTime * 2.5) * 0.05;
      shield.scale.set(pulseFactor, pulseFactor, pulseFactor);
      
      // Rotate inner shield for magical effect
      innerShield.rotation.y += 0.01;
      innerShield.rotation.x += 0.005;
      
      // Fade out towards the end
      if (elapsedTime > duration - 2) {
        const fadeOutFactor = (duration - elapsedTime) / 2;
        material.opacity = 0.3 * fadeOutFactor;
        innerMaterial.opacity = 0.1 * fadeOutFactor;
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    // Start animation
    animate();
    
    // Create cleanup function
    const cleanup = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      if (scene) {
        scene.remove(shieldContainer);
      }
      geometry.dispose();
      material.dispose();
      innerGeometry.dispose();
      innerMaterial.dispose();
    };
    
    return {
      element: shieldContainer,
      cleanup
    };
  },
  
  /**
   * Creates a fireball effect
   * @param {Object} context - Casting context
   * @param {Object} options - Effect options
   * @returns {Object} Effect instance and cleanup function
   */
  createFireball(context, options = {}) {
    const { spellbook, scene, camera } = context;
    const power = options.power || 5;
    const speed = options.speed || 10;
    
    // Create fireball mesh
    const geometry = new THREE.SphereGeometry(0.2, 16, 16);
    const material = new THREE.MeshBasicMaterial({
      color: 0xFF5500,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending
    });
    
    const fireball = new THREE.Mesh(geometry, material);
    
    // Create fire particles
    const particleCount = 20;
    const particles = [];
    
    for (let i = 0; i < particleCount; i++) {
      const particleGeometry = new THREE.SphereGeometry(0.05 + Math.random() * 0.05, 8, 8);
      const particleMaterial = new THREE.MeshBasicMaterial({
        color: new THREE.Color(
          1.0,                       // Red
          0.3 + Math.random() * 0.4, // Green (30-70%)
          0.1                        // Blue
        ),
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending
      });
      
      const particle = new THREE.Mesh(particleGeometry, particleMaterial);
      
      // Random offset from center
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.05 + Math.random() * 0.1;
      particle.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        Math.random() * 0.1 - 0.05
      );
      
      // Store random movement values for animation
      particle.userData = {
        angle: Math.random() * Math.PI * 2,
        radius: 0.05 + Math.random() * 0.05,
        speed: 0.5 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2
      };
      
      fireball.add(particle);
      particles.push(particle);
    }
    
    // Create container for fireball
    const fireballContainer = new THREE.Group();
    fireballContainer.add(fireball);
    
    // Position fireball in front of player
    if (camera) {
      const direction = new THREE.Vector3(0, 0, -1);
      direction.applyQuaternion(camera.quaternion);
      
      fireballContainer.position.copy(camera.position);
      fireballContainer.position.add(direction.multiplyScalar(1)); // Start 1 unit in front
      
      // Store direction for movement
      fireballContainer.userData = {
        direction: direction,
        startPosition: camera.position.clone(),
        maxDistance: 30 // Maximum distance before cleanup
      };
    } else {
      // Fallback if no camera
      fireballContainer.position.set(0, 0, -2);
      fireballContainer.userData = {
        direction: new THREE.Vector3(0, 0, -1),
        startPosition: new THREE.Vector3(0, 0, 0),
        maxDistance: 30
      };
    }
    
    // Add to scene
    if (scene) {
      scene.add(fireballContainer);
    } else {
      console.warn('No scene available in context');
    }
    
    // Setup animation
    const startTime = Date.now();
    let animationFrameId = null;
    
    const animate = () => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      
      // Move fireball
      fireballContainer.position.add(
        fireballContainer.userData.direction.clone().multiplyScalar(speed * 0.1)
      );
      
      // Check distance
      const distance = fireballContainer.position.distanceTo(
        fireballContainer.userData.startPosition
      );
      
      if (distance > fireballContainer.userData.maxDistance) {
        // Reached maximum distance
        cleanup();
        return;
      }
      
      // Animate particles
      particles.forEach(particle => {
        const ud = particle.userData;
        
        // Circular motion with some randomness
        const newX = Math.cos(elapsedTime * ud.speed + ud.phase) * ud.radius;
        const newY = Math.sin(elapsedTime * ud.speed + ud.phase) * ud.radius;
        
        particle.position.x = newX;
        particle.position.y = newY;
        
        // Pulse size
        const pulse = 1 + Math.sin(elapsedTime * 3 + ud.phase) * 0.2;
        particle.scale.set(pulse, pulse, pulse);
      });
      
      // Rotate fireball
      fireball.rotation.x += 0.02;
      fireball.rotation.y += 0.03;
      
      // Pulse size
      const pulse = 1 + Math.sin(elapsedTime * 4) * 0.1;
      fireball.scale.set(pulse, pulse, pulse);
      
      // Check for collisions (simplified)
      // In a real game, you would use a physics system for this
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    // Start animation
    animate();
    
    // Create cleanup function
    const cleanup = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      if (scene) {
        scene.remove(fireballContainer);
      }
      
      // Dispose of all geometries and materials
      geometry.dispose();
      material.dispose();
      
      particles.forEach(particle => {
        particle.geometry.dispose();
        particle.material.dispose();
      });
    };
    
    return {
      element: fireballContainer,
      cleanup
    };
  },
  
  /**
   * Creates a telekinesis effect
   * @param {Object} context - Casting context
   * @param {Object} options - Effect options
   * @returns {Object} Effect instance and cleanup function
   */
  createTelekinesis(context, options = {}) {
    // This would be implemented in a real game to interact with physics objects
    console.log('Telekinesis spell cast - would interact with physics objects');
    
    // Simple visual effect
    const duration = options.duration || 5;
    const { spellbook, scene, camera } = context;
    
    // Create visual beam
    const beamGeometry = new THREE.CylinderGeometry(0.05, 0.01, 10, 8);
    beamGeometry.rotateX(Math.PI / 2);
    beamGeometry.translate(0, 0, -5); // Move origin to start of beam
    
    const beamMaterial = new THREE.MeshBasicMaterial({
      color: 0xAA88FF,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending
    });
    
    const beam = new THREE.Mesh(beamGeometry, beamMaterial);
    
    // Create container for beam
    const beamContainer = new THREE.Group();
    beamContainer.add(beam);
    
    // Position beam in front of player
    if (camera) {
      beamContainer.position.copy(camera.position);
      beamContainer.quaternion.copy(camera.quaternion);
    } else {
      // Fallback position
      beamContainer.position.set(0, 0, 0);
    }
    
    // Add to scene
    if (scene) {
      scene.add(beamContainer);
    } else {
      console.warn('No scene available in context');
    }
    
    // Setup animation
    const startTime = Date.now();
    let animationFrameId = null;
    
    const animate = () => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      
      if (elapsedTime >= duration) {
        // Effect duration complete
        cleanup();
        return;
      }
      
      // Update position to follow camera
      if (camera) {
        beamContainer.position.copy(camera.position);
        beamContainer.quaternion.copy(camera.quaternion);
      }
      
      // Beam effects
      const pulse = 0.8 + Math.sin(elapsedTime * 10) * 0.2;
      beam.scale.set(pulse, pulse, 1);
      
      // Fade out towards the end
      if (elapsedTime > duration - 1) {
        const fadeOutFactor = (duration - elapsedTime);
        beamMaterial.opacity = 0.4 * fadeOutFactor;
      }
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    // Start animation
    animate();
    
    // Create cleanup function
    const cleanup = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      if (scene) {
        scene.remove(beamContainer);
      }
      beamGeometry.dispose();
      beamMaterial.dispose();
    };
    
    return {
      element: beamContainer,
      cleanup
    };
  }
};
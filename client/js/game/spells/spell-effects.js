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
  },
  
  /**
   * Creates a black hole effect that attracts physics objects
   * @param {Object} context - Casting context
   * @param {Object} options - Effect options
   * @returns {Object} Effect instance and cleanup function
   */
  createBlackHole(context, options = {}) {
    const { scene, camera, eventBus } = context;
    const duration = options.duration || 3; // Default 3 seconds duration
    const strength = options.strength || 10; // Gravitational strength
    const radius = options.radius || 0.5; // Visual size of black hole
    const effectRadius = options.effectRadius || 10; // Range of gravitational effect
    
    // Create black hole core
    const coreGeometry = new THREE.SphereGeometry(radius, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.9
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    
    // Create event horizon glow
    const glowGeometry = new THREE.SphereGeometry(radius * 1.2, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x6600CC,
      transparent: true,
      opacity: 0.6,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    
    // Create outer disk
    const diskGeometry = new THREE.RingGeometry(radius * 1.2, radius * 3, 32);
    const diskMaterial = new THREE.MeshBasicMaterial({
      color: 0x9900FF,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending
    });
    const disk = new THREE.Mesh(diskGeometry, diskMaterial);
    disk.rotation.x = Math.PI / 2; // Make disk horizontal
    
    // Create particle system for swirling matter
    const particleCount = 100;
    const particleGeometry = new THREE.BufferGeometry();
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xBB33FF,
      size: 0.05,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });
    
    // Generate random particle positions in a disk shape
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = []; // Store velocities for animation
    
    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = (radius * 1.2) + (Math.random() * radius * 3);
      
      // Position on disk with random height variation
      particlePositions[i * 3] = Math.cos(angle) * distance; // x
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 0.2; // y (small height variation)
      particlePositions[i * 3 + 2] = Math.sin(angle) * distance; // z
      
      // Store orbital properties for animation
      particleVelocities.push({
        distance: distance,
        angle: angle,
        speed: 0.5 + (Math.random() * 1.5),
        vertSpeed: (Math.random() - 0.5) * 0.2
      });
    }
    
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(particleGeometry, particleMaterial);
    
    // Create container for black hole
    const blackHoleContainer = new THREE.Group();
    blackHoleContainer.add(core);
    blackHoleContainer.add(glow);
    blackHoleContainer.add(disk);
    blackHoleContainer.add(particles);
    
    // Position black hole in front of player initially, but then it stays fixed
    if (camera) {
      const direction = new THREE.Vector3(0, 0, -1);
      direction.applyQuaternion(camera.quaternion);
      
      // Position further out to give room for objects to be pulled in
      blackHoleContainer.position.copy(camera.position);
      blackHoleContainer.position.add(direction.multiplyScalar(5)); // 5 units in front
      
      // Make it at a good height to affect most physics objects
      // Using a higher position than before to have better effect on falling objects
      blackHoleContainer.position.y = 3.0; // Fixed height above ground
      
      // Store the initial position - we won't update this later
      const initialPosition = blackHoleContainer.position.clone();
      
      console.log('Black hole created at fixed position:', 
        initialPosition.x.toFixed(2), 
        initialPosition.y.toFixed(2), 
        initialPosition.z.toFixed(2)
      );
    } else {
      // Fallback position
      blackHoleContainer.position.set(0, 1.5, -5);
    }
    
    // Add to scene
    if (scene) {
      scene.add(blackHoleContainer);
    } else {
      console.warn('No scene available in context');
    }
    
    // Create a unique ID for this black hole's physics
    const blackHoleId = 'black_hole_' + Date.now();
    
    // Store affected objects
    const affectedObjects = new Set();
    
    // Setup physics attraction
    function applyGravitationalPull() {
      if (!eventBus) {
        console.error('Black hole has no eventBus to communicate with physics');
        return;
      }
      
      // Log the black hole position for debugging
      console.log('Black hole applying gravitational pull at:', 
        blackHoleContainer.position.x.toFixed(2),
        blackHoleContainer.position.y.toFixed(2),
        blackHoleContainer.position.z.toFixed(2),
        'with radius:', effectRadius,
        'and strength:', strength
      );
      
      // Deal damage to affected enemies caught in the black hole
      if (affectedObjects.size > 0 && options.damagePerSecond) {
        // Calculate damage for this interval (25ms)
        const intervalDamage = options.damagePerSecond / 40; // 40 times per second
        
        // Apply damage to each affected enemy
        affectedObjects.forEach(objectId => {
          if (objectId.startsWith('enemy_')) {
            eventBus.emit('entity:damage', {
              id: objectId,
              amount: intervalDamage,
              damageType: 'gravitational',
              sourceId: blackHoleId
            });
          }
        });
        
        // Clear the set after processing
        affectedObjects.clear();
      }
      
      // Emit an event to apply force to all nearby physics objects
      eventBus.emit('physics:apply-black-hole', {
        id: blackHoleId,
        position: {
          x: blackHoleContainer.position.x,
          y: blackHoleContainer.position.y,
          z: blackHoleContainer.position.z
        },
        strength: strength * 1.5, // Moderate strength increase (reduced from 2x to 1.5x)
        radius: effectRadius * 4 // Keeping the wider radius for better range
      });
    }
    
    // Apply gravitational pull effect frequently (every 25ms = ~40fps)
    // for smooth physics interaction with better performance
    const pullInterval = setInterval(applyGravitationalPull, 25);
    
    // Setup animation
    const startTime = Date.now();
    let animationFrameId = null;
    let explosionTriggered = false;
    
    const animate = () => {
      const elapsedTime = (Date.now() - startTime) / 1000;
      
      // Check if effect duration complete
      if (elapsedTime >= duration) {
        if (!explosionTriggered) {
          triggerExplosion();
          explosionTriggered = true;
        }
        
        // Check if we're done with explosion effect (give it 1 second)
        if (elapsedTime >= duration + 1) {
          cleanup();
          return;
        }
      }
      
      // Rotate disk for swirling effect
      disk.rotation.y += 0.01;
      
      // Animate particles - spiral movement
      const positions = particleGeometry.attributes.position.array;
      
      for (let i = 0; i < particleCount; i++) {
        const velocity = particleVelocities[i];
        
        // Update angle - particles move faster as they get closer to center
        const speedFactor = 1 + ((radius * 3 - velocity.distance) / (radius * 3)) * 2;
        velocity.angle += 0.01 * velocity.speed * speedFactor;
        
        // Gradually move particles closer to center (spiral effect)
        velocity.distance -= 0.005 * speedFactor;
        
        // If particle reaches center, reset it to outside
        if (velocity.distance < radius) {
          velocity.distance = radius * 3;
          velocity.angle = Math.random() * Math.PI * 2;
        }
        
        // Calculate new position
        positions[i * 3] = Math.cos(velocity.angle) * velocity.distance;
        positions[i * 3 + 2] = Math.sin(velocity.angle) * velocity.distance;
        
        // Small vertical oscillation
        positions[i * 3 + 1] += velocity.vertSpeed * 0.01;
        if (Math.abs(positions[i * 3 + 1]) > 0.2) {
          velocity.vertSpeed *= -1; // Reverse direction when reaching edge
        }
      }
      
      particleGeometry.attributes.position.needsUpdate = true;
      
      // Pulse the glow
      const pulseFactor = 1 + Math.sin(elapsedTime * 5) * 0.2;
      glow.scale.set(pulseFactor, pulseFactor, pulseFactor);
      
      // Make black hole grow slightly over time
      if (elapsedTime < duration) {
        const growthFactor = 1 + (elapsedTime / duration) * 0.5;
        core.scale.set(growthFactor, growthFactor, growthFactor);
      }
      
      // Explosion phase animation
      if (explosionTriggered) {
        const explosionTime = elapsedTime - duration;
        const explosionProgress = explosionTime / 1.0; // 1 second explosion
        
        // Rapidly expand and fade out
        const expandFactor = 1 + explosionProgress * 10;
        glow.scale.set(expandFactor, expandFactor, expandFactor);
        core.scale.set(expandFactor, expandFactor, expandFactor);
        disk.scale.set(expandFactor, expandFactor, expandFactor);
        
        // Fade out
        coreMaterial.opacity = 0.9 * (1 - explosionProgress);
        glowMaterial.opacity = 0.6 * (1 - explosionProgress);
        diskMaterial.opacity = 0.4 * (1 - explosionProgress);
        particleMaterial.opacity = 0.7 * (1 - explosionProgress);
        
        // Change color to explosive
        glowMaterial.color.setHex(0xFF5500);
        diskMaterial.color.setHex(0xFF9900);
      }
      
      // NOTE: We do NOT update the black hole position here, keeping it static in the world
      
      animationFrameId = requestAnimationFrame(animate);
    };
    
    // Function to trigger explosion
    function triggerExplosion() {
      // Clear the attraction interval
      clearInterval(pullInterval);
      
      // Emit explosion event to apply outward force
      if (eventBus) {
        eventBus.emit('physics:apply-explosion', {
          id: blackHoleId,
          position: {
            x: blackHoleContainer.position.x,
            y: blackHoleContainer.position.y,
            z: blackHoleContainer.position.z
          },
          strength: strength * 3, // Stronger outward force
          radius: effectRadius * 1.5 // Larger radius than attraction
        });
        
        // Apply explosion damage to enemies in range
        const explosionDamage = 3; // Fixed damage from explosion
        
        // Use a raycaster to find enemies in range
        const raycaster = new THREE.Raycaster();
        const center = new THREE.Vector3(
          blackHoleContainer.position.x,
          blackHoleContainer.position.y,
          blackHoleContainer.position.z
        );
        
        // Use multiple raycasts in different directions to increase hit probability
        const directions = [
          new THREE.Vector3(1, 0, 0),
          new THREE.Vector3(-1, 0, 0),
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(0, -1, 0),
          new THREE.Vector3(0, 0, 1),
          new THREE.Vector3(0, 0, -1)
        ];
        
        // Get main camera for proper raycasting
        let mainCamera = null;
        if (camera) {
          mainCamera = camera;
        } else if (context.mainCamera) {
          mainCamera = context.mainCamera;
        }
        
        directions.forEach(direction => {
          raycaster.set(center, direction.normalize());
          // Set the camera for proper sprite raycasting
          raycaster.camera = mainCamera;
          
          // Check for intersections with enemy models
          const intersects = raycaster.intersectObjects(scene.children, true);
          
          // Check each hit for enemy data
          intersects.forEach(hit => {
            if (hit.distance <= effectRadius * 1.5) {
              let obj = hit.object;
              
              // Traverse up the parent hierarchy to find the enemy ID
              while (obj && !obj.userData?.enemyId) {
                obj = obj.parent;
              }
              
              // If we found an enemy, apply damage
              if (obj && obj.userData && obj.userData.enemyId) {
                eventBus.emit('entity:damage', {
                  id: obj.userData.enemyId,
                  amount: explosionDamage,
                  damageType: 'explosion',
                  sourceId: blackHoleId
                });
              }
            }
          });
        });
      }
    }
    
    // Listen for objects affected by the black hole
    if (eventBus) {
      eventBus.on(`physics:affected-by-${blackHoleId}`, (objectId) => {
        affectedObjects.add(objectId);
      });
    }
    
    // Start animation
    animate();
    
    // Create cleanup function
    const cleanup = () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      
      clearInterval(pullInterval);
      
      if (eventBus) {
        // Stop listening for affected objects
        eventBus.off(`physics:affected-by-${blackHoleId}`);
      }
      
      if (scene) {
        scene.remove(blackHoleContainer);
      }
      
      // Dispose of all geometries and materials
      coreGeometry.dispose();
      coreMaterial.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      diskGeometry.dispose();
      diskMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
    };
    
    return {
      element: blackHoleContainer,
      cleanup,
      blackHoleId
    };
  }
};
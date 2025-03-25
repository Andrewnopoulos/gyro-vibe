import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Enemy } from './enemy.js';

export class MechanicalSpider extends Enemy {
  /**
   * Create a new mechanical spider enemy
   * @param {Object} options - Enemy creation options
   */
  constructor(options) {
    super({
      ...options,
      type: 'mechanical-spider',
      health: options.health || 100
    });
    
    // Spider-specific properties
    this.legCount = 8;
    this.bodyRadius = 1.2;
    this.legLength = 2.5;
    this.stepHeight = 0.4;
    this.moveSpeed = 2.0;
    
    // Movement properties
    this.targetPosition = null;
    this.isMoving = false;
    this.lastLegMoved = -1;
    this.movementDirection = new THREE.Vector3();
    this.state = 'IDLE'; // IDLE, PATROL, CHASE, ATTACK
    
    // Animation timing properties
    this.legStepTimes = new Array(this.legCount).fill(0);
    this.legStepDuration = 0.6; // seconds per step
    this.lastStepTime = Date.now();
    
    // Leg configuration
    this.legs = [];
    
    // Initialize material definitions (with error handling)
    try {
      this.materials = {
        body: new THREE.MeshStandardMaterial({
          color: 0x333333,
          roughness: 0.7,
          metalness: 0.8
        }),
        joints: new THREE.MeshStandardMaterial({
          color: 0x555555,
          roughness: 0.5,
          metalness: 0.9
        }),
        eyes: new THREE.MeshStandardMaterial({
          color: 0xff3333,
          roughness: 0.2,
          metalness: 0.8,
          emissive: 0xff0000,
          emissiveIntensity: 0.5
        })
      };
    } catch (error) {
      console.error("Error creating materials:", error);
      // Fallback to basic materials if fancy ones fail
      this.materials = {
        body: new THREE.MeshBasicMaterial({ color: 0x333333 }),
        joints: new THREE.MeshBasicMaterial({ color: 0x555555 }),
        eyes: new THREE.MeshBasicMaterial({ color: 0xff0000 })
      };
    }
  }
  
  /**
   * Create the 3D model for the spider
   * @override
   */
  createModel() {
    try {
      // Create a group to hold all parts of the spider
      this.model = new THREE.Group();
      this.model.position.set(
        this.position.x,
        this.position.y,
        this.position.z
      );
      this.model.userData.enemyId = this.id;
      
      // Create the spider components
      this.createBody();
      this.createLegs();
      
      // Add to scene
      if (this.scene) {
        this.scene.add(this.model);
      } else {
        console.error("Scene is not available for adding the spider model");
      }
    } catch (error) {
      console.error("Error creating mechanical spider model:", error);
      
      // Create a simple fallback model if the complex one fails
      this.createFallbackModel();
    }
  }
  
  /**
   * Create a simple fallback model if the complex one fails
   */
  createFallbackModel() {
    // Create a simple box as fallback
    const geometry = new THREE.BoxGeometry(2, 1, 2);
    const material = new THREE.MeshStandardMaterial({
      color: 0x333333,
      roughness: 0.7,
      metalness: 0.3
    });
    
    this.model = new THREE.Mesh(geometry, material);
    this.model.position.set(
      this.position.x,
      this.position.y,
      this.position.z
    );
    this.model.castShadow = true;
    this.model.receiveShadow = true;
    this.model.userData.enemyId = this.id;
    
    if (this.scene) {
      this.scene.add(this.model);
    }
  }
  
  /**
   * Create the body of the spider
   */
  createBody() {
    // Check if materials exist, create them if not
    if (!this.materials || !this.materials.body) {
      console.warn("Materials not properly initialized, creating defaults");
      this.materials = {
        body: new THREE.MeshBasicMaterial({ color: 0x333333 }),
        joints: new THREE.MeshBasicMaterial({ color: 0x555555 }),
        eyes: new THREE.MeshBasicMaterial({ color: 0xff0000 })
      };
    }
    
    try {
      // Create the main body sphere
      const bodyGeometry = new THREE.SphereGeometry(this.bodyRadius, 16, 16);
      this.bodyMesh = new THREE.Mesh(bodyGeometry, this.materials.body);
      this.bodyMesh.castShadow = true;
      this.bodyMesh.receiveShadow = true;
      
      // Add the body to the model
      this.model.add(this.bodyMesh);
      
      // Create a slightly smaller head section at the front
      const headGeometry = new THREE.SphereGeometry(this.bodyRadius * 0.7, 16, 16);
      this.headMesh = new THREE.Mesh(headGeometry, this.materials.body);
      this.headMesh.position.z = this.bodyRadius * 0.8;
      this.headMesh.position.y = this.bodyRadius * 0.2;
      this.headMesh.castShadow = true;
      
      // Add the head to the body
      this.bodyMesh.add(this.headMesh);
      
      // Add eyes
      this.createEyes();
      
      // Add mechanical details to the body
      this.createBodyDetails();
    } catch (error) {
      console.error("Error in createBody:", error);
      
      // Create a simple fallback body if complex one fails
      const bodyGeometry = new THREE.SphereGeometry(this.bodyRadius, 8, 8);
      const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
      
      this.bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
      this.bodyMesh.castShadow = true;
      this.bodyMesh.receiveShadow = true;
      
      // Add to model
      this.model.add(this.bodyMesh);
    }
  }
  
  /**
   * Create eyes for the spider
   */
  createEyes() {
    try {
      // Safety check
      if (!this.headMesh) return;
      
      // Create a group for the eyes
      const eyesGroup = new THREE.Group();
      
      // Parameters for eye placement
      const eyeRadius = 0.12;
      const eyeCount = 6;
      const eyeArc = Math.PI * 0.7; // Arc angle for eye placement
      const eyeElevation = 0.1; // Vertical position
      
      // Make sure we have a valid material for eyes
      const eyeMaterial = this.materials?.eyes || new THREE.MeshBasicMaterial({ 
        color: 0xff0000, 
        emissive: 0xff0000,
        emissiveIntensity: 0.5
      });
      
      // Create multiple eyes arranged in an arc
      for (let i = 0; i < eyeCount; i++) {
        const angle = -eyeArc / 2 + (eyeArc / (eyeCount - 1)) * i;
        
        const eyeGeometry = new THREE.SphereGeometry(eyeRadius, 8, 8);
        const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        
        // Position the eye on the front of the head in an arc
        eye.position.set(
          Math.sin(angle) * (this.bodyRadius * 0.5),
          eyeElevation + Math.sin(angle * 0.5) * 0.1,
          Math.cos(angle) * (this.bodyRadius * 0.5)
        );
        
        eye.castShadow = true;
        eyesGroup.add(eye);
      }
      
      // Add the eyes to the head
      this.headMesh.add(eyesGroup);
    } catch (error) {
      console.error("Error creating spider eyes:", error);
      // We'll continue without eyes if there's an error
    }
  }
  
  /**
   * Create mechanical details on the body
   */
  createBodyDetails() {
    try {
      // Safety check
      if (!this.bodyMesh) return;
      
      // Make sure we have a valid material for joints
      const jointsMaterial = this.materials?.joints || new THREE.MeshBasicMaterial({ color: 0x555555 });
      
      // Add mechanical details to make the spider look more robotic
      
      // Central "spine" along the top
      const spineGeometry = new THREE.BoxGeometry(0.2, 0.1, this.bodyRadius * 1.5);
      const spine = new THREE.Mesh(spineGeometry, jointsMaterial);
      spine.position.y = this.bodyRadius * 0.4;
      spine.castShadow = true;
      this.bodyMesh.add(spine);
      
      // Add some cylindrical "vents" or mechanical details
      const ventGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.2, 8);
      
      // Place vents around the body
      for (let i = 0; i < 4; i++) {
        const angle = (Math.PI / 2) * i;
        const vent = new THREE.Mesh(ventGeometry, jointsMaterial);
        
        // Position around the body
        vent.position.set(
          Math.sin(angle) * (this.bodyRadius * 0.7),
          Math.cos(angle) * (this.bodyRadius * 0.5),
          0
        );
        
        // Rotate to point outward
        vent.rotation.z = Math.PI / 2;
        vent.rotation.y = angle;
        
        vent.castShadow = true;
        this.bodyMesh.add(vent);
      }
    } catch (error) {
      console.error("Error creating spider mechanical details:", error);
      // We'll continue without the details if there's an error
    }
  }
  
  /**
   * Create all legs for the spider
   */
  createLegs() {
    try {
      // Safety check
      if (!this.bodyMesh) return;
      
      this.legs = []; // Reset legs array
      
      // Create legs arranged radially around the body
      for (let i = 0; i < this.legCount; i++) {
        // Calculate the base position around the body
        const angle = (Math.PI * 2 / this.legCount) * i;
        const side = i < this.legCount / 2 ? 'right' : 'left';
        
        // Calculate leg base position (where it connects to body)
        const basePosition = new THREE.Vector3(
          Math.sin(angle) * this.bodyRadius,
          0,
          Math.cos(angle) * this.bodyRadius
        );
        
        // Calculate rest position (default position when standing)
        // Spread the legs out more on the sides than front/back
        const restDistance = this.legLength * 0.7;
        const spreadFactor = Math.abs(Math.sin(angle)) * 0.3 + 0.7; // More spread on sides
        
        const restPosition = new THREE.Vector3(
          Math.sin(angle) * restDistance * spreadFactor,
          -this.bodyRadius, // Below the body
          Math.cos(angle) * restDistance
        );
        
        // Create leg object
        const leg = {
          index: i,
          segments: [],
          joints: [],
          basePosition: basePosition.clone(),
          restPosition: restPosition.clone(),
          targetPosition: restPosition.clone(),
          currentPosition: restPosition.clone(),
          phase: 0,
          moving: false,
          lastMoveTime: 0,
          rayResult: null,
          side: side,
          angle: angle
        };
        
        try {
          // Create the visual elements for this leg
          this.createLegSegments(leg);
          
          // Store in legs array
          this.legs.push(leg);
        } catch (legError) {
          console.error(`Error creating leg ${i}:`, legError);
          // Continue with other legs
        }
      }
    } catch (error) {
      console.error("Error creating spider legs:", error);
      // We'll continue without legs if there's a major error
      this.legs = [];
    }
  }
  
  /**
   * Create the visual elements for a single leg
   * @param {Object} leg - Leg object to create segments for
   */
  createLegSegments(leg) {
    try {
      // Safety check
      if (!this.bodyMesh) {
        console.warn("Cannot create leg segments: bodyMesh is undefined");
        return;
      }
      
      // Make sure we have valid materials
      const bodyMaterial = this.materials?.body || new THREE.MeshBasicMaterial({ color: 0x333333 });
      const jointsMaterial = this.materials?.joints || new THREE.MeshBasicMaterial({ color: 0x555555 });
      
      // Create a group for this leg
      const legGroup = new THREE.Group();
      legGroup.position.copy(leg.basePosition);
      this.bodyMesh.add(legGroup);
      
      // Store reference to the leg group
      leg.group = legGroup;
      
      // Create three segments for each leg (coxa, femur, tibia)
      const segmentLengths = [0.6, 1.2, 1.4]; // Lengths of each segment
      const segmentRadius = 0.15; // Thickness of leg segments
      
      // Create a joint at the base
      const baseJointGeometry = new THREE.SphereGeometry(segmentRadius * 1.2, 8, 8);
      const baseJoint = new THREE.Mesh(baseJointGeometry, jointsMaterial);
      baseJoint.castShadow = true;
      legGroup.add(baseJoint);
      leg.joints.push(baseJoint);
      
      // Create segments with joints
      let currentJoint = baseJoint;
      let cumulativeLength = 0;
      
      for (let i = 0; i < segmentLengths.length; i++) {
        const length = segmentLengths[i];
        const segmentGeometry = new THREE.CylinderGeometry(
          segmentRadius, 
          segmentRadius * 0.8, // Taper slightly for visual interest
          length, 
          8
        );
        
        // Create and position segment
        const segment = new THREE.Mesh(segmentGeometry, bodyMaterial);
        segment.castShadow = true;
        
        // Position the first point of the cylinder at the joint
        segment.position.y = -length / 2;
        
        // Rotate cylinder to point downward
        segment.rotation.x = Math.PI / 2;
        
        // Add to current joint
        currentJoint.add(segment);
        leg.segments.push(segment);
        
        // Create next joint (except for last segment)
        if (i < segmentLengths.length - 1) {
          const jointGeometry = new THREE.SphereGeometry(segmentRadius * 1.1, 8, 8);
          const joint = new THREE.Mesh(jointGeometry, jointsMaterial);
          joint.castShadow = true;
          
          // Position the joint at the end of the segment
          joint.position.y = -length;
          
          // Add joint to segment
          segment.add(joint);
          leg.joints.push(joint);
          
          // Update current joint for next segment
          currentJoint = joint;
        } else {
          // For the last segment, add a "foot" or tip
          const footGeometry = new THREE.SphereGeometry(segmentRadius * 0.8, 8, 8);
          const foot = new THREE.Mesh(footGeometry, jointsMaterial);
          foot.castShadow = true;
          foot.position.y = -length;
          segment.add(foot);
          leg.foot = foot;
        }
        
        cumulativeLength += length;
      }
      
      // Initialize leg pose using inverse kinematics to rest position
      try {
        this.positionLegIK(leg, leg.restPosition);
      } catch (ikError) {
        console.error("Error in initial IK positioning:", ikError);
        // Continue without IK if it fails
      }
    } catch (error) {
      console.error("Error creating leg segments:", error);
      throw error; // Re-throw to be handled by caller
    }
  }
  
  /**
   * Create physics body for the spider
   * @override
   */
  createPhysics() {
    try {
      // Safety check
      if (!this.world) {
        console.warn("Physics world not available");
        return;
      }
      
      // Create a sphere shape for the main body
      const shape = new CANNON.Sphere(this.bodyRadius);
      
      // Create body with mass > 0 so it's affected by gravity
      this.physicsBody = new CANNON.Body({
        mass: 10,
        position: new CANNON.Vec3(
          this.position.x,
          this.position.y,
          this.position.z
        ),
        shape: shape,
        material: new CANNON.Material({
          friction: 0.3,
          restitution: 0.2
        })
      });
      
      // Add to physics world
      this.world.addBody(this.physicsBody);
      
      // Store reference to enemy in the body for collision detection
      this.physicsBody.userData = { enemyId: this.id };
    } catch (error) {
      console.error("Error creating physics body for spider:", error);
      // Continue without physics if there's an error
    }
  }
  
  /**
   * Update the spider's behavior
   * @param {number} delta - Time in seconds since last update
   * @override
   */
  updateBehavior(delta) {
    // Update based on current state
    switch (this.state) {
      case 'IDLE':
        this.updateIdleBehavior(delta);
        break;
      case 'PATROL':
        this.updatePatrolBehavior(delta);
        break;
      case 'CHASE':
        this.updateChaseBehavior(delta);
        break;
      case 'ATTACK':
        this.updateAttackBehavior(delta);
        break;
    }
    
    // Update leg positions and animation
    this.updateLegPositions(delta);
    
    // Update body position based on legs
    this.updateBodyPosition(delta);
    
    // Update model position to match physics body
    if (this.physicsBody && this.model) {
      this.physicsBody.position.copy(this.model.position);
      this.model.quaternion.copy(this.physicsBody.quaternion);
    }
  }
  
  /**
   * Idle behavior - occasionally shift weight
   * @param {number} delta - Time delta
   */
  updateIdleBehavior(delta) {
    // Occasionally shift to a new position or change state
    if (Math.random() < 0.005) {
      // 10% chance to start patrolling
      if (Math.random() < 0.1) {
        this.state = 'PATROL';
        
        // Choose a random patrol point
        const angle = Math.random() * Math.PI * 2;
        const distance = 10 + Math.random() * 10;
        this.targetPosition = new THREE.Vector3(
          this.model.position.x + Math.cos(angle) * distance,
          this.model.position.y,
          this.model.position.z + Math.sin(angle) * distance
        );
      } else {
        // Otherwise just shift weight slightly
        this.shiftWeight();
      }
    }
  }
  
  /**
   * Patrol behavior - walk toward target point
   * @param {number} delta - Time delta
   */
  updatePatrolBehavior(delta) {
    if (!this.targetPosition) {
      this.state = 'IDLE';
      return;
    }
    
    // Calculate direction to target
    const direction = new THREE.Vector3().subVectors(
      this.targetPosition,
      this.model.position
    );
    
    // Check if we've reached the target (with some tolerance)
    if (direction.length() < 1.0) {
      this.state = 'IDLE';
      this.targetPosition = null;
      return;
    }
    
    // Normalize and scale by speed
    direction.normalize().multiplyScalar(this.moveSpeed * delta);
    this.movementDirection.copy(direction);
    
    // Calculate rotation to face movement direction
    if (direction.length() > 0.01) {
      const targetRotation = Math.atan2(direction.x, direction.z);
      
      // Smoothly rotate toward the target rotation
      const currentRotation = this.model.rotation.y;
      const rotationDelta = (targetRotation - currentRotation) * 2 * delta;
      this.model.rotation.y += rotationDelta;
    }
    
    // Set moving flag for animation
    this.isMoving = true;
  }
  
  /**
   * Chase behavior - pursue player
   * @param {number} delta - Time delta
   */
  updateChaseBehavior(delta) {
    // This will be implemented once player detection is added
    // For now, it defaults back to idle
    this.state = 'IDLE';
  }
  
  /**
   * Attack behavior - perform attack on player
   * @param {number} delta - Time delta
   */
  updateAttackBehavior(delta) {
    // This will be implemented once player detection is added
    // For now, it defaults back to idle
    this.state = 'IDLE';
  }
  
  /**
   * Update leg positions based on movement
   * @param {number} delta - Time delta
   */
  updateLegPositions(delta) {
    // Current time for leg movement timing
    const currentTime = Date.now();
    
    // Update each leg
    for (let i = 0; i < this.legs.length; i++) {
      const leg = this.legs[i];
      
      // If we're moving, determine if this leg should step
      if (this.isMoving) {
        // Get target position for this leg
        const targetPosition = this.calculateLegTargetPosition(i);
        
        // Determine if this leg should move
        // We use a simple alternating gait pattern: odd legs move, then even legs
        const shouldMove = this.shouldLegMove(leg, targetPosition);
        
        if (shouldMove && !leg.moving) {
          // Start a new step
          leg.moving = true;
          leg.lastMoveTime = currentTime;
          leg.phase = 0;
          leg.previousPosition = leg.currentPosition.clone();
          leg.targetPosition = targetPosition;
        }
      }
      
      // Animate leg steps in progress
      if (leg.moving) {
        // Calculate step progress based on time
        const timeSinceLastStep = (currentTime - leg.lastMoveTime) / 1000;
        leg.phase = Math.min(timeSinceLastStep / this.legStepDuration, 1.0);
        
        // Animate the step
        this.animateLegStep(leg);
        
        // Check if step is complete
        if (leg.phase >= 1.0) {
          leg.moving = false;
          leg.currentPosition.copy(leg.targetPosition);
        }
      }
      
      // Update leg IK to current position
      this.positionLegIK(leg, leg.currentPosition);
    }
  }
  
  /**
   * Determine if a leg should start moving to a new position
   * @param {Object} leg - Leg object
   * @param {THREE.Vector3} targetPosition - Target position
   * @return {boolean} Whether the leg should move
   */
  shouldLegMove(leg, targetPosition) {
    // If the leg is already moving, it shouldn't start a new movement
    if (leg.moving) return false;
    
    // Check distance to target - if too far, need to move
    const distanceToTarget = leg.currentPosition.distanceTo(targetPosition);
    if (distanceToTarget > this.legLength * 0.4) {
      
      // Check timing - we don't want all legs moving at once
      // Simple alternating gait: group legs into two groups
      const legGroup = leg.index % 2;
      const movePhase = this.getLegMovePhase();
      
      // If this leg's group matches the current move phase
      if (legGroup === movePhase) {
        // Also make sure enough time has passed since last step
        const timeSinceLastMove = (Date.now() - leg.lastMoveTime) / 1000;
        return timeSinceLastMove > this.legStepDuration * 1.2;
      }
    }
    
    return false;
  }
  
  /**
   * Get the current leg movement phase (which group of legs should move)
   * @return {number} 0 or 1 indicating which leg group should move
   */
  getLegMovePhase() {
    // Simple alternating pattern based on time
    return Math.floor((Date.now() / (this.legStepDuration * 1000)) % 2);
  }
  
  /**
   * Animate a single leg step
   * @param {Object} leg - Leg to animate
   */
  animateLegStep(leg) {
    if (!leg.moving || !leg.previousPosition || !leg.targetPosition) return;
    
    // Interpolate position
    leg.currentPosition.lerpVectors(
      leg.previousPosition,
      leg.targetPosition,
      leg.phase
    );
    
    // Add step height using sine curve
    // Maximum height at middle of step (phase = 0.5)
    const stepHeight = Math.sin(leg.phase * Math.PI) * this.stepHeight;
    leg.currentPosition.y = leg.previousPosition.y + stepHeight;
    
    // At end of step, make sure we're exactly at target
    if (leg.phase >= 0.99) {
      leg.currentPosition.copy(leg.targetPosition);
    }
  }
  
  /**
   * Calculate target position for a leg
   * @param {number} legIndex - Index of the leg
   * @return {THREE.Vector3} Target position
   */
  calculateLegTargetPosition(legIndex) {
    const leg = this.legs[legIndex];
    
    // Start with the rest position
    const target = leg.restPosition.clone();
    
    // If we're moving, adjust target position based on movement direction
    if (this.isMoving && this.movementDirection.length() > 0) {
      // Project movement onto leg plane
      const legDirection = new THREE.Vector3(
        Math.sin(leg.angle),
        0,
        Math.cos(leg.angle)
      );
      
      // Scale by movement amount and leg position
      const movementOffset = this.movementDirection.clone()
        .multiplyScalar(1.5) // Exaggerate the movement a bit
        .multiplyScalar(leg.side === 'left' ? -1 : 1); // Reverse for left side
      
      target.add(movementOffset);
      
      // Keep the target at ground level
      target.y = -this.bodyRadius;
    }
    
    return target;
  }
  
  /**
   * Position leg segments using inverse kinematics
   * @param {Object} leg - Leg to position
   * @param {THREE.Vector3} targetPosition - Target foot position in world space
   */
  positionLegIK(leg, targetPosition) {
    try {
      // Safety checks
      if (!leg || !leg.group || !leg.segments || leg.segments.length < 3) {
        return;
      }
      
      if (!targetPosition || !this.model) {
        return;
      }
      
      // Convert target to local space of the leg group
      const localTarget = targetPosition.clone();
      this.model.worldToLocal(localTarget);
      
      if (!leg.group.parent) {
        return;
      }
      
      leg.group.parent.worldToLocal(localTarget);
      localTarget.sub(leg.basePosition);
      
      // Get lengths of the three segments
      const lengths = [
        leg.segments[0].geometry?.parameters?.height || 0.6,
        leg.segments[1].geometry?.parameters?.height || 1.2,
        leg.segments[2].geometry?.parameters?.height || 1.4
      ];
      
      // Simplified two-joint IK solution
      // First, orient the root joint toward the target
      const targetDirection = localTarget.clone().normalize();
      leg.group.lookAt(leg.group.position.clone().add(targetDirection));
      
      // Calculate distance to target
      const targetDistance = localTarget.length();
      
      // Calculate joint angles using law of cosines
      const a = lengths[0];
      const b = lengths[1] + lengths[2]; // Simplify as two segments
      const c = targetDistance || 0.1; // Prevent division by zero
      
      // Clamp to prevent NaN from acos
      const cosAngle = Math.min(1, Math.max(-1, (a*a + c*c - b*b) / (2*a*c)));
      const angle1 = Math.acos(cosAngle);
      
      // Apply calculated angle to first segment
      if (leg.segments[0]) {
        leg.segments[0].rotation.x = Math.PI/2 - angle1;
      }
      
      // Calculate angle for knee joint
      const cosAngle2 = Math.min(1, Math.max(-1, (a*a + b*b - c*c) / (2*a*b)));
      const angle2 = Math.acos(cosAngle2);
      
      // Apply second angle to knee joint
      if (leg.segments[1]) {
        leg.segments[1].rotation.x = Math.PI - angle2;
      }
      
      // Third segment remains straight
      if (leg.segments[2]) {
        leg.segments[2].rotation.x = 0;
      }
    } catch (error) {
      console.error("Error in positionLegIK:", error);
      // Continue without positioning if there's an error
    }
  }
  
  /**
   * Update body position based on leg placement
   * @param {number} delta - Time delta
   */
  updateBodyPosition(delta) {
    if (!this.isMoving) return;
    
    // Calculate average position of all planted legs
    const plantedLegs = this.legs.filter(leg => !leg.moving);
    
    if (plantedLegs.length < 2) return;
    
    // Calculate center point of planted legs
    const centerPoint = new THREE.Vector3();
    plantedLegs.forEach(leg => {
      centerPoint.add(leg.currentPosition);
    });
    centerPoint.divideScalar(plantedLegs.length);
    
    // Calculate an offset to keep body at appropriate height
    centerPoint.y += this.bodyRadius * 1.5;
    
    // Apply a small amount of movement in the movement direction
    if (this.movementDirection.length() > 0) {
      const movementAmount = this.moveSpeed * delta;
      const movement = this.movementDirection.clone().normalize().multiplyScalar(movementAmount);
      this.model.position.add(movement);
    }
    
    // Smoothly adjust body to maintain position above legs
    const bodyPositionLerp = 0.1;
    const newPosition = new THREE.Vector3().lerpVectors(
      this.model.position,
      centerPoint,
      bodyPositionLerp
    );
    
    // Update model position
    this.model.position.copy(newPosition);
  }
  
  /**
   * Shift weight randomly for idle animation
   */
  shiftWeight() {
    // Create a small random offset
    const offset = new THREE.Vector3(
      (Math.random() - 0.5) * 0.4,
      0,
      (Math.random() - 0.5) * 0.4
    );
    
    // Apply to body position
    this.model.position.add(offset);
  }
  
  /**
   * Override death animation with custom spider death
   * @param {number} delta - Time delta
   */
  updateDeathAnimation(delta) {
    if (!this.model) return;
    
    try {
      const elapsedTime = (Date.now() - this.deathAnimationStartTime) / 1000;
      const animationDuration = 2.0; // seconds
      const progress = Math.min(elapsedTime / animationDuration, 1.0);
      
      // Only animate legs if they exist and we have a complex model
      if (this.legs && this.legs.length > 0) {
        // Collapse legs
        this.legs.forEach((leg, index) => {
          // Stagger the leg collapse
          const legProgress = Math.min(1.0, progress * 2 - (index % 4) * 0.2);
          
          if (legProgress > 0 && leg.group) {
            // Rotate legs outward as they collapse
            const angle = leg.angle + (Math.sin(index) * progress * 0.5);
            leg.group.rotation.z = legProgress * (0.5 + index % 3 * 0.2);
            leg.group.rotation.x = legProgress * (index % 2 ? 0.3 : -0.3);
          }
        });
      }
      
      // Body slowly sinks to the ground
      this.model.position.y = this.position.y - progress * (this.bodyRadius || 1.0);
      
      // Body rotation - tilt to the side slightly
      this.model.rotation.z = progress * 0.3;
      this.model.rotation.x = progress * 0.2;
      
      // Fade out near the end of the animation
      if (progress > 0.7) {
        // Make all materials transparent
        this.model.traverse((child) => {
          if (child instanceof THREE.Mesh && child.material) {
            child.material.transparent = true;
            child.material.opacity = 1.0 - ((progress - 0.7) / 0.3);
          }
        });
      }
    } catch (error) {
      console.error("Error in mechanical spider death animation:", error);
      
      // Fallback to simpler animation if complex one fails
      try {
        // Simple fallback death animation
        const elapsedTime = (Date.now() - this.deathAnimationStartTime) / 1000;
        const animationDuration = 2.0;
        const progress = Math.min(elapsedTime / animationDuration, 1.0);
        
        // Simple rotation and sinking
        this.model.rotation.x = progress * Math.PI / 2;
        this.model.position.y = this.position.y - progress * 0.5;
        
        // Fade out
        if (progress > 0.7 && this.model.material) {
          this.model.material.transparent = true;
          this.model.material.opacity = 1.0 - ((progress - 0.7) / 0.3);
        }
      } catch (fallbackError) {
        console.error("Even fallback animation failed:", fallbackError);
      }
    }
  }
}
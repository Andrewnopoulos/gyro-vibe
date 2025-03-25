# Mechanical Spider Enemy Implementation Plan

This plan outlines a step-by-step approach to implementing a mechanical spider enemy with procedural animation in the existing game codebase.

## 1. Create the MechanicalSpider Class

First, create a new file `mechanical-spider.js` in the `client/js/game/enemy-system/` directory:

1. Create a class that extends the base `Enemy` class
2. Implement a constructor that initializes spider-specific properties:
   - Number of legs (8)
   - Body size and shape
   - Leg dimensions
   - Animation parameters
   - Movement properties
3. Override the `createModel`, `createPhysics`, and `updateBehavior` methods
4. Add helper methods for procedural animation and leg placement

## 2. Create 3D Model Components

For the spider model:

1. Create a central body component using primitive shapes:
   - Main body (sphere or capsule)
   - Head section with "eyes" (small spheres)
   - Mechanical details (cylinders, boxes for joints)
2. Create leg components:
   - Each leg will have 3 segments (coxa, femur, tibia)
   - Joints connecting the segments
   - Use cylinder primitives for leg segments
   - Create distinct visual appearance for mechanical parts

## 3. Implement Leg Structure

For each leg:

1. Create a container object to track each leg's state:
   ```javascript
   {
     index: 0,                     // Leg index
     segments: [],                 // THREE.js mesh objects for segments
     joints: [],                   // THREE.js mesh objects for joints
     basePosition: new THREE.Vector3(),  // Where leg connects to body
     restPosition: new THREE.Vector3(),  // Default/neutral position
     targetPosition: new THREE.Vector3(), // Where the leg is trying to reach
     currentPosition: new THREE.Vector3(), // Current foot position
     phase: 0,                     // 0-1 step progress
     moving: false,                // Whether leg is currently moving
     lastMoveTime: 0,              // When leg last started moving
     rayResult: null               // Physics raycast result for foot placement
   }
   ```

2. Position the legs radially around the body
3. Set initial rest positions for each leg

## 4. Implement Physics Integration

1. Create a main physics body for the spider's body:
   - Use a sphere or compound shape for the central body
   - Add collision detection
   - Configure proper mass and material properties

2. Implement leg-ground interaction:
   - Use raycasts from the body to determine ground placement
   - Calculate foot positions based on terrain height
   - Update the body position based on leg placement

3. Create sensors for the spider to detect the player and obstacles

## 5. Implement Procedural Animation System

The core animation system consists of:

1. Gait controller to coordinate leg movements:
   - Implement alternating tetrapod gait (move groups of 4 legs at a time)
   - Define sequence of leg movements for walking

2. Leg step cycle function:
   - Calculate step height using sin curve 
   - Interpolate between previous and target positions
   - Manage timing of each leg's movement

3. Inverse Kinematics (IK) solver for legs:
   - Given a target foot position, calculate joint angles
   - Implement FABRIK or two-joint analytical IK solution
   - Update each leg segment position and rotation

4. Leg placement algorithm:
   - Determine when a leg should move
   - Calculate new target positions based on movement direction
   - Ensure legs don't cross each other

## 6. Implement Movement Behavior

1. Create a state machine for the spider's behavior:
   - IDLE: Standing still, occasionally shifting weight
   - PATROL: Walking along predefined waypoints
   - CHASE: Pursuing the player
   - ATTACK: Performing attack animation when close to player

2. Implement path finding and terrain navigation:
   - Calculate movement vector toward target
   - Adjust body orientation to match movement direction
   - Handle slopes and obstacles

3. Attack mechanics:
   - Define attack range and damage values
   - Create attack animation (rearing up front legs)
   - Emit damage events when attacks connect

## 7. Integrate with Enemy Manager

1. Update the `EnemyManager` class to handle spawning MechanicalSpiders:
   ```javascript
   spawnMechanicalSpider(position) {
     const spider = new MechanicalSpider({
       scene: this.scene,
       world: this.world,
       eventBus: this.eventBus,
       position,
       health: 20
     });
     
     this.enemies.set(spider.id, spider);
     return spider;
   }
   ```

2. Update the enemy spawning code to include mechanical spiders
3. Add handling for networked spider sync if needed
4. Register the spider type in the network system

## 8. Detailed Implementation of Procedural Leg Animation

The core animation will be implemented with these functions:

1. `updateLegPositions(delta)`:
   - Determine which legs should move based on gait pattern
   - For each leg, determine if it should stay planted or move to new position
   - Calculate step heights and interpolations for moving legs

2. `calculateLegIK(leg, targetPosition)`:
   - Given a target foot position, calculate angles for each joint
   - Apply rotations to leg segments
   - Handle constraints in joint rotations

3. `findFootTargetPosition(leg)`:
   - Cast a ray downward from the leg's default position
   - Find intersection with ground
   - Adjust target based on body movement direction

4. `updateBodyPosition(delta)`:
   - Calculate the average of all planted leg positions
   - Smoothly interpolate body position based on leg support
   - Adjust body orientation based on terrain and movement

## 9. Add Visual Effects and Polish

1. Add mechanical details and animations:
   - Eyes that glow/react to player
   - Steam/particle effects at joints
   - Mechanical sounds for movement

2. Death animation:
   - Legs collapse under the body
   - Sparks/explosion effects
   - Body parts detach

3. Attack animations:
   - Raised front legs
   - Glowing attack indicators
   - Impact effects

## 10. Performance Optimization

1. Optimize raycasting using a reduced frequency
2. Simplify IK calculations at greater distances from player
3. Level of detail (LOD) for spider model at distance
4. Optimize physics by using simpler collision shapes when possible

## Code Structure Blueprint

With this plan, the implementation would follow this file structure:

- `mechanical-spider.js`: Main enemy class
- `spider-leg.js`: Class to manage leg state and animation
- `spider-ik-solver.js`: IK calculations for leg positioning
- `spider-gait-controller.js`: Coordination of leg movements

This modular approach keeps the code organized and allows for easier updates and refinements of the spider behavior.
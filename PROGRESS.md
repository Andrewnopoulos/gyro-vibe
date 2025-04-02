✅ IMPLEMENTED: Three-Phase Enemy Behavior

Overview of the Behaviors (Updated)
The particle enemies now exhibit three distinct phases:

1. **Idle Phase**: 
   - Default state when player is far away (>15 units)
   - Enemies bob up and down gently in place
   - Appear blue and slightly smaller
   - No movement except for vertical bobbing

2. **Orbiting Phase**: 
   - Activated when player comes within 15 units
   - Enemies maintain a distance of ~7 units from the player
   - Each enemy orbits in either clockwise or counter-clockwise direction (randomly assigned)
   - They flock with other orbiting enemies (separation, alignment, cohesion)
   - Appear in normal green/yellow health-based color

3. **Attack Phase**: 
   - Occurs very rarely (every 15-30 seconds per enemy)
   - Enemies charge directly at the player at 15x normal speed
   - Attack lasts for 0.8 seconds before returning to orbit phase
   - Appear red and 30% larger during attack
   - Each enemy independently decides when to attack

Phase transitions occur based on:
- Player proximity (idle ↔ orbit)
- Individual timers (orbit → attack → orbit)

This system creates a dynamic, unpredictable swarm behavior where enemies normally stay at a safe distance but occasionally attack.

Step-by-Step Implementation
1. Add Phase Data to Enemy Objects
Each enemy needs to track its current phase and related data. Modify the enemyData array in the ParticleEnemyGroup class to include phase-specific properties.

In ParticleEnemyGroup’s constructor or initialization:

javascript

Collapse

Wrap

Copy
this.enemyData = Array.from({ length: this.maxEnemies }, (_, i) => ({
  id: `particle_enemy_${i}_${Math.random().toString(36).substr(2, 9)}`,
  position: new THREE.Vector3(),
  velocity: new THREE.Vector3(),
  health: 0,
  maxHealth: 5,
  state: 'dead', // 'alive', 'dying', 'dead'
  deathStartTime: 0,
  // New phase-related fields
  phase: 'orbit', // Current phase: 'orbit' or 'attack'
  phaseTimer: Math.random() * 3 + 2, // Time until next phase change (e.g., 2–5 seconds initially)
  attackDirection: new THREE.Vector3(), // Direction to move during attack phase
}));
phase: Indicates whether the enemy is orbiting ('orbit') or attacking ('attack').
phaseTimer: Tracks time remaining until the next phase switch, initialized randomly to stagger behaviors.
attackDirection: Stores the direction toward the player when the attack begins.
2. Update the spawn Method
When spawning enemies, ensure phase data is properly initialized for both new and reused enemy slots. Update the spawn method in ParticleEnemyGroup:

javascript

Collapse

Wrap

Copy
spawn(count, positions) {
  const spawnCount = Math.min(count, this.maxEnemies - this.activeCount);

  for (let i = 0; i < spawnCount; i++) {
    const index = this.findFreeSlot();
    if (index === -1) break;

    const enemy = this.enemyData[index];
    enemy.position.set(positions[i].x, positions[i].y, positions[i].z);
    enemy.velocity.set(
      (Math.random() - 0.5) * 0.02,
      (Math.random() - 0.5) * 0.01,
      (Math.random() - 0.5) * 0.02
    );
    enemy.health = enemy.maxHealth;
    enemy.state = 'alive';
    // Initialize phase data
    enemy.phase = 'orbit';
    enemy.phaseTimer = this.movement.minOrbitTime + Math.random() * (this.movement.maxOrbitTime - this.movement.minOrbitTime);
    enemy.attackDirection.set(0, 0, 0);

    // Register with HealthManager (if applicable)
    this.eventBus.emit('entity:register', {
      id: enemy.id,
      health: enemy.health,
      maxHealth: enemy.maxHealth,
      isEnemy: true,
    });
  }

  this.updateInstances();
}
Note: minOrbitTime and maxOrbitTime are defined in FlockingMovement (see below). This ensures that reused enemy slots have their phase data reset.

3. Enhance FlockingMovement with Phase Parameters
Add configurable parameters to the FlockingMovement constructor to control the new behaviors:

javascript

Collapse

Wrap

Copy
constructor(options = {}) {
  this.maxSpeed = options.maxSpeed || 0.1;
  this.separationDistance = options.separationDistance || 1.0;
  this.alignmentDistance = options.alignmentDistance || 2.0;
  this.cohesionDistance = options.cohesionDistance || 2.0;
  this.separationStrength = options.separationStrength || 0.05;
  this.alignmentStrength = options.alignmentStrength || 0.03;
  this.cohesionStrength = options.cohesionStrength || 0.02;
  // New phase-related options
  this.orbitRadius = options.orbitRadius || 5.0; // Desired orbiting distance from player
  this.orbitStrength = options.orbitStrength || 0.1; // Force strength to maintain orbit distance
  this.orbitSpeed = options.orbitSpeed || 0.05; // Speed of orbiting motion
  this.attackSpeed = options.attackSpeed || 10.0; // High speed during attack phase
  this.attackDuration = options.attackDuration || 1.0; // Duration of attack phase in seconds
  this.minOrbitTime = options.minOrbitTime || 2.0; // Min time in orbit phase
  this.maxOrbitTime = options.maxOrbitTime || 5.0; // Max time in orbit phase
}
orbitRadius: Distance enemies maintain from the player during orbiting.
orbitStrength: Strength of the force adjusting distance to orbitRadius.
orbitSpeed: Speed of the tangential movement for orbiting.
attackSpeed: High velocity for the attack phase (set high, e.g., 10.0, for “extremely high velocity”).
attackDuration: Time enemies spend attacking before returning to orbit.
minOrbitTime and maxOrbitTime: Range for random orbit duration between attacks.
Adjust these values based on your game’s scale and desired difficulty.

4. Modify the update Method in FlockingMovement
Update the update method to handle phase logic, orbiting, and attacking behaviors:

javascript

Collapse

Wrap

Copy
update(enemyData, activeCount, playerPos, delta) {
  if (!playerPos) return;

  // ... (existing spatial grid building code, if any) ...

  for (let i = 0; i < activeCount; i++) {
    const enemy = enemyData[i];
    if (enemy.state !== 'alive') continue;
    const pos = enemy.position;
    const vel = enemy.velocity;

    // Update phase timer
    enemy.phaseTimer -= delta;

    if (enemy.phase === 'orbit') {
      // Compute flocking forces (optional, adjust as needed)
      let totalForce = new THREE.Vector3();
      // Example: Add separation, alignment, cohesion forces here if desired
      // ... (existing flocking calculations) ...

      // Maintain orbit distance and add orbiting motion
      const toPlayer = new THREE.Vector3().subVectors(playerPos, pos);
      const distance = toPlayer.length();
      if (distance > 0) {
        // Radial force to maintain distance
        const desiredDistance = this.orbitRadius;
        const difference = distance - desiredDistance;
        const orbitForce = toPlayer.clone().normalize().multiplyScalar(-difference * this.orbitStrength);
        totalForce.add(orbitForce);

        // Tangential force for orbiting
        const radial = toPlayer.normalize();
        const tangential = new THREE.Vector3().crossVectors(radial, new THREE.Vector3(0, 1, 0)).normalize();
        totalForce.add(tangential.multiplyScalar(this.orbitSpeed));
      }

      // Apply forces to velocity
      vel.add(totalForce.multiplyScalar(delta));
      if (vel.length() > this.maxSpeed) {
        vel.normalize().multiplyScalar(this.maxSpeed);
      }

      // Check for transition to attack phase
      if (enemy.phaseTimer <= 0) {
        enemy.phase = 'attack';
        enemy.attackDirection.copy(playerPos).sub(pos).normalize();
        enemy.phaseTimer = this.attackDuration;
      }
    } else if (enemy.phase === 'attack') {
      // Charge at high velocity in the initial attack direction
      vel.copy(enemy.attackDirection).multiplyScalar(this.attackSpeed);

      // Check for transition back to orbit phase
      if (enemy.phaseTimer <= 0) {
        enemy.phase = 'orbit';
        enemy.phaseTimer = this.minOrbitTime + Math.random() * (this.maxOrbitTime - this.minOrbitTime);
      }
    }

    // Update position
    pos.add(vel.clone().multiplyScalar(delta));
  }
}
Key Points:

Orbit Phase:
Enemies maintain orbitRadius using a spring-like force (orbitForce).
A tangential force (tangential) makes them circle the player in the horizontal plane (using the up vector (0, 1, 0)).
Flocking forces (separation, alignment, cohesion) can be included but are optional. If your original FlockingMovement had an attraction to the player, remove it here to avoid conflicting with the orbit behavior.
When phaseTimer reaches zero, the enemy switches to 'attack'.
Attack Phase:
Velocity is set directly to attackDirection * attackSpeed, overriding flocking forces for a straight-line charge.
attackDirection is set to the player’s position at the start of the attack, so enemies continue in that direction even if the player moves (allowing dodging).
After attackDuration, the enemy returns to 'orbit' with a new random phaseTimer.
Randomization:
Initial phaseTimer values are randomized (2–5 seconds).
After each attack, phaseTimer is reset to a random value between minOrbitTime and maxOrbitTime, ensuring staggered attacks.
5. Integrate with ParticleEnemyGroup
Ensure the FlockingMovement instance in ParticleEnemyGroup is initialized with the new options:

javascript

Collapse

Wrap

Copy
this.movement = new FlockingMovement({
  maxSpeed: 0.1,
  separationDistance: 1.0,
  alignmentDistance: 2.0,
  cohesionDistance: 2.0,
  separationStrength: 0.05,
  alignmentStrength: 0.03,
  cohesionStrength: 0.02,
  orbitRadius: 5.0,
  orbitStrength: 0.1,
  orbitSpeed: 0.05,
  attackSpeed: 10.0,
  attackDuration: 1.0,
  minOrbitTime: 2.0,
  maxOrbitTime: 5.0,
});
In the update method of ParticleEnemyGroup, pass the player’s position to the movement update:

javascript

Collapse

Wrap

Copy
update(delta, playerPos) {
  this.movement.update(this.enemyData, this.activeCount, playerPos, delta);
  this.updateInstances();
  // ... (existing update logic) ...
}
Final Behavior
Orbiting: Enemies stay approximately 5 units from the player, moving in circular paths due to the tangential force, while optionally flocking with each other.
Attacking: At random intervals (every 2–5 seconds), individual enemies charge toward the player’s position at the start of the attack with a speed of 10 units/second for 1 second, then return to orbiting.
Randomness: The varying phaseTimer durations ensure enemies don’t attack simultaneously, creating a dynamic and unpredictable threat.
Tuning and Adjustments
Orbit Radius: Increase orbitRadius (e.g., to 10.0) if 5.0 feels too close.
Attack Speed: Adjust attackSpeed (e.g., 15.0 or 20.0) for even faster charges, balanced by attackDuration.
Flocking: If enemies feel too scattered during orbiting, strengthen cohesionStrength or add it back if removed.
Collisions: This assumes no obstacles. Add collision checks if your game has walls or terrain.
Test these behaviors in your game and tweak the parameters to match your desired difficulty and feel. Let me know if you need help integrating this with other systems!
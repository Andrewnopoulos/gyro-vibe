import * as THREE from 'three';

/**
 * FlockingMovement class that handles idle, orbiting and attack behaviors for particle enemies
 */
export class FlockingMovement {
    /**
     * Create a new FlockingMovement system
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        // Flocking parameters 
        this.separationDistance = options.separationDistance || 1.0;
        this.alignmentDistance = options.alignmentDistance || 2.0;
        this.cohesionDistance = options.cohesionDistance || 2.0;
        this.separationStrength = options.separationStrength || 0.05;
        this.alignmentStrength = options.alignmentStrength || 0.03;
        this.cohesionStrength = options.cohesionStrength || 0.02;
        this.maxSpeed = options.maxSpeed || 0.1;
        this.cellSize = this.alignmentDistance; // Grid cell size for optimization
        
        // Idle parameters
        this.idleBobAmplitude = options.idleBobAmplitude || 0.1;     // How high the enemy bobs
        this.idleBobFrequency = options.idleBobFrequency || 0.5;     // How fast the enemy bobs
        this.awarenessRadius = options.awarenessRadius || 15.0;      // Distance at which enemies notice the player
        
        // Orbit parameters
        this.orbitRadius = options.orbitRadius || 7.0;               // Desired orbiting distance from player
        this.orbitStrength = options.orbitStrength || 0.15;          // Force strength to maintain orbit distance
        this.orbitSpeed = options.orbitSpeed || 0.08;                // Speed of orbiting motion
        
        // Attack parameters
        this.attackSpeed = options.attackSpeed || 15.0;              // High speed during attack phase
        this.attackDuration = options.attackDuration || 0.8;         // Duration of attack phase in seconds
        this.minAttackTime = options.minAttackTime || 15.0;          // Min time between attacks (much longer)
        this.maxAttackTime = options.maxAttackTime || 30.0;          // Max time between attacks (much longer)
    }

    /**
     * Update enemy velocities based on their current phase and player proximity
     * @param {Array} enemyData - Array of enemy objects with position and velocity
     * @param {number} activeCount - Number of active enemies
     * @param {THREE.Vector3} playerPos - Player's current position
     * @param {number} delta - Time since last update in seconds
     */
    update(enemyData, activeCount, playerPos, delta) {
        if (!playerPos) return;

        // Build spatial grid for efficient neighbor lookups
        const grid = new Map();
        for (let i = 0; i < activeCount; i++) {
            const enemy = enemyData[i];
            if (enemy.state !== 'alive') continue;
            
            const pos = enemy.position;
            const cellX = Math.floor(pos.x / this.cellSize);
            const cellY = Math.floor(pos.y / this.cellSize);
            const cellZ = Math.floor(pos.z / this.cellSize);
            const cellKey = `${cellX}_${cellY}_${cellZ}`;
            
            if (!grid.has(cellKey)) grid.set(cellKey, []);
            grid.get(cellKey).push(i);
        }

        // Update each enemy's velocity based on its phase
        for (let i = 0; i < activeCount; i++) {
            const enemy = enemyData[i];
            if (enemy.state !== 'alive') continue;
            
            const pos = enemy.position;
            const vel = enemy.velocity;
            
            // Calculate distance to player
            const toPlayer = new THREE.Vector3().subVectors(playerPos, pos);
            const distanceToPlayer = toPlayer.length();
            
            // Update phase timer
            enemy.phaseTimer -= delta;
            
            // Check for phase transitions
            if (enemy.phase === 'idle') {
                // When player comes within range, transition to orbit
                if (distanceToPlayer < this.awarenessRadius) {
                    enemy.phase = 'orbit';
                    console.log("Enemy transitioned to orbit phase at distance:", distanceToPlayer);
                }
                
                // Apply bobbing motion in idle state
                this.applyIdleBehavior(enemy, delta);
                
                // For idle phase, we don't use velocity-based position updates
                continue; // Skip the position update at the end
                
            } else if (enemy.phase === 'orbit') {
                // If player goes out of range, return to idle
                if (distanceToPlayer > this.awarenessRadius * 1.2) { // Reduced multiplier for tighter range
                    enemy.phase = 'idle';
                    // Reset velocity to prevent enemies from drifting away
                    vel.set(0, 0, 0);
                } else {
                    // Compute flocking forces with nearby enemies
                    const flockingForce = this.calculateFlockingForce(enemy, enemyData, grid, i);
                    
                    // Calculate forces for orbiting around the player
                    const orbitForce = this.calculateOrbitForce(pos, playerPos, enemy.orbitDirection);
                    
                    // Combine forces and apply to velocity
                    const totalForce = new THREE.Vector3().addVectors(flockingForce, orbitForce);
                    vel.add(totalForce.multiplyScalar(delta));
                    
                    // Limit to maximum speed
                    if (vel.length() > this.maxSpeed) {
                        vel.normalize().multiplyScalar(this.maxSpeed);
                    }
                    
                    // Check for transition to attack phase (rare)
                    if (enemy.phaseTimer <= 0) {
                        enemy.phase = 'attack';
                        // Set direction toward player at start of attack
                        enemy.attackDirection.copy(new THREE.Vector3().subVectors(playerPos, pos).normalize());
                        enemy.phaseTimer = this.attackDuration;
                    }
                }
            } else if (enemy.phase === 'attack') {
                // --- ATTACK PHASE ---
                // Charge directly at high velocity in the stored attack direction
                vel.copy(enemy.attackDirection).multiplyScalar(this.attackSpeed);
                
                // Check for transition back to orbit phase
                if (enemy.phaseTimer <= 0) {
                    enemy.phase = 'orbit';
                    // Very long time until next attack (40-60 seconds)
                    enemy.phaseTimer = this.minAttackTime + Math.random() * (this.maxAttackTime - this.minAttackTime);
                    console.log("Enemy returned to orbit, next attack in:", enemy.phaseTimer, "seconds");
                }
            }
            
            // Update position based on velocity
            pos.add(vel.clone().multiplyScalar(delta));
        }
    }
    
    /**
     * Apply idle behavior with bobbing motion
     * @param {Object} enemy - The enemy to update
     * @param {number} delta - Time delta
     */
    applyIdleBehavior(enemy, delta) {
        const pos = enemy.position;
        const vel = enemy.velocity;
        
        // Simple bobbing in place - direct position adjustment instead of velocity-based
        const time = Date.now() * 0.001; // Convert to seconds
        const offsetTime = time + (enemy.id.length > 0 ? enemy.id.charCodeAt(0) % 10 : 0); // Safe offset based on enemy ID
        
        // Apply sin wave bobbing directly to y position
        const originalY = pos.y;
        pos.y = originalY + Math.sin(offsetTime * this.idleBobFrequency) * this.idleBobAmplitude;
        
        // Reset horizontal velocity to keep enemies from drifting
        vel.set(0, 0, 0);
    }
    
    /**
     * Calculate forces for flocking behavior (separation, alignment, cohesion)
     * @param {Object} enemy - The current enemy
     * @param {Array} enemyData - All enemy data
     * @param {Map} grid - Spatial grid for efficient neighbor lookups
     * @param {number} enemyIndex - Index of the current enemy
     * @returns {THREE.Vector3} Combined flocking force
     */
    calculateFlockingForce(enemy, enemyData, grid, enemyIndex) {
        const pos = enemy.position;
        const vel = enemy.velocity;
        
        // Find neighbors in adjacent cells
        const cellX = Math.floor(pos.x / this.cellSize);
        const cellY = Math.floor(pos.y / this.cellSize);
        const cellZ = Math.floor(pos.z / this.cellSize);
        const adjacentEnemies = [];
        
        // Check all 27 adjacent cells (3x3x3 grid)
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    const adjKey = `${cellX + dx}_${cellY + dy}_${cellZ + dz}`;
                    if (grid.has(adjKey)) {
                        adjacentEnemies.push(...grid.get(adjKey));
                    }
                }
            }
        }
        
        // Initialize force accumulators
        const separation = new THREE.Vector3();
        const alignment = new THREE.Vector3();
        const cohesion = new THREE.Vector3();
        let separationCount = 0;
        let alignmentCount = 0;
        let cohesionCount = 0;
        
        // Process all neighbors
        for (const j of adjacentEnemies) {
            if (j === enemyIndex) continue; // Skip self
            
            const other = enemyData[j];
            if (other.state !== 'alive' || other.phase === 'idle') continue; // Only flock with active non-idle enemies
            
            const otherPos = other.position;
            const distance = pos.distanceTo(otherPos);
            
            // Separation - avoid getting too close
            if (distance < this.separationDistance) {
                const awayVector = new THREE.Vector3().subVectors(pos, otherPos);
                // Strength inversely proportional to distance
                const strength = 1 - (distance / this.separationDistance);
                separation.add(awayVector.normalize().multiplyScalar(strength));
                separationCount++;
            }
            
            // Alignment - align with neighbors' velocities
            if (distance < this.alignmentDistance) {
                alignment.add(other.velocity);
                alignmentCount++;
            }
            
            // Cohesion - move toward center of nearby enemies
            if (distance < this.cohesionDistance) {
                cohesion.add(otherPos);
                cohesionCount++;
            }
        }
        
        // Calculate final forces
        const totalForce = new THREE.Vector3();
        
        // Separation
        if (separationCount > 0) {
            separation.multiplyScalar(this.separationStrength);
            totalForce.add(separation);
        }
        
        // Alignment
        if (alignmentCount > 0) {
            alignment.divideScalar(alignmentCount);
            alignment.sub(vel);
            alignment.multiplyScalar(this.alignmentStrength);
            totalForce.add(alignment);
        }
        
        // Cohesion
        if (cohesionCount > 0) {
            cohesion.divideScalar(cohesionCount);
            cohesion.sub(pos);
            cohesion.multiplyScalar(this.cohesionStrength);
            totalForce.add(cohesion);
        }
        
        return totalForce;
    }
    
    /**
     * Calculate forces for orbiting around the player
     * @param {THREE.Vector3} position - Enemy position
     * @param {THREE.Vector3} playerPos - Player position
     * @param {number} orbitDirection - Direction of orbit (1 for clockwise, -1 for counter-clockwise)
     * @returns {THREE.Vector3} Combined orbit force
     */
    calculateOrbitForce(position, playerPos, orbitDirection) {
        const totalForce = new THREE.Vector3();
        
        // Vector from enemy to player
        const toPlayer = new THREE.Vector3().subVectors(playerPos, position);
        const distance = toPlayer.length();
        
        if (distance > 0) {
            // Radial force to maintain desired orbit distance
            const desiredDistance = this.orbitRadius;
            const distanceDifference = distance - desiredDistance;
            const radialDirection = toPlayer.clone().normalize();
            
            // Spring-like force pushing/pulling to maintain orbit radius
            // Positive when too far, negative when too close
            const radialForce = radialDirection.multiplyScalar(distanceDifference * this.orbitStrength);
            totalForce.add(radialForce);
            
            // Tangential force to create the circular orbit motion
            // Cross product with up vector creates perpendicular direction
            const upVector = new THREE.Vector3(0, 1, 0);
            const tangentialDirection = new THREE.Vector3().crossVectors(toPlayer.normalize(), upVector).normalize();
            
            // Apply the direction multiplier (clockwise or counter-clockwise)
            const tangentialForce = tangentialDirection.multiplyScalar(this.orbitSpeed * orbitDirection);
            totalForce.add(tangentialForce);
        }
        
        return totalForce;
    }
}
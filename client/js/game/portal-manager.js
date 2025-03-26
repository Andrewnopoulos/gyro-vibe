import * as THREE from 'three';

/**
 * Manages entry and exit portals for the VibeVerse portal system
 */
export class PortalManager {
    /**
     * @param {EventBus} eventBus - Application event bus
     * @param {THREE.Scene} scene - The 3D scene
     * @param {FirstPersonController} firstPersonController - The player's controller
     */
    constructor(eventBus, scene, firstPersonController) {
        this.eventBus = eventBus;
        this.scene = scene;
        this.firstPersonController = firstPersonController;
        
        this.startPortalGroup = null;
        this.exitPortalGroup = null;
        this.startPortalBox = null;
        this.exitPortalBox = null;
        this.exitPortalParticleSystem = null;
        this.startPortalParticleSystem = null;
        
        this.isPortalMode = new URLSearchParams(window.location.search).get('portal') === 'true';
        this.refUrl = new URLSearchParams(window.location.search).get('ref');
        this.username = new URLSearchParams(window.location.search).get('username');
        
        this.setupPortals();
        this.setupEventListeners();
        
        console.log('Portal Manager initialized');
    }
    
    /**
     * Set up event listeners
     */
    setupEventListeners() {
        // Check for collisions with portals in scene update loop
        this.eventBus.on('scene:update', this.checkPortalCollisions.bind(this));
        
        // Get player username when needed
        this.eventBus.on('get:player-username', (callback) => {
            if (typeof callback === 'function') {
                callback(this.username);
            }
        });
    }
    
    /**
     * Create start and exit portals
     */
    setupPortals() {
        this.createExitPortal();
        
        if (this.isPortalMode) {
            this.createStartPortal();
        }
    }
    
    /**
     * Create entry portal that player spawns from
     * Only active in portal mode
     */
    createStartPortal() {
        // Create portal group to contain all portal elements
        this.startPortalGroup = new THREE.Group();
        
        // Place portal near player spawn point
        const spawnPoint = this.getSpawnPoint();
        this.startPortalGroup.position.set(spawnPoint.x, spawnPoint.y, spawnPoint.z);
        this.startPortalGroup.rotation.x = 0.35;
        this.startPortalGroup.rotation.y = 0;

        // Create portal effect (reduced size)
        const startPortalGeometry = new THREE.TorusGeometry(5, 0.7, 16, 100);
        const startPortalMaterial = new THREE.MeshPhongMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            transparent: true,
            opacity: 0.8
        });
        const startPortal = new THREE.Mesh(startPortalGeometry, startPortalMaterial);
        this.startPortalGroup.add(startPortal);
                            
        // Create portal inner surface (reduced size)
        const startPortalInnerGeometry = new THREE.CircleGeometry(4.3, 32);
        const startPortalInnerMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const startPortalInner = new THREE.Mesh(startPortalInnerGeometry, startPortalInnerMaterial);
        this.startPortalGroup.add(startPortalInner);

        // Create particle system for portal effect
        const startPortalParticleCount = 800;
        const startPortalParticles = new THREE.BufferGeometry();
        const startPortalPositions = new Float32Array(startPortalParticleCount * 3);
        const startPortalColors = new Float32Array(startPortalParticleCount * 3);

        for (let i = 0; i < startPortalParticleCount * 3; i += 3) {
            // Create particles in a ring around the portal (reduced size)
            const angle = Math.random() * Math.PI * 2;
            const radius = 5 + (Math.random() - 0.5) * 1.5;
            startPortalPositions[i] = Math.cos(angle) * radius;
            startPortalPositions[i + 1] = Math.sin(angle) * radius;
            startPortalPositions[i + 2] = (Math.random() - 0.5) * 1.5;

            // Red color with slight variation
            startPortalColors[i] = 0.8 + Math.random() * 0.2;
            startPortalColors[i + 1] = 0;
            startPortalColors[i + 2] = 0;
        }

        startPortalParticles.setAttribute('position', new THREE.BufferAttribute(startPortalPositions, 3));
        startPortalParticles.setAttribute('color', new THREE.BufferAttribute(startPortalColors, 3));

        const startPortalParticleMaterial = new THREE.PointsMaterial({
            size: 0.1,
            vertexColors: true,
            transparent: true,
            opacity: 0.6
        });

        this.startPortalParticleSystem = new THREE.Points(startPortalParticles, startPortalParticleMaterial);
        this.startPortalGroup.add(this.startPortalParticleSystem);

        // Add portal group to scene
        this.scene.add(this.startPortalGroup);

        // Create portal collision box
        this.startPortalBox = new THREE.Box3().setFromObject(this.startPortalGroup);

        // Animate particles and portal
        this.animateStartPortal();
        
        console.log('Start portal created at', spawnPoint);
    }
    
    /**
     * Create exit portal to other VibeVerse games
     */
    createExitPortal() {
        // Create portal group to contain all portal elements
        this.exitPortalGroup = new THREE.Group();
        
        // Position exit portal in an accessible area of the map
        this.exitPortalGroup.position.set(0, 5, -20);
        this.exitPortalGroup.rotation.x = 0.35;
        this.exitPortalGroup.rotation.y = 0;

        // Create portal effect (reduced size)
        const exitPortalGeometry = new THREE.TorusGeometry(5, 0.7, 16, 100);
        const exitPortalMaterial = new THREE.MeshPhongMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            transparent: true,
            opacity: 0.8
        });
        const exitPortal = new THREE.Mesh(exitPortalGeometry, exitPortalMaterial);
        this.exitPortalGroup.add(exitPortal);

        // Create portal inner surface (reduced size)
        const exitPortalInnerGeometry = new THREE.CircleGeometry(4.3, 32);
        const exitPortalInnerMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const exitPortalInner = new THREE.Mesh(exitPortalInnerGeometry, exitPortalInnerMaterial);
        this.exitPortalGroup.add(exitPortalInner);
        
        // Add portal label (adjusted for smaller portal)
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 64;
        context.fillStyle = '#00ff00';
        context.font = 'bold 32px Arial';
        context.textAlign = 'center';
        context.fillText('VIBEVERSE PORTAL', canvas.width/2, canvas.height/2);
        const texture = new THREE.CanvasTexture(canvas);
        const labelGeometry = new THREE.PlaneGeometry(10, 2); // Reduced size
        const labelMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        const label = new THREE.Mesh(labelGeometry, labelMaterial);
        label.position.y = 7; // Adjusted position for smaller portal
        this.exitPortalGroup.add(label);

        // Create particle system for portal effect
        const exitPortalParticleCount = 800;
        const exitPortalParticles = new THREE.BufferGeometry();
        const exitPortalPositions = new Float32Array(exitPortalParticleCount * 3);
        const exitPortalColors = new Float32Array(exitPortalParticleCount * 3);

        for (let i = 0; i < exitPortalParticleCount * 3; i += 3) {
            // Create particles in a ring around the portal (reduced size)
            const angle = Math.random() * Math.PI * 2;
            const radius = 5 + (Math.random() - 0.5) * 1.5;
            exitPortalPositions[i] = Math.cos(angle) * radius;
            exitPortalPositions[i + 1] = Math.sin(angle) * radius;
            exitPortalPositions[i + 2] = (Math.random() - 0.5) * 1.5;

            // Green color with slight variation
            exitPortalColors[i] = 0;
            exitPortalColors[i + 1] = 0.8 + Math.random() * 0.2;
            exitPortalColors[i + 2] = 0;
        }

        exitPortalParticles.setAttribute('position', new THREE.BufferAttribute(exitPortalPositions, 3));
        exitPortalParticles.setAttribute('color', new THREE.BufferAttribute(exitPortalColors, 3));

        const exitPortalParticleMaterial = new THREE.PointsMaterial({
            size: 0.1,
            vertexColors: true,
            transparent: true,
            opacity: 0.6
        });

        this.exitPortalParticleSystem = new THREE.Points(exitPortalParticles, exitPortalParticleMaterial);
        this.exitPortalGroup.add(this.exitPortalParticleSystem);

        // Add full portal group to scene
        this.scene.add(this.exitPortalGroup);

        // Create portal collision box
        this.exitPortalBox = new THREE.Box3().setFromObject(this.exitPortalGroup);

        // Animate particles and portal
        this.animateExitPortal();
        
        console.log('Exit portal created');
    }
    
    /**
     * Animate start portal particles
     */
    animateStartPortal() {
        if (!this.startPortalParticleSystem) return;
        
        const positions = this.startPortalParticleSystem.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += 0.05 * Math.sin(Date.now() * 0.001 + i);
        }
        this.startPortalParticleSystem.geometry.attributes.position.needsUpdate = true;
        
        // Update bounding box
        if (this.startPortalGroup) {
            this.startPortalBox = new THREE.Box3().setFromObject(this.startPortalGroup);
        }
        
        requestAnimationFrame(this.animateStartPortal.bind(this));
    }
    
    /**
     * Animate exit portal particles
     */
    animateExitPortal() {
        if (!this.exitPortalParticleSystem) return;
        
        const positions = this.exitPortalParticleSystem.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] += 0.05 * Math.sin(Date.now() * 0.001 + i);
        }
        this.exitPortalParticleSystem.geometry.attributes.position.needsUpdate = true;
        
        // Update bounding box
        if (this.exitPortalGroup) {
            this.exitPortalBox = new THREE.Box3().setFromObject(this.exitPortalGroup);
        }
        
        requestAnimationFrame(this.animateExitPortal.bind(this));
    }
    
    /**
     * Get a suitable spawn point for the portal
     * @returns {Object} Spawn point coordinates
     */
    getSpawnPoint() {
        // Try to get a spawn point from the environment, or use default
        let spawnPoint = { x: 0, y: 5, z: 0 };
        
        // Attempt to get the player's camera position
        if (this.firstPersonController && this.firstPersonController.camera) {
            const camera = this.firstPersonController.camera;
            // Place portal slightly behind and above the player
            spawnPoint = {
                x: camera.position.x - Math.sin(camera.rotation.y) * 30,
                y: camera.position.y + 5,
                z: camera.position.z - Math.cos(camera.rotation.y) * 30
            };
        }
        
        return spawnPoint;
    }
    
    /**
     * Check for player collision with portals
     * @param {Object} data - Update data with delta time
     */
    checkPortalCollisions(data) {
        // Check if player has entered start portal (if in portal mode)
        if (this.isPortalMode && this.startPortalBox) {
            this.checkStartPortalCollision();
        }
        
        // Check if player has entered exit portal
        if (this.exitPortalBox) {
            this.checkExitPortalCollision();
        }
    }
    
    /**
     * Check if player has entered the start portal
     */
    checkStartPortalCollision() {
        if (!this.firstPersonController || !this.firstPersonController.isEnabled()) return;
        
        const camera = this.firstPersonController.camera;
        if (!camera) return;
        
        // Create a temporary bounding box for the player
        const playerBox = new THREE.Box3();
        playerBox.expandByPoint(camera.position);
        
        // Calculate distance to portal
        const portalDistance = playerBox.getCenter(new THREE.Vector3())
            .distanceTo(this.startPortalBox.getCenter(new THREE.Vector3()));
        
        // Check if player is close to the portal (reduced detection distance for smaller portal)
        if (portalDistance < 15) {
            // Get ref from URL params
            if (this.refUrl) {
                // Add https if not present
                let url = this.refUrl;
                if (!url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                }
                
                // Transfer all current URL parameters except 'ref'
                const currentParams = new URLSearchParams(window.location.search);
                const newParams = new URLSearchParams();
                
                for (const [key, value] of currentParams) {
                    if (key !== 'ref') { // Skip ref param since it's in the base URL
                        newParams.append(key, value);
                    }
                }
                
                // Redirect to original game
                const paramString = newParams.toString();
                window.location.href = url + (paramString ? '?' + paramString : '');
            }
        }
    }
    
    /**
     * Check if player has entered the exit portal
     */
    checkExitPortalCollision() {
        if (!this.firstPersonController || !this.firstPersonController.isEnabled()) return;
        
        const camera = this.firstPersonController.camera;
        if (!camera) return;
        
        // Create a temporary bounding box for the player
        const playerBox = new THREE.Box3();
        playerBox.expandByPoint(camera.position);
        
        // Calculate distance to portal
        const portalDistance = playerBox.getCenter(new THREE.Vector3())
            .distanceTo(this.exitPortalBox.getCenter(new THREE.Vector3()));
        
        // Check if player is close to the portal (reduced detection distance for smaller portal)
        if (portalDistance < 15) {
            // Start loading the next page in the background
            // Gather player state
            let playerName = this.username;
            let currentSpeed = 5; // Default speed
            
            // Try to get username from event bus if not directly available
            if (!playerName) {
                this.eventBus.emit('get:player-username', (username) => {
                    playerName = username || 'Unknown';
                });
            }
            
            // Gather all current URL parameters
            const currentParams = new URLSearchParams(window.location.search);
            const newParams = new URLSearchParams();
            
            // Add essential portal parameters
            newParams.append('portal', 'true');
            newParams.append('username', playerName || 'Unknown');
            newParams.append('color', 'white');
            newParams.append('speed', currentSpeed.toString());
            newParams.append('ref', window.location.hostname + window.location.pathname);
            
            // Add any other existing parameters
            for (const [key, value] of currentParams) {
                // Avoid duplicates
                if (!['portal', 'username', 'color', 'speed', 'ref'].includes(key)) {
                    newParams.append(key, value);
                }
            }
            
            const paramString = newParams.toString();
            const nextPage = 'https://portal.pieter.com' + (paramString ? '?' + paramString : '');
            
            // Create hidden iframe to preload next page
            if (!document.getElementById('preloadFrame')) {
                const iframe = document.createElement('iframe');
                iframe.id = 'preloadFrame';
                iframe.style.display = 'none';
                iframe.src = nextPage;
                document.body.appendChild(iframe);
            }
            
            // Only redirect once player is actually inside the portal
            if (playerBox.intersectsBox(this.exitPortalBox)) {
                window.location.href = nextPage;
            }
        }
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        // Remove portals from scene
        if (this.startPortalGroup) {
            this.scene.remove(this.startPortalGroup);
        }
        
        if (this.exitPortalGroup) {
            this.scene.remove(this.exitPortalGroup);
        }
    }
}
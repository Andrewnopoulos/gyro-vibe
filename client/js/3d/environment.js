import * as THREE from 'three';

/**
 * Creates the 3D game environment with a medieval theme
 */
export class Environment {
  /**
   * @param {THREE.Scene} scene - The Three.js scene
   * @param {EventBus} eventBus - The application event bus
   */
  constructor(scene, eventBus) {
    this.scene = scene;
    this.eventBus = eventBus;
    
    this.createSkybox();
    this.createTerrain();
    this.createMedievalCastle();
    this.createOuterWalls();
    this.createVillage();
    
    // Add atmospheric fog for medieval ambiance
    this.scene.fog = new THREE.FogExp2(0x888888, 0.008);
    
    // Notify that environment is loaded and ready for physics setup
    // Pass the ground reference directly to the physics system
    this.eventBus.emit('environment:loaded', { ground: this.ground });
  }

  /**
   * Create skybox for the environment
   */
  createSkybox() {
    const skyboxSize = 500;
    const skyboxGeometry = new THREE.BoxGeometry(skyboxSize, skyboxSize, skyboxSize);
    
    // Create skybox materials with dusk/sunset colors for medieval ambiance
    const skyboxMaterials = [
      new THREE.MeshBasicMaterial({ color: 0xaa7744, side: THREE.BackSide }), // Right side
      new THREE.MeshBasicMaterial({ color: 0x995533, side: THREE.BackSide }), // Left side
      new THREE.MeshBasicMaterial({ color: 0xbb8855, side: THREE.BackSide }), // Top side
      new THREE.MeshBasicMaterial({ color: 0x774422, side: THREE.BackSide }), // Bottom side
      new THREE.MeshBasicMaterial({ color: 0xaa6633, side: THREE.BackSide }), // Front side
      new THREE.MeshBasicMaterial({ color: 0x996644, side: THREE.BackSide })  // Back side
    ];
    
    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterials);
    this.scene.add(skybox);
  }

  /**
   * Create terrain with subtle elevation
   */
  createTerrain() {
    // Create ground plane
    const groundSize = 100;
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 32, 32);
    
    // Modify vertices to create subtle hills and depressions
    const vertices = groundGeometry.attributes.position.array;
    for (let i = 0; i < vertices.length; i += 3) {
      // Skip the very center and edges for more playable space
      const x = vertices[i];
      const z = vertices[i + 2];
      const distFromCenter = Math.sqrt(x * x + z * z);
      
      if (distFromCenter > 5 && distFromCenter < 45) {
        // Create rolling hills with coherent height patterns
        vertices[i + 1] = Math.sin(x / 10) * Math.cos(z / 8) * 2;
      }
    }
    
    // Update normals after modifying vertices
    groundGeometry.computeVertexNormals();
    
    const groundMaterial = new THREE.MeshStandardMaterial({ 
      color: 0x556633, 
      roughness: 0.9,
      metalness: 0.1
    });
    
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    ground.userData.isGround = true; // Flag for ground collision checks
    
    // Save reference to the ground for physics detection
    this.ground = ground;
    
    this.scene.add(ground);
  }

  /**
   * Create a medieval castle in the center
   */
  createMedievalCastle() {
    // Castle base/foundation
    const baseGeometry = new THREE.BoxGeometry(16, 1, 16);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0x777777,
      roughness: 0.8,
      metalness: 0.2
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.set(0, -0.2, 0);
    base.receiveShadow = true;
    this.scene.add(base);
    
    // Main keep
    const keepGeometry = new THREE.BoxGeometry(10, 8, 10);
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.9,
      metalness: 0.1
    });
    const keep = new THREE.Mesh(keepGeometry, stoneMaterial);
    keep.position.set(0, 3.5, 0);
    keep.castShadow = true;
    keep.receiveShadow = true;
    this.scene.add(keep);
    
    // Castle towers at corners
    this.createTower(-6, 0, -6);
    this.createTower(-6, 0, 6);
    this.createTower(6, 0, -6);
    this.createTower(6, 0, 6);
    
    // Battlements on main keep
    this.createBattlements(keep.position.x, keep.position.y + 4, keep.position.z, 12, 12);
  }
  
  /**
   * Create a medieval tower
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {number} z - Z position
   */
  createTower(x, y, z) {
    // Tower cylinder
    const towerGeometry = new THREE.CylinderGeometry(1.5, 2, 12, 8);
    const towerMaterial = new THREE.MeshStandardMaterial({
      color: 0x777777,
      roughness: 0.9,
      metalness: 0.1
    });
    const tower = new THREE.Mesh(towerGeometry, towerMaterial);
    tower.position.set(x, y + 5.5, z);
    tower.castShadow = true;
    tower.receiveShadow = true;
    this.scene.add(tower);
    
    // Tower roof cone
    const roofGeometry = new THREE.ConeGeometry(2, 3, 8);
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x883322,
      roughness: 0.7,
      metalness: 0.2
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(x, y + 12.5, z);
    roof.castShadow = true;
    this.scene.add(roof);
  }
  
  /**
   * Create battlements for castle walls
   * @param {number} x - Center X position
   * @param {number} y - Center Y position
   * @param {number} z - Center Z position
   * @param {number} width - Width of battlement area
   * @param {number} depth - Depth of battlement area
   */
  createBattlements(x, y, z, width, depth) {
    const merlon = new THREE.BoxGeometry(1, 1.5, 1);
    const merlonMaterial = new THREE.MeshStandardMaterial({
      color: 0x777777,
      roughness: 0.9,
      metalness: 0.1
    });
    
    // Create battlements along the perimeter
    for (let i = -width/2 + 1; i < width/2; i += 2) {
      // Front wall
      const merlonFront1 = new THREE.Mesh(merlon, merlonMaterial);
      merlonFront1.position.set(x + i, y, z + depth/2);
      merlonFront1.castShadow = true;
      this.scene.add(merlonFront1);
      
      // Back wall
      const merlonBack1 = new THREE.Mesh(merlon, merlonMaterial);
      merlonBack1.position.set(x + i, y, z - depth/2);
      merlonBack1.castShadow = true;
      this.scene.add(merlonBack1);
    }
    
    for (let i = -depth/2 + 1; i < depth/2; i += 2) {
      // Left wall
      const merlonLeft1 = new THREE.Mesh(merlon, merlonMaterial);
      merlonLeft1.position.set(x - width/2, y, z + i);
      merlonLeft1.castShadow = true;
      this.scene.add(merlonLeft1);
      
      // Right wall
      const merlonRight1 = new THREE.Mesh(merlon, merlonMaterial);
      merlonRight1.position.set(x + width/2, y, z + i);
      merlonRight1.castShadow = true;
      this.scene.add(merlonRight1);
    }
  }
  
  /**
   * Create outer defensive walls
   */
  createOuterWalls() {
    const wallHeight = 5;
    const wallThickness = 1;
    const wallLength = 40;
    
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.9,
      metalness: 0.1
    });
    
    // North wall
    const northWallGeometry = new THREE.BoxGeometry(wallLength, wallHeight, wallThickness);
    const northWall = new THREE.Mesh(northWallGeometry, wallMaterial);
    northWall.position.set(0, wallHeight/2 - 0.5, -wallLength/2);
    northWall.castShadow = true;
    northWall.receiveShadow = true;
    this.scene.add(northWall);
    
    // South wall
    const southWallGeometry = new THREE.BoxGeometry(wallLength, wallHeight, wallThickness);
    const southWall = new THREE.Mesh(southWallGeometry, wallMaterial);
    southWall.position.set(0, wallHeight/2 - 0.5, wallLength/2);
    southWall.castShadow = true;
    southWall.receiveShadow = true;
    this.scene.add(southWall);
    
    // East wall
    const eastWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, wallLength);
    const eastWall = new THREE.Mesh(eastWallGeometry, wallMaterial);
    eastWall.position.set(wallLength/2, wallHeight/2 - 0.5, 0);
    eastWall.castShadow = true;
    eastWall.receiveShadow = true;
    this.scene.add(eastWall);
    
    // West wall
    const westWallGeometry = new THREE.BoxGeometry(wallThickness, wallHeight, wallLength);
    const westWall = new THREE.Mesh(westWallGeometry, wallMaterial);
    westWall.position.set(-wallLength/2, wallHeight/2 - 0.5, 0);
    westWall.castShadow = true;
    westWall.receiveShadow = true;
    this.scene.add(westWall);
    
    // Create gate in south wall
    this.createGate(0, 0, wallLength/2);
    
    // Create corner towers
    this.createCornerTower(-wallLength/2, -wallLength/2);
    this.createCornerTower(-wallLength/2, wallLength/2);
    this.createCornerTower(wallLength/2, -wallLength/2);
    this.createCornerTower(wallLength/2, wallLength/2);
  }
  
  /**
   * Create a corner tower for the outer wall
   * @param {number} x - X position
   * @param {number} z - Z position
   */
  createCornerTower(x, z) {
    const towerGeometry = new THREE.CylinderGeometry(2, 2, 8, 8);
    const towerMaterial = new THREE.MeshStandardMaterial({
      color: 0x777777,
      roughness: 0.9,
      metalness: 0.1
    });
    const tower = new THREE.Mesh(towerGeometry, towerMaterial);
    tower.position.set(x, 3.5, z);
    tower.castShadow = true;
    tower.receiveShadow = true;
    this.scene.add(tower);
    
    // Add battlements to the tower
    this.createTowerBattlements(x, 8, z, 2.5);
  }
  
  /**
   * Create battlements for a tower
   */
  createTowerBattlements(x, y, z, radius) {
    const merlon = new THREE.BoxGeometry(0.7, 1, 0.7);
    const merlonMaterial = new THREE.MeshStandardMaterial({
      color: 0x777777,
      roughness: 0.9,
      metalness: 0.1
    });
    
    // Create battlements in a circle
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 6) {
      const merlonX = x + Math.cos(angle) * radius;
      const merlonZ = z + Math.sin(angle) * radius;
      
      const merlonTower = new THREE.Mesh(merlon, merlonMaterial);
      merlonTower.position.set(merlonX, y, merlonZ);
      merlonTower.castShadow = true;
      this.scene.add(merlonTower);
    }
  }
  
  /**
   * Create a gate in the wall
   */
  createGate(x, y, z) {
    // Gate structure
    const gateWidth = 6;
    const gateHeight = 5;
    const gateDepth = 2;
    
    // Create gate opening
    const gateGeometry = new THREE.BoxGeometry(gateWidth, gateHeight, gateDepth);
    const gateMaterial = new THREE.MeshStandardMaterial({
      color: 0x664422,
      roughness: 0.9,
      metalness: 0.2
    });
    const gate = new THREE.Mesh(gateGeometry, gateMaterial);
    gate.position.set(x, gateHeight/2 - 0.5, z);
    gate.castShadow = true;
    gate.receiveShadow = true;
    this.scene.add(gate);
    
    // Gate arch
    const archGeometry = new THREE.CylinderGeometry(gateWidth/2, gateWidth/2, gateDepth, 16, 1, true, Math.PI, Math.PI);
    const archMaterial = new THREE.MeshStandardMaterial({
      color: 0x888888,
      roughness: 0.9,
      metalness: 0.1
    });
    const arch = new THREE.Mesh(archGeometry, archMaterial);
    arch.rotation.z = Math.PI / 2;
    arch.position.set(x, gateHeight - 0.5, z);
    arch.castShadow = true;
    arch.receiveShadow = true;
    this.scene.add(arch);
  }
  
  /**
   * Create a medieval village with buildings
   */
  createVillage() {
    // Position patterns for houses in a medieval layout
    const housePositions = [
      { x: -15, z: -12 },
      { x: -20, z: -6 },
      { x: -18, z: 8 },
      { x: -25, z: 15 },
      { x: -10, z: 20 },
      { x: 12, z: -15 },
      { x: 16, z: -8 },
      { x: 22, z: -20 },
      { x: 18, z: 12 },
      { x: 25, z: 18 }
    ];
    
    housePositions.forEach(pos => {
      this.createMedievalHouse(pos.x, pos.z);
    });
    
    // Create a market in the center
    this.createMarketplace(-10, 5);
    
    // Add decorative elements
    this.createWell(5, 15);
    this.createHayBales(15, 5);
    this.createBarrels(-15, -3);
  }
  
  /**
   * Create a medieval house
   * @param {number} x - X position
   * @param {number} z - Z position
   */
  createMedievalHouse(x, z) {
    // Slightly randomize house dimensions for variety
    const rotation = (Math.floor(Math.random() * 4)) * (Math.PI / 2);
    const width = 4 + Math.floor(Math.random() * 2);
    const depth = 3 + Math.floor(Math.random() * 2);
    const height = 2.5 + Math.random();
    
    // House base/foundation
    const baseGeometry = new THREE.BoxGeometry(width, height, depth);
    const baseMaterial = new THREE.MeshStandardMaterial({
      color: 0xddddaa, // Plaster color
      roughness: 0.9,
      metalness: 0.0
    });
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.position.set(x, height/2 - 0.5, z);
    base.rotation.y = rotation;
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);
    
    // Create timber framing for the house
    this.createTimberFraming(base, width, height, depth);
    
    // Roof
    const roofHeight = 2;
    const overhang = 0.3;
    const roofGeometry = new THREE.ConeGeometry(
      Math.sqrt((width + overhang) * (width + overhang) + (depth + overhang) * (depth + overhang)) / 2,
      roofHeight,
      4
    );
    const roofMaterial = new THREE.MeshStandardMaterial({
      color: 0x883322, // Roof tiles color
      roughness: 0.8,
      metalness: 0.1
    });
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(x, height + roofHeight/2 - 0.5, z);
    roof.rotation.y = rotation + Math.PI / 4;
    roof.castShadow = true;
    this.scene.add(roof);
  }
  
  /**
   * Create timber framing for a medieval house
   */
  createTimberFraming(baseHouse, width, height, depth) {
    const timberMaterial = new THREE.MeshStandardMaterial({
      color: 0x442200,
      roughness: 0.9,
      metalness: 0.0
    });
    
    // Horizontal beams
    const hBeamGeometry = new THREE.BoxGeometry(width + 0.1, 0.3, 0.3);
    const hBeam1 = new THREE.Mesh(hBeamGeometry, timberMaterial);
    hBeam1.position.copy(baseHouse.position);
    hBeam1.position.y = baseHouse.position.y - height/2 + 0.5;
    hBeam1.rotation.y = baseHouse.rotation.y;
    this.scene.add(hBeam1);
    
    const hBeam2 = new THREE.Mesh(hBeamGeometry, timberMaterial);
    hBeam2.position.copy(baseHouse.position);
    hBeam2.position.y = baseHouse.position.y + height/2 - 0.5;
    hBeam2.rotation.y = baseHouse.rotation.y;
    this.scene.add(hBeam2);
    
    // Vertical beams
    const spacing = 1.2;
    for (let i = -width/2 + 0.5; i <= width/2 - 0.5; i += spacing) {
      const vBeamGeometry = new THREE.BoxGeometry(0.3, height, 0.3);
      const vBeam = new THREE.Mesh(vBeamGeometry, timberMaterial);
      
      // Calculate position based on house rotation
      const xOffset = i * Math.cos(baseHouse.rotation.y);
      const zOffset = i * Math.sin(baseHouse.rotation.y);
      
      vBeam.position.set(
        baseHouse.position.x + xOffset,
        baseHouse.position.y,
        baseHouse.position.z + zOffset
      );
      
      vBeam.rotation.y = baseHouse.rotation.y;
      this.scene.add(vBeam);
    }
  }
  
  /**
   * Create a well
   */
  createWell(x, z) {
    const wellGeometry = new THREE.CylinderGeometry(1.5, 1.5, 1.5, 12);
    const stoneMaterial = new THREE.MeshStandardMaterial({
      color: 0x777777,
      roughness: 1.0,
      metalness: 0.0
    });
    const well = new THREE.Mesh(wellGeometry, stoneMaterial);
    well.position.set(x, 0.25, z);
    well.castShadow = true;
    well.receiveShadow = true;
    this.scene.add(well);
    
    // Wooden roof structure
    const roofGeometry = new THREE.ConeGeometry(2, 1.5, 4);
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: 0x664422,
      roughness: 0.9,
      metalness: 0.0
    });
    const roof = new THREE.Mesh(roofGeometry, woodMaterial);
    roof.position.set(x, 2.25, z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    this.scene.add(roof);
    
    // Support beams
    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI) {
      const postGeometry = new THREE.BoxGeometry(0.2, 2, 0.2);
      const post = new THREE.Mesh(postGeometry, woodMaterial);
      post.position.set(
        x + Math.cos(angle) * 1,
        1.5,
        z + Math.sin(angle) * 1
      );
      post.castShadow = true;
      this.scene.add(post);
    }
  }
  
  /**
   * Create hay bales
   */
  createHayBales(x, z) {
    const hayMaterial = new THREE.MeshStandardMaterial({
      color: 0xddbb55,
      roughness: 1.0,
      metalness: 0.0
    });
    
    // Create a cluster of hay bales
    for (let i = 0; i < 5; i++) {
      const hayGeometry = new THREE.CylinderGeometry(0.8, 0.8, 1.6, 12);
      const hay = new THREE.Mesh(hayGeometry, hayMaterial);
      hay.rotation.x = Math.PI / 2;
      hay.position.set(
        x + (i % 3 - 1) * 1.8,
        0.8 - 0.5,
        z + Math.floor(i / 3) * 1.8
      );
      hay.castShadow = true;
      hay.receiveShadow = true;
      this.scene.add(hay);
    }
  }
  
  /**
   * Create marketplace
   */
  createMarketplace(x, z) {
    // Create market stalls
    for (let i = 0; i < 3; i++) {
      this.createMarketStall(
        x + i * 4,
        z - i * 2
      );
    }
  }
  
  /**
   * Create market stall
   */
  createMarketStall(x, z) {
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: 0x664422,
      roughness: 0.9,
      metalness: 0.0
    });
    
    const clothMaterial = new THREE.MeshStandardMaterial({
      color: 0xbb4422,
      roughness: 0.7,
      metalness: 0.0
    });
    
    // Stall base
    const baseGeometry = new THREE.BoxGeometry(3, 0.2, 2);
    const base = new THREE.Mesh(baseGeometry, woodMaterial);
    base.position.set(x, 0.1 - 0.5, z);
    base.receiveShadow = true;
    this.scene.add(base);
    
    // Stall canopy
    const canopyGeometry = new THREE.BoxGeometry(3.5, 0.1, 2.5);
    const canopy = new THREE.Mesh(canopyGeometry, clothMaterial);
    canopy.position.set(x, 2 - 0.5, z);
    canopy.castShadow = true;
    this.scene.add(canopy);
    
    // Support posts
    for (let i = 0; i < 4; i++) {
      const postGeometry = new THREE.BoxGeometry(0.2, 2, 0.2);
      const post = new THREE.Mesh(postGeometry, woodMaterial);
      
      post.position.set(
        x + (i % 2 === 0 ? -1.5 : 1.5),
        1 - 0.5,
        z + (i < 2 ? -1 : 1)
      );
      
      post.castShadow = true;
      this.scene.add(post);
    }
    
    // Add goods on the stall
    const goodsGeometry = new THREE.BoxGeometry(2, 0.5, 1);
    const goodsMaterial = new THREE.MeshStandardMaterial({
      color: 0xaa9966,
      roughness: 0.8,
      metalness: 0.1
    });
    const goods = new THREE.Mesh(goodsGeometry, goodsMaterial);
    goods.position.set(x, 0.45 - 0.5, z);
    goods.castShadow = true;
    this.scene.add(goods);
  }
  
  /**
   * Create barrels
   */
  createBarrels(x, z) {
    const barrelMaterial = new THREE.MeshStandardMaterial({
      color: 0x885522,
      roughness: 0.7,
      metalness: 0.2
    });
    
    // Create a cluster of barrels
    for (let i = 0; i < 6; i++) {
      const barrelGeometry = new THREE.CylinderGeometry(0.7, 0.7, 1.4, 12);
      const barrel = new THREE.Mesh(barrelGeometry, barrelMaterial);
      
      // Arrange barrels in a cluster
      const row = Math.floor(i / 3);
      const col = i % 3;
      
      barrel.position.set(
        x + col * 1.5,
        0.7 - 0.5,
        z + row * 1.5
      );
      
      barrel.castShadow = true;
      barrel.receiveShadow = true;
      this.scene.add(barrel);
    }
  }
}
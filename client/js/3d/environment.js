import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/**
 * Creates a medieval village 3D environment with physics and multiplayer support
 */
export class Environment {
  /**
   * @param {THREE.Scene} scene - The Three.js scene
   * @param {PhysicsManager} physicsManager - Physics manager for collision bodies (optional)
   */
  constructor(scene, physicsManager = null) {
    this.scene = scene;
    this.physicsManager = physicsManager;
    this.objects = new Map(); // Store references to environment objects
    this.spawnPoints = []; // Player spawn locations
    
    // Define material properties for different surface types
    this.materials = {
      wood: {
        visual: new THREE.MeshStandardMaterial({ 
          color: 0x8B4513, 
          roughness: 0.8, 
          metalness: 0.1 
        }),
        physics: {
          friction: 0.5,
          restitution: 0.2
        }
      },
      stone: {
        visual: new THREE.MeshStandardMaterial({ 
          color: 0x808080, 
          roughness: 0.9, 
          metalness: 0.1 
        }),
        physics: {
          friction: 0.7,
          restitution: 0.1
        }
      },
      soil: {
        visual: new THREE.MeshStandardMaterial({ 
          color: 0x553311, 
          roughness: 1.0, 
          metalness: 0.0 
        }),
        physics: {
          friction: 0.8,
          restitution: 0.1
        }
      },
      grass: {
        visual: new THREE.MeshStandardMaterial({ 
          color: 0x3a8c3a, 
          roughness: 0.8, 
          metalness: 0.0 
        }),
        physics: {
          friction: 0.4,
          restitution: 0.2
        }
      },
      thatch: {
        visual: new THREE.MeshStandardMaterial({ 
          color: 0xddb35b, 
          roughness: 1.0, 
          metalness: 0.0 
        }),
        physics: {
          friction: 0.6,
          restitution: 0.15
        }
      },
      metal: {
        visual: new THREE.MeshStandardMaterial({ 
          color: 0x8c8c9c, 
          roughness: 0.3, 
          metalness: 0.8 
        }),
        physics: {
          friction: 0.3,
          restitution: 0.5
        }
      }
    };
    
    this.createSkybox();
    this.createTerrain();
    this.createVillage();
    
    // Add atmospheric fog
    this.scene.fog = new THREE.FogExp2(0xd6cca1, 0.02);
  }

  /**
   * Create skybox for the environment (dawn/dusk lighting)
   */
  createSkybox() {
    const skyboxSize = 500;
    const skyboxGeometry = new THREE.BoxGeometry(skyboxSize, skyboxSize, skyboxSize);
    
    // Create skybox materials with medieval-appropriate colors
    const skyboxMaterials = [
      new THREE.MeshBasicMaterial({ color: 0xd6944a, side: THREE.BackSide }), // Right (East) - warm sunrise
      new THREE.MeshBasicMaterial({ color: 0x4a5e94, side: THREE.BackSide }), // Left (West) - cooler sunset
      new THREE.MeshBasicMaterial({ color: 0x9cb4e6, side: THREE.BackSide }), // Top (Sky)
      new THREE.MeshBasicMaterial({ color: 0x6b7b96, side: THREE.BackSide }), // Bottom
      new THREE.MeshBasicMaterial({ color: 0x93a2b8, side: THREE.BackSide }), // Front (North)
      new THREE.MeshBasicMaterial({ color: 0x89a39e, side: THREE.BackSide })  // Back (South)
    ];
    
    const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterials);
    this.scene.add(skybox);
  }

  /**
   * Create terrain with proper physics
   */
  createTerrain() {
    // Create ground plane
    const groundSize = 100;
    const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 32, 32);
    const groundMaterial = this.materials.grass.visual;
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    this.scene.add(ground);
    
    // Store in objects map
    this.objects.set('mainGround', ground);
    
    // Create paths
    this.createPaths();
    
    // If physics manager is available, create ground physics
    if (this.physicsManager) {
      // Physics is already created in PhysicsManager
      // We don't need to recreate the ground plane
    }
  }

  /**
   * Create dirt paths connecting village buildings
   */
  createPaths() {
    // Main north-south path
    this.createPath({
      start: { x: 0, z: -20 },
      end: { x: 0, z: 20 },
      width: 3
    });
    
    // East-west path crossing the main one
    this.createPath({
      start: { x: -20, z: 0 },
      end: { x: 20, z: 0 },
      width: 3
    });
    
    // Path to tavern
    this.createPath({
      start: { x: 0, z: 0 },
      end: { x: 15, z: 15 },
      width: 2
    });
    
    // Path to blacksmith
    this.createPath({
      start: { x: 0, z: 0 },
      end: { x: -15, z: 15 },
      width: 2
    });
  }
  
  /**
   * Create a dirt path between two points
   * @param {Object} options - Path options
   */
  createPath({ start, end, width }) {
    // Calculate path vector and length
    const pathVector = new THREE.Vector2(end.x - start.x, end.z - start.z);
    const length = pathVector.length();
    
    // Create path geometry
    const pathGeometry = new THREE.PlaneGeometry(width, length);
    const pathMaterial = this.materials.soil.visual;
    const path = new THREE.Mesh(pathGeometry, pathMaterial);
    
    // Position and rotate path
    path.rotation.x = -Math.PI / 2;
    path.position.y = -0.48; // Slightly above ground to prevent z-fighting
    
    // Calculate center position
    path.position.x = (start.x + end.x) / 2;
    path.position.z = (start.z + end.z) / 2;
    
    // Calculate rotation angle
    const angle = Math.atan2(pathVector.y, pathVector.x);
    path.rotation.z = -angle; // Negative because of the plane rotation
    
    path.receiveShadow = true;
    this.scene.add(path);
  }

  /**
   * Create the full medieval village
   */
  createVillage() {
    // Create central village square
    this.createVillageSquare();
    
    // Create various buildings
    this.createTavern({ x: 15, z: 15 });
    this.createBlacksmith({ x: -15, z: 15 });
    this.createHouses();
    
    // Create village walls
    this.createVillageWalls();
    
    // Create decorative elements
    this.createWell({ x: 0, z: 0 });
    this.createDecorations();
    
    // Define spawn points for multiplayer
    this.defineSpawnPoints();
  }
  
  /**
   * Create the central village square
   */
  createVillageSquare() {
    // Create a slightly elevated square in the center
    const squareSize = 10;
    const squareGeometry = new THREE.BoxGeometry(squareSize, 0.2, squareSize);
    const squareMaterial = this.materials.stone.visual;
    const square = new THREE.Mesh(squareGeometry, squareMaterial);
    square.position.set(0, -0.4, 0);
    square.receiveShadow = true;
    this.scene.add(square);
    
    // Add physics if available
    if (this.physicsManager) {
      this.addPhysicsBox(square, 0); // Mass 0 for static object
    }
    
    // Add a monument or statue in the center
    const monumentBaseGeometry = new THREE.BoxGeometry(2, 1, 2);
    const monumentBase = new THREE.Mesh(monumentBaseGeometry, this.materials.stone.visual);
    monumentBase.position.set(0, 0.1, 0);
    monumentBase.castShadow = true;
    monumentBase.receiveShadow = true;
    this.scene.add(monumentBase);
    
    // Add physics for the monument base
    if (this.physicsManager) {
      this.addPhysicsBox(monumentBase, 0);
    }
    
    // Create a simple statue (pillar)
    const statueGeometry = new THREE.CylinderGeometry(0.3, 0.3, 3, 8);
    const statueMaterial = this.materials.stone.visual;
    const statue = new THREE.Mesh(statueGeometry, statueMaterial);
    statue.position.set(0, 2, 0);
    statue.castShadow = true;
    statue.receiveShadow = true;
    this.scene.add(statue);
    
    // Add physics for the statue
    if (this.physicsManager) {
      const statueShape = new CANNON.Cylinder(0.3, 0.3, 3, 8);
      this.addPhysicsShape(statue, statueShape, 0);
    }
  }
  
  /**
   * Create tavern building at specified position
   * @param {Object} position - Position {x, z}
   */
  createTavern(position) {
    // Base building
    const tavernWidth = 8;
    const tavernDepth = 6;
    const tavernHeight = 4;
    
    // Main structure
    const tavernGeometry = new THREE.BoxGeometry(tavernWidth, tavernHeight, tavernDepth);
    const tavernMaterial = this.materials.wood.visual;
    const tavern = new THREE.Mesh(tavernGeometry, tavernMaterial);
    tavern.position.set(position.x, tavernHeight/2, position.z);
    tavern.castShadow = true;
    tavern.receiveShadow = true;
    this.scene.add(tavern);
    
    // Add physics for tavern walls
    if (this.physicsManager) {
      // Use a compound shape to create a hollow building
      this.createHollowBuildingPhysics(tavern, tavernWidth, tavernHeight, tavernDepth);
    }
    
    // Create roof
    this.createPitchedRoof({
      width: tavernWidth + 1,
      depth: tavernDepth + 1,
      height: 2.5,
      position: { 
        x: position.x, 
        y: tavernHeight, 
        z: position.z 
      }
    });
    
    // Add door and windows
    this.createDoor({
      width: 1.2,
      height: 2.2,
      position: {
        x: position.x,
        y: 1.1,
        z: position.z - tavernDepth/2
      },
      rotation: Math.PI // Face south
    });
    
    // Create windows
    this.createWindow({
      width: 1,
      height: 1,
      position: {
        x: position.x - tavernWidth/3,
        y: 2.5,
        z: position.z - tavernDepth/2
      },
      rotation: Math.PI // Face south
    });
    
    this.createWindow({
      width: 1,
      height: 1,
      position: {
        x: position.x + tavernWidth/3,
        y: 2.5,
        z: position.z - tavernDepth/2
      },
      rotation: Math.PI // Face south
    });
    
    // Add a sign
    this.createSign({
      text: "Tavern",
      position: {
        x: position.x,
        y: 3,
        z: position.z - tavernDepth/2 - 0.1
      }
    });
    
    // Create a chimney
    const chimneyGeometry = new THREE.BoxGeometry(1, 3, 1);
    const chimney = new THREE.Mesh(chimneyGeometry, this.materials.stone.visual);
    chimney.position.set(position.x + tavernWidth/2 - 0.5, tavernHeight + 1.5, position.z);
    chimney.castShadow = true;
    chimney.receiveShadow = true;
    this.scene.add(chimney);
    
    if (this.physicsManager) {
      this.addPhysicsBox(chimney, 0);
    }
    
    // Store building reference
    this.objects.set('tavern', tavern);
  }
  
  /**
   * Create blacksmith building at specified position
   * @param {Object} position - Position {x, z}
   */
  createBlacksmith(position) {
    // Base building
    const smithWidth = 7;
    const smithDepth = 5;
    const smithHeight = 3.5;
    
    // Main structure
    const smithGeometry = new THREE.BoxGeometry(smithWidth, smithHeight, smithDepth);
    const smithMaterial = this.materials.stone.visual;
    const smith = new THREE.Mesh(smithGeometry, smithMaterial);
    smith.position.set(position.x, smithHeight/2, position.z);
    smith.castShadow = true;
    smith.receiveShadow = true;
    this.scene.add(smith);
    
    // Add physics
    if (this.physicsManager) {
      this.createHollowBuildingPhysics(smith, smithWidth, smithHeight, smithDepth);
    }
    
    // Create roof
    this.createPitchedRoof({
      width: smithWidth + 1,
      depth: smithDepth + 1,
      height: 2,
      position: { 
        x: position.x, 
        y: smithHeight, 
        z: position.z 
      }
    });
    
    // Add door
    this.createDoor({
      width: 1.2,
      height: 2.2,
      position: {
        x: position.x,
        y: 1.1,
        z: position.z - smithDepth/2
      },
      rotation: Math.PI // Face south
    });
    
    // Add forge (small stone structure to the side)
    const forgeGeometry = new THREE.BoxGeometry(2, 1.5, 2);
    const forge = new THREE.Mesh(forgeGeometry, this.materials.stone.visual);
    forge.position.set(position.x - smithWidth/2 - 1.5, 0.75, position.z);
    forge.castShadow = true;
    forge.receiveShadow = true;
    this.scene.add(forge);
    
    if (this.physicsManager) {
      this.addPhysicsBox(forge, 0);
    }
    
    // Add chimney to forge
    const chimneyGeometry = new THREE.CylinderGeometry(0.4, 0.5, 3, 8);
    const chimney = new THREE.Mesh(chimneyGeometry, this.materials.stone.visual);
    chimney.position.set(position.x - smithWidth/2 - 1.5, 2.5, position.z);
    chimney.castShadow = true;
    chimney.receiveShadow = true;
    this.scene.add(chimney);
    
    if (this.physicsManager) {
      const chimneyShape = new CANNON.Cylinder(0.4, 0.5, 3, 8);
      this.addPhysicsShape(chimney, chimneyShape, 0);
    }
    
    // Add anvil
    const anvilBaseGeometry = new THREE.BoxGeometry(0.5, 0.8, 0.3);
    const anvilBase = new THREE.Mesh(anvilBaseGeometry, this.materials.metal.visual);
    anvilBase.position.set(position.x - smithWidth/2 - 1.5, 1.15, position.z + 0.5);
    anvilBase.castShadow = true;
    anvilBase.receiveShadow = true;
    this.scene.add(anvilBase);
    
    const anvilTopGeometry = new THREE.BoxGeometry(0.8, 0.2, 0.4);
    const anvilTop = new THREE.Mesh(anvilTopGeometry, this.materials.metal.visual);
    anvilTop.position.set(position.x - smithWidth/2 - 1.5, 1.4, position.z + 0.5);
    anvilTop.castShadow = true;
    anvilTop.receiveShadow = true;
    this.scene.add(anvilTop);
    
    if (this.physicsManager) {
      this.addPhysicsBox(anvilBase, 0);
      this.addPhysicsBox(anvilTop, 0);
    }
    
    // Add sign
    this.createSign({
      text: "Blacksmith",
      position: {
        x: position.x,
        y: 3,
        z: position.z - smithDepth/2 - 0.1
      }
    });
    
    // Store building reference
    this.objects.set('blacksmith', smith);
  }
  
  /**
   * Create multiple houses around the village
   */
  createHouses() {
    // House positions
    const housePositions = [
      { x: -12, z: -10 },
      { x: 12, z: -12 },
      { x: -8, z: -18 },
      { x: 15, z: -5 },
      { x: -18, z: 5 }
    ];
    
    // Create each house with slight variations
    housePositions.forEach((pos, index) => {
      // Randomize house dimensions slightly
      const width = 4 + Math.random() * 2;
      const depth = 4 + Math.random() * 1.5;
      const height = 2.5 + Math.random() * 0.5;
      
      // Randomize rotation
      const rotation = Math.floor(Math.random() * 4) * (Math.PI / 2);
      
      this.createHouse({
        position: pos,
        width: width,
        depth: depth,
        height: height,
        rotation: rotation,
        index: index
      });
    });
  }
  
  /**
   * Create a single house
   * @param {Object} options - House options
   */
  createHouse({ position, width, depth, height, rotation, index }) {
    // Main house structure
    const houseGeometry = new THREE.BoxGeometry(width, height, depth);
    const houseMaterial = index % 2 === 0 ? this.materials.wood.visual : this.materials.stone.visual;
    const house = new THREE.Mesh(houseGeometry, houseMaterial);
    house.position.set(position.x, height/2, position.z);
    house.rotation.y = rotation;
    house.castShadow = true;
    house.receiveShadow = true;
    this.scene.add(house);
    
    // Add physics
    if (this.physicsManager) {
      this.createHollowBuildingPhysics(house, width, height, depth, rotation);
    }
    
    // Create roof
    this.createPitchedRoof({
      width: width + 0.5,
      depth: depth + 0.5,
      height: 1.5 + Math.random() * 0.5,
      position: { 
        x: position.x, 
        y: height, 
        z: position.z 
      },
      rotation: rotation
    });
    
    // Create door based on rotation
    const doorOffset = new THREE.Vector3(0, 0, depth/2);
    doorOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
    
    this.createDoor({
      width: 0.9,
      height: 1.8,
      position: {
        x: position.x - doorOffset.x,
        y: 0.9,
        z: position.z - doorOffset.z
      },
      rotation: rotation
    });
    
    // Create window
    const windowOffset = new THREE.Vector3(width/3, 0, depth/2);
    windowOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
    
    this.createWindow({
      width: 0.7,
      height: 0.7,
      position: {
        x: position.x - windowOffset.x,
        y: height - 0.8,
        z: position.z - windowOffset.z
      },
      rotation: rotation
    });
    
    // Store house reference
    this.objects.set(`house_${index}`, house);
  }
  
  /**
   * Create a pitched roof for a building
   * @param {Object} options - Roof options
   */
  createPitchedRoof({ width, depth, height, position, rotation = 0 }) {
    // Create a triangular prism for the roof
    const vertices = [
      // Left side
      new THREE.Vector3(-width/2, 0, depth/2),
      new THREE.Vector3(-width/2, 0, -depth/2),
      new THREE.Vector3(-width/2, height, 0),
      // Right side
      new THREE.Vector3(width/2, 0, depth/2),
      new THREE.Vector3(width/2, 0, -depth/2),
      new THREE.Vector3(width/2, height, 0),
    ];
    
    const indices = [
      // Left side
      0, 1, 2,
      // Right side
      5, 4, 3,
      // Front side
      0, 2, 5,
      0, 5, 3,
      // Back side
      1, 4, 2,
      4, 5, 2,
      // Bottom
      0, 3, 1,
      1, 3, 4
    ];
    
    const roofGeometry = new THREE.BufferGeometry();
    
    // Create position attribute
    const positionArray = [];
    for (const vertex of vertices) {
      positionArray.push(vertex.x, vertex.y, vertex.z);
    }
    roofGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positionArray, 3));
    
    // Set indices
    roofGeometry.setIndex(indices);
    
    // Calculate normals
    roofGeometry.computeVertexNormals();
    
    // Create the roof mesh
    const roofMaterial = this.materials.thatch.visual;
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(position.x, position.y, position.z);
    if (rotation) {
      roof.rotation.y = rotation;
    }
    roof.castShadow = true;
    roof.receiveShadow = true;
    this.scene.add(roof);
    
    // Add physics for the roof
    if (this.physicsManager) {
      // Simplified physics representation (just a box)
      const physicsShape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
      this.addPhysicsShape(roof, physicsShape, 0);
    }
    
    return roof;
  }
  
  /**
   * Create a door
   * @param {Object} options - Door options
   */
  createDoor({ width, height, position, rotation = 0 }) {
    const doorGeometry = new THREE.PlaneGeometry(width, height);
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x5c3a21,
      roughness: 0.9,
      metalness: 0.1
    });
    
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(position.x, position.y, position.z);
    door.rotation.y = rotation;
    door.castShadow = true;
    door.receiveShadow = true;
    this.scene.add(door);
    
    // Add door handle
    const handleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const handleMaterial = this.materials.metal.visual;
    const handle = new THREE.Mesh(handleGeometry, handleMaterial);
    handle.position.set(
      position.x + Math.sin(rotation) * (width/3),
      position.y,
      position.z + Math.cos(rotation) * (width/3)
    );
    handle.castShadow = true;
    this.scene.add(handle);
    
    return door;
  }
  
  /**
   * Create a window
   * @param {Object} options - Window options
   */
  createWindow({ width, height, position, rotation = 0 }) {
    // Window frame
    const frameGeometry = new THREE.BoxGeometry(width + 0.1, height + 0.1, 0.1);
    const frameMaterial = this.materials.wood.visual;
    const frame = new THREE.Mesh(frameGeometry, frameMaterial);
    frame.position.set(position.x, position.y, position.z);
    frame.rotation.y = rotation;
    frame.castShadow = true;
    frame.receiveShadow = true;
    this.scene.add(frame);
    
    // Window glass
    const glassGeometry = new THREE.PlaneGeometry(width - 0.1, height - 0.1);
    const glassMaterial = new THREE.MeshStandardMaterial({
      color: 0xd0ecff,
      transparent: true,
      opacity: 0.6,
      roughness: 0.2,
      metalness: 0.1
    });
    
    const glass = new THREE.Mesh(glassGeometry, glassMaterial);
    glass.position.set(
      position.x,
      position.y,
      position.z + 0.01 * Math.cos(rotation)
    );
    glass.rotation.y = rotation;
    this.scene.add(glass);
    
    // Window crossbar
    const crossbarGeometry = new THREE.BoxGeometry(width, 0.05, 0.05);
    const crossbar1 = new THREE.Mesh(crossbarGeometry, frameMaterial);
    crossbar1.position.set(
      position.x,
      position.y,
      position.z + 0.05 * Math.cos(rotation)
    );
    crossbar1.rotation.y = rotation;
    this.scene.add(crossbar1);
    
    const crossbar2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, height, 0.05),
      frameMaterial
    );
    crossbar2.position.set(
      position.x,
      position.y,
      position.z + 0.05 * Math.cos(rotation)
    );
    crossbar2.rotation.y = rotation;
    this.scene.add(crossbar2);
    
    return { frame, glass };
  }
  
  /**
   * Create a wooden sign with text
   * @param {Object} options - Sign options
   */
  createSign({ text, position }) {
    // Sign post
    const postGeometry = new THREE.BoxGeometry(0.2, 2.5, 0.2);
    const post = new THREE.Mesh(postGeometry, this.materials.wood.visual);
    post.position.set(position.x, position.y - 1.5, position.z);
    post.castShadow = true;
    post.receiveShadow = true;
    this.scene.add(post);
    
    // Sign board
    const boardGeometry = new THREE.BoxGeometry(1.8, 0.8, 0.1);
    const board = new THREE.Mesh(boardGeometry, this.materials.wood.visual);
    board.position.set(position.x, position.y, position.z);
    board.castShadow = true;
    board.receiveShadow = true;
    this.scene.add(board);
    
    // Add physics if available
    if (this.physicsManager) {
      this.addPhysicsBox(post, 0);
      this.addPhysicsBox(board, 0);
    }
    
    return { post, board };
  }
  
  /**
   * Create a well in the village
   * @param {Object} position - Position {x, z}
   */
  createWell(position) {
    // Well base (circular stone)
    const baseGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 16);
    const base = new THREE.Mesh(baseGeometry, this.materials.stone.visual);
    base.position.set(position.x, 0.25, position.z);
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);
    
    // Well wall (circular stone wall)
    const wallGeometry = new THREE.CylinderGeometry(1.2, 1.2, 1, 16, 1, true);
    const wall = new THREE.Mesh(wallGeometry, this.materials.stone.visual);
    wall.position.set(position.x, 1, position.z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.scene.add(wall);
    
    // Roof structure (two crossed beams)
    const beam1Geometry = new THREE.BoxGeometry(3, 0.2, 0.2);
    const beam1 = new THREE.Mesh(beam1Geometry, this.materials.wood.visual);
    beam1.position.set(position.x, 2.2, position.z);
    beam1.castShadow = true;
    beam1.receiveShadow = true;
    this.scene.add(beam1);
    
    const beam2Geometry = new THREE.BoxGeometry(0.2, 0.2, 3);
    const beam2 = new THREE.Mesh(beam2Geometry, this.materials.wood.visual);
    beam2.position.set(position.x, 2.2, position.z);
    beam2.castShadow = true;
    beam2.receiveShadow = true;
    this.scene.add(beam2);
    
    // Roof cone
    const roofGeometry = new THREE.ConeGeometry(1.8, 1, 16);
    const roof = new THREE.Mesh(roofGeometry, this.materials.thatch.visual);
    roof.position.set(position.x, 2.7, position.z);
    roof.castShadow = true;
    roof.receiveShadow = true;
    this.scene.add(roof);
    
    // Bucket and rope
    const bucketGeometry = new THREE.CylinderGeometry(0.3, 0.2, 0.4, 8);
    const bucket = new THREE.Mesh(bucketGeometry, this.materials.wood.visual);
    bucket.position.set(position.x, 1.7, position.z);
    bucket.castShadow = true;
    bucket.receiveShadow = true;
    this.scene.add(bucket);
    
    // Create rope (simple line)
    const ropeGeometry = new THREE.BoxGeometry(0.05, 0.5, 0.05);
    const rope = new THREE.Mesh(ropeGeometry, new THREE.MeshStandardMaterial({ color: 0x7a6a5a }));
    rope.position.set(position.x, 1.95, position.z);
    this.scene.add(rope);
    
    // Add physics if available
    if (this.physicsManager) {
      // Base
      const baseShape = new CANNON.Cylinder(1.5, 1.5, 0.5, 16);
      this.addPhysicsShape(base, baseShape, 0);
      
      // Wall (use a compound shape for the hollow cylinder)
      const wallShape = new CANNON.Cylinder(1.2, 1.2, 1, 16);
      const innerShape = new CANNON.Cylinder(1.0, 1.0, 1.1, 16);
      this.addPhysicsShapeWithHollow(wall, wallShape, innerShape, 0);
      
      // Beams
      this.addPhysicsBox(beam1, 0);
      this.addPhysicsBox(beam2, 0);
      
      // Roof
      const roofShape = new CANNON.Cylinder(0.2, 1.8, 1, 16);
      this.addPhysicsShape(roof, roofShape, 0);
      
      // Bucket (interactive physics object)
      const bucketShape = new CANNON.Cylinder(0.3, 0.2, 0.4, 8);
      this.addPhysicsShape(bucket, bucketShape, 0.5);
    }
    
    // Store well reference
    this.objects.set('well', { base, wall, roof });
  }
  
  /**
   * Create village walls
   */
  createVillageWalls() {
    const wallThickness = 1;
    const wallHeight = 5;
    const wallLength = 60;
    const wallOffset = 35;
    
    // Create four walls with gates
    this.createWallSegment({
      start: { x: -wallOffset, z: -wallOffset },
      end: { x: wallOffset, z: -wallOffset },
      height: wallHeight,
      thickness: wallThickness,
      withGate: true
    });
    
    this.createWallSegment({
      start: { x: -wallOffset, z: -wallOffset },
      end: { x: -wallOffset, z: wallOffset },
      height: wallHeight,
      thickness: wallThickness,
      withGate: true
    });
    
    this.createWallSegment({
      start: { x: wallOffset, z: -wallOffset },
      end: { x: wallOffset, z: wallOffset },
      height: wallHeight,
      thickness: wallThickness,
      withGate: false
    });
    
    this.createWallSegment({
      start: { x: -wallOffset, z: wallOffset },
      end: { x: wallOffset, z: wallOffset },
      height: wallHeight,
      thickness: wallThickness,
      withGate: false
    });
    
    // Create corner towers
    this.createTower({ x: -wallOffset, z: -wallOffset }, wallHeight + 2);
    this.createTower({ x: wallOffset, z: -wallOffset }, wallHeight + 2);
    this.createTower({ x: -wallOffset, z: wallOffset }, wallHeight + 2);
    this.createTower({ x: wallOffset, z: wallOffset }, wallHeight + 2);
  }
  
  /**
   * Create a wall segment with optional gate
   * @param {Object} options - Wall options
   */
  createWallSegment({ start, end, height, thickness, withGate }) {
    // Calculate wall vector and length
    const wallVector = {
      x: end.x - start.x,
      z: end.z - start.z
    };
    const wallLength = Math.sqrt(wallVector.x * wallVector.x + wallVector.z * wallVector.z);
    
    // If we need a gate, create two wall segments
    if (withGate) {
      const gateWidth = 6;
      const gatePosition = 0.5; // 0 to 1, percentage along the wall
      
      // Calculate gate center position
      const gateCenter = {
        x: start.x + wallVector.x * gatePosition,
        z: start.z + wallVector.z * gatePosition
      };
      
      // Calculate normalized direction vector
      const direction = {
        x: wallVector.x / wallLength,
        z: wallVector.z / wallLength
      };
      
      // Create wall segments on either side of the gate
      this.createWallSegmentGeometry({
        start: start,
        end: {
          x: gateCenter.x - direction.x * gateWidth / 2,
          z: gateCenter.z - direction.z * gateWidth / 2
        },
        height,
        thickness
      });
      
      this.createWallSegmentGeometry({
        start: {
          x: gateCenter.x + direction.x * gateWidth / 2,
          z: gateCenter.z + direction.z * gateWidth / 2
        },
        end: end,
        height,
        thickness
      });
      
      // Create gate arch
      this.createGateArch({
        position: gateCenter,
        width: gateWidth,
        height: height,
        depth: thickness,
        rotation: Math.atan2(direction.z, direction.x) + Math.PI/2
      });
    } else {
      // Create a single wall segment
      this.createWallSegmentGeometry({
        start,
        end,
        height,
        thickness
      });
    }
  }
  
  /**
   * Create the geometry for a wall segment
   * @param {Object} options - Wall geometry options
   */
  createWallSegmentGeometry({ start, end, height, thickness }) {
    // Calculate wall vector and length
    const wallVector = {
      x: end.x - start.x,
      z: end.z - start.z
    };
    const wallLength = Math.sqrt(wallVector.x * wallVector.x + wallVector.z * wallVector.z);
    
    // Create wall geometry
    const wallGeometry = new THREE.BoxGeometry(wallLength, height, thickness);
    const wallMaterial = this.materials.stone.visual;
    const wall = new THREE.Mesh(wallGeometry, wallMaterial);
    
    // Position at midpoint
    wall.position.set(
      start.x + wallVector.x/2,
      height/2,
      start.z + wallVector.z/2
    );
    
    // Rotate to align with direction
    const angle = Math.atan2(wallVector.z, wallVector.x);
    wall.rotation.y = angle;
    
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.scene.add(wall);
    
    // Add physics
    if (this.physicsManager) {
      const rotation = new CANNON.Quaternion();
      rotation.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), angle);
      
      const shape = new CANNON.Box(new CANNON.Vec3(wallLength/2, height/2, thickness/2));
      const body = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(wall.position.x, wall.position.y, wall.position.z),
        shape: shape,
        quaternion: rotation
      });
      
      this.physicsManager.world.addBody(body);
      
      // Store reference to physics body
      this.objects.set(`wall_${start.x}_${start.z}_${end.x}_${end.z}`, { mesh: wall, body });
    }
    
    return wall;
  }
  
  /**
   * Create a tower at a corner
   * @param {Object} position - Tower position
   * @param {number} height - Tower height
   */
  createTower(position, height) {
    // Base tower
    const towerRadius = 3;
    const towerGeometry = new THREE.CylinderGeometry(towerRadius, towerRadius, height, 16);
    const towerMaterial = this.materials.stone.visual;
    const tower = new THREE.Mesh(towerGeometry, towerMaterial);
    tower.position.set(position.x, height/2, position.z);
    tower.castShadow = true;
    tower.receiveShadow = true;
    this.scene.add(tower);
    
    // Add tower roof
    const roofGeometry = new THREE.ConeGeometry(towerRadius + 0.5, 3, 16);
    const roofMaterial = this.materials.thatch.visual;
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.set(position.x, height + 1.5, position.z);
    roof.castShadow = true;
    roof.receiveShadow = true;
    this.scene.add(roof);
    
    // Add physics
    if (this.physicsManager) {
      // Tower cylinder
      const towerShape = new CANNON.Cylinder(towerRadius, towerRadius, height, 16);
      const towerBody = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(position.x, height/2, position.z),
        shape: towerShape
      });
      this.physicsManager.world.addBody(towerBody);
      
      // Roof cone
      const roofShape = new CANNON.Cylinder(0.5, towerRadius + 0.5, 3, 16);
      const roofBody = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(position.x, height + 1.5, position.z),
        shape: roofShape
      });
      this.physicsManager.world.addBody(roofBody);
      
      // Store reference
      this.objects.set(`tower_${position.x}_${position.z}`, { 
        mesh: tower, 
        body: towerBody 
      });
    }
    
    return { tower, roof };
  }
  
  /**
   * Create a gate arch
   * @param {Object} options - Gate options
   */
  createGateArch({ position, width, height, depth, rotation }) {
    // Create the main gate structure
    const gateWidth = width;
    const gateHeight = height * 0.7;
    
    // Left pillar
    const pillarGeometry = new THREE.BoxGeometry(depth, height, depth);
    const leftPillar = new THREE.Mesh(pillarGeometry, this.materials.stone.visual);
    leftPillar.position.set(
      position.x + Math.sin(rotation) * gateWidth/2,
      height/2,
      position.z + Math.cos(rotation) * gateWidth/2
    );
    leftPillar.castShadow = true;
    leftPillar.receiveShadow = true;
    this.scene.add(leftPillar);
    
    // Right pillar
    const rightPillar = new THREE.Mesh(pillarGeometry, this.materials.stone.visual);
    rightPillar.position.set(
      position.x - Math.sin(rotation) * gateWidth/2,
      height/2,
      position.z - Math.cos(rotation) * gateWidth/2
    );
    rightPillar.castShadow = true;
    rightPillar.receiveShadow = true;
    this.scene.add(rightPillar);
    
    // Top arch
    const archGeometry = new THREE.BoxGeometry(gateWidth, height - gateHeight, depth);
    const arch = new THREE.Mesh(archGeometry, this.materials.stone.visual);
    arch.position.set(
      position.x,
      height - (height - gateHeight)/2,
      position.z
    );
    arch.rotation.y = rotation;
    arch.castShadow = true;
    arch.receiveShadow = true;
    this.scene.add(arch);
    
    // Add physics
    if (this.physicsManager) {
      // Left pillar
      const leftPillarShape = new CANNON.Box(new CANNON.Vec3(depth/2, height/2, depth/2));
      const leftPillarBody = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(leftPillar.position.x, leftPillar.position.y, leftPillar.position.z),
        shape: leftPillarShape
      });
      this.physicsManager.world.addBody(leftPillarBody);
      
      // Right pillar
      const rightPillarShape = new CANNON.Box(new CANNON.Vec3(depth/2, height/2, depth/2));
      const rightPillarBody = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(rightPillar.position.x, rightPillar.position.y, rightPillar.position.z),
        shape: rightPillarShape
      });
      this.physicsManager.world.addBody(rightPillarBody);
      
      // Top arch
      const rotationQuaternion = new CANNON.Quaternion();
      rotationQuaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotation);
      
      const archShape = new CANNON.Box(new CANNON.Vec3(gateWidth/2, (height - gateHeight)/2, depth/2));
      const archBody = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(arch.position.x, arch.position.y, arch.position.z),
        shape: archShape,
        quaternion: rotationQuaternion
      });
      this.physicsManager.world.addBody(archBody);
    }
    
    return { leftPillar, rightPillar, arch };
  }
  
  /**
   * Create decorative elements around the village
   */
  createDecorations() {
    // Create barrels
    this.createBarrels({ x: 13, z: 12 }, 5);
    this.createBarrels({ x: -13, z: 13 }, 3);
    
    // Create haystacks
    this.createHaystack({ x: -8, z: -14 });
    this.createHaystack({ x: 10, z: -10 });
    
    // Create trees outside the village
    this.createTrees();
    
    // Create market stalls
    this.createMarketStall({ x: 5, z: -5 });
    this.createMarketStall({ x: -5, z: -7 });
    
    // Create benches
    this.createBench({ x: 3, z: 3 }, Math.PI / 4);
    this.createBench({ x: -3, z: 3 }, -Math.PI / 4);
  }
  
  /**
   * Create barrels
   * @param {Object} position - Position
   * @param {number} count - Number of barrels
   */
  createBarrels(position, count) {
    for (let i = 0; i < count; i++) {
      // Randomize position slightly
      const offsetX = (Math.random() - 0.5) * 3;
      const offsetZ = (Math.random() - 0.5) * 3;
      
      // Create barrel
      const barrelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
      const barrel = new THREE.Mesh(barrelGeometry, this.materials.wood.visual);
      
      // Random rotation and position
      const rotation = Math.random() * Math.PI;
      let finalPosX = position.x + offsetX;
      let finalPosZ = position.z + offsetZ;
      
      // Vertical or horizontal barrel
      let finalPosY = 0.5;
      if (Math.random() > 0.7) {
        // Horizontal barrel
        barrel.rotation.x = Math.PI / 2;
        barrel.rotation.z = rotation;
        finalPosY = 0.5;
      } else {
        // Vertical barrel
        barrel.rotation.y = rotation;
      }
      
      barrel.position.set(finalPosX, finalPosY, finalPosZ);
      barrel.castShadow = true;
      barrel.receiveShadow = true;
      this.scene.add(barrel);
      
      // Add physics
      if (this.physicsManager) {
        // Use fixed mass for barrels to make them interactive
        const mass = 5;
        
        if (barrel.rotation.x === Math.PI / 2) {
          // Horizontal barrel
          const shape = new CANNON.Cylinder(0.5, 0.5, 1, 12);
          const quat = new CANNON.Quaternion();
          quat.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), Math.PI / 2);
          
          const body = new CANNON.Body({
            mass: mass,
            position: new CANNON.Vec3(barrel.position.x, barrel.position.y, barrel.position.z),
            shape: shape,
            quaternion: quat
          });
          
          body.material = new CANNON.Material();
          body.material.friction = this.materials.wood.physics.friction;
          body.material.restitution = this.materials.wood.physics.restitution;
          
          this.physicsManager.world.addBody(body);
          
          // Store in physics manager Map for tracking
          const id = `barrel_${position.x}_${position.z}_${i}`;
          this.physicsManager.physicsBodies.set(id, {
            body: body,
            mesh: barrel,
            properties: {
              size: { x: 1, y: 0.5, z: 0.5 },
              mass: mass,
              color: 0x8B4513,
              shape: 'cylinder',
              metallic: false,
              restitution: this.materials.wood.physics.restitution,
              friction: this.materials.wood.physics.friction
            }
          });
        } else {
          // Vertical barrel
          const shape = new CANNON.Cylinder(0.5, 0.5, 1, 12);
          
          const body = new CANNON.Body({
            mass: mass,
            position: new CANNON.Vec3(barrel.position.x, barrel.position.y, barrel.position.z),
            shape: shape
          });
          
          body.material = new CANNON.Material();
          body.material.friction = this.materials.wood.physics.friction;
          body.material.restitution = this.materials.wood.physics.restitution;
          
          this.physicsManager.world.addBody(body);
          
          // Store in physics manager Map for tracking
          const id = `barrel_${position.x}_${position.z}_${i}`;
          this.physicsManager.physicsBodies.set(id, {
            body: body,
            mesh: barrel,
            properties: {
              size: { x: 0.5, y: 1, z: 0.5 },
              mass: mass,
              color: 0x8B4513,
              shape: 'cylinder',
              metallic: false,
              restitution: this.materials.wood.physics.restitution,
              friction: this.materials.wood.physics.friction
            }
          });
        }
      }
    }
  }
  
  /**
   * Create a haystack
   * @param {Object} position - Position
   */
  createHaystack(position) {
    // Create haystack (stack of cylinders)
    const baseGeometry = new THREE.CylinderGeometry(1.5, 2, 1, 16);
    const base = new THREE.Mesh(baseGeometry, this.materials.thatch.visual);
    base.position.set(position.x, 0.5, position.z);
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);
    
    const midGeometry = new THREE.CylinderGeometry(1, 1.5, 0.8, 16);
    const mid = new THREE.Mesh(midGeometry, this.materials.thatch.visual);
    mid.position.set(position.x, 1.4, position.z);
    mid.castShadow = true;
    mid.receiveShadow = true;
    this.scene.add(mid);
    
    const topGeometry = new THREE.CylinderGeometry(0.5, 1, 0.7, 16);
    const top = new THREE.Mesh(topGeometry, this.materials.thatch.visual);
    top.position.set(position.x, 2.15, position.z);
    top.castShadow = true;
    top.receiveShadow = true;
    this.scene.add(top);
    
    // Add physics
    if (this.physicsManager) {
      // Use simplified collision (one cylinder)
      const haystackShape = new CANNON.Cylinder(1.5, 2, 2.5, 16);
      const haystackBody = new CANNON.Body({
        mass: 0, // Static
        position: new CANNON.Vec3(position.x, 1.25, position.z),
        shape: haystackShape
      });
      
      haystackBody.material = new CANNON.Material();
      haystackBody.material.friction = this.materials.thatch.physics.friction;
      haystackBody.material.restitution = this.materials.thatch.physics.restitution;
      
      this.physicsManager.world.addBody(haystackBody);
    }
  }
  
  /**
   * Create trees around the village
   */
  createTrees() {
    const treePositions = [
      { x: -25, z: -25 },
      { x: -22, z: 20 },
      { x: 22, z: -18 },
      { x: 28, z: 25 },
      { x: -15, z: -30 },
      { x: 30, z: 0 },
      { x: -35, z: -5 },
      { x: 18, z: 30 }
    ];
    
    treePositions.forEach(pos => {
      // Randomize position slightly
      const offsetX = (Math.random() - 0.5) * 5;
      const offsetZ = (Math.random() - 0.5) * 5;
      
      this.createTree({
        x: pos.x + offsetX,
        z: pos.z + offsetZ
      });
    });
  }
  
  /**
   * Create a tree
   * @param {Object} position - Position
   */
  createTree(position) {
    // Create trunk
    const trunkHeight = 3 + Math.random() * 2;
    const trunkGeometry = new THREE.CylinderGeometry(0.4, 0.5, trunkHeight, 8);
    const trunkMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 1.0,
      metalness: 0.0
    });
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.set(position.x, trunkHeight/2, position.z);
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    this.scene.add(trunk);
    
    // Create foliage (multiple layers of cones)
    const foliageColor = 0x2d4c1e;
    const foliageLayers = 2 + Math.floor(Math.random() * 3);
    const foliageHeight = 5;
    const layerHeight = foliageHeight / foliageLayers;
    
    for (let i = 0; i < foliageLayers; i++) {
      const radius = 1.8 - (i * 0.3);
      const geometryFoliage = new THREE.ConeGeometry(radius, layerHeight, 8);
      const materialFoliage = new THREE.MeshStandardMaterial({
        color: foliageColor,
        roughness: 0.8,
        metalness: 0.0
      });
      const foliage = new THREE.Mesh(geometryFoliage, materialFoliage);
      
      // Position each layer
      const layerY = trunkHeight - 0.5 + (i * layerHeight) + layerHeight/2;
      foliage.position.set(position.x, layerY, position.z);
      foliage.castShadow = true;
      foliage.receiveShadow = true;
      this.scene.add(foliage);
    }
    
    // Add physics if available
    if (this.physicsManager) {
      // Create trunk physics
      const trunkShape = new CANNON.Cylinder(0.4, 0.5, trunkHeight, 8);
      const trunkBody = new CANNON.Body({
        mass: 0, // Static
        position: new CANNON.Vec3(position.x, trunkHeight/2, position.z),
        shape: trunkShape
      });
      this.physicsManager.world.addBody(trunkBody);
      
      // Create simplified foliage physics (one cone for collision)
      const foliageShape = new CANNON.Cylinder(0.2, 1.8, foliageHeight, 8);
      const foliageBody = new CANNON.Body({
        mass: 0, // Static
        position: new CANNON.Vec3(position.x, trunkHeight + foliageHeight/2, position.z),
        shape: foliageShape
      });
      this.physicsManager.world.addBody(foliageBody);
    }
  }
  
  /**
   * Create a market stall
   * @param {Object} position - Position
   */
  createMarketStall(position) {
    // Create base platform
    const baseGeometry = new THREE.BoxGeometry(3, 0.2, 2);
    const base = new THREE.Mesh(baseGeometry, this.materials.wood.visual);
    base.position.set(position.x, 0.1, position.z);
    base.castShadow = true;
    base.receiveShadow = true;
    this.scene.add(base);
    
    // Create posts at corners
    const postGeometry = new THREE.BoxGeometry(0.2, 2, 0.2);
    const posts = [];
    
    for (let x = -1; x <= 1; x += 2) {
      for (let z = -1; z <= 1; z += 2) {
        const post = new THREE.Mesh(postGeometry, this.materials.wood.visual);
        post.position.set(
          position.x + x * 1.4,
          1,
          position.z + z * 0.9
        );
        post.castShadow = true;
        post.receiveShadow = true;
        this.scene.add(post);
        posts.push(post);
      }
    }
    
    // Create roof
    const roofGeometry = new THREE.BoxGeometry(3.6, 0.2, 2.6);
    const roof = new THREE.Mesh(roofGeometry, this.materials.thatch.visual);
    roof.position.set(position.x, 2.1, position.z);
    roof.castShadow = true;
    roof.receiveShadow = true;
    this.scene.add(roof);
    
    // Create counter
    const counterGeometry = new THREE.BoxGeometry(2.8, 0.4, 0.8);
    const counter = new THREE.Mesh(counterGeometry, this.materials.wood.visual);
    counter.position.set(position.x, 0.7, position.z + 0.5);
    counter.castShadow = true;
    counter.receiveShadow = true;
    this.scene.add(counter);
    
    // Add a random item on the counter
    if (Math.random() > 0.5) {
      // Create a basket
      const basketGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.3, 8);
      const basket = new THREE.Mesh(basketGeometry, this.materials.thatch.visual);
      basket.position.set(position.x + 0.7, 1, position.z + 0.5);
      basket.castShadow = true;
      basket.receiveShadow = true;
      this.scene.add(basket);
    } else {
      // Create a box/crate
      const crateGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.4);
      const crate = new THREE.Mesh(crateGeometry, this.materials.wood.visual);
      crate.position.set(position.x - 0.7, 1, position.z + 0.5);
      crate.castShadow = true;
      crate.receiveShadow = true;
      this.scene.add(crate);
    }
    
    // Add physics if available
    if (this.physicsManager) {
      // Base platform
      this.addPhysicsBox(base, 0);
      
      // Posts
      posts.forEach(post => {
        this.addPhysicsBox(post, 0);
      });
      
      // Roof
      this.addPhysicsBox(roof, 0);
      
      // Counter
      this.addPhysicsBox(counter, 0);
    }
  }
  
  /**
   * Create a wooden bench
   * @param {Object} position - Position
   * @param {number} rotation - Rotation
   */
  createBench(position, rotation) {
    // Create seat
    const seatGeometry = new THREE.BoxGeometry(1.8, 0.1, 0.6);
    const seat = new THREE.Mesh(seatGeometry, this.materials.wood.visual);
    seat.position.set(position.x, 0.4, position.z);
    seat.rotation.y = rotation;
    seat.castShadow = true;
    seat.receiveShadow = true;
    this.scene.add(seat);
    
    // Create legs
    const legGeometry = new THREE.BoxGeometry(0.1, 0.4, 0.1);
    
    for (let x = -1; x <= 1; x += 2) {
      for (let z = -1; z <= 1; z += 2) {
        // Calculate offset based on rotation
        const offsetX = x * 0.8;
        const offsetZ = z * 0.25;
        
        // Apply rotation to offset
        const rotatedOffsetX = offsetX * Math.cos(rotation) - offsetZ * Math.sin(rotation);
        const rotatedOffsetZ = offsetX * Math.sin(rotation) + offsetZ * Math.cos(rotation);
        
        const leg = new THREE.Mesh(legGeometry, this.materials.wood.visual);
        leg.position.set(
          position.x + rotatedOffsetX,
          0.2,
          position.z + rotatedOffsetZ
        );
        leg.castShadow = true;
        leg.receiveShadow = true;
        this.scene.add(leg);
      }
    }
    
    // Create backrest (only for two legs)
    const backrestGeometry = new THREE.BoxGeometry(1.8, 0.6, 0.1);
    const backrest = new THREE.Mesh(backrestGeometry, this.materials.wood.visual);
    
    // Position based on rotation
    const backOffsetZ = 0.25;
    const rotatedBackOffsetX = -backOffsetZ * Math.sin(rotation);
    const rotatedBackOffsetZ = backOffsetZ * Math.cos(rotation);
    
    backrest.position.set(
      position.x + rotatedBackOffsetX,
      0.75,
      position.z + rotatedBackOffsetZ
    );
    backrest.rotation.y = rotation;
    backrest.castShadow = true;
    backrest.receiveShadow = true;
    this.scene.add(backrest);
    
    // Add physics if available
    if (this.physicsManager) {
      // Create a compound body for the bench
      // For simplicity we'll use a single box for collision
      const rotationQuat = new CANNON.Quaternion();
      rotationQuat.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotation);
      
      const benchShape = new CANNON.Box(new CANNON.Vec3(0.9, 0.4, 0.3));
      const benchBody = new CANNON.Body({
        mass: 0, // Static
        position: new CANNON.Vec3(position.x, 0.4, position.z),
        quaternion: rotationQuat
      });
      benchBody.addShape(benchShape);
      
      benchBody.material = new CANNON.Material();
      benchBody.material.friction = this.materials.wood.physics.friction;
      benchBody.material.restitution = this.materials.wood.physics.restitution;
      
      this.physicsManager.world.addBody(benchBody);
    }
  }
  
  /**
   * Define spawn points for multiplayer
   */
  defineSpawnPoints() {
    // Clear any existing spawn points
    this.spawnPoints = [];
    
    // Add spawn points around the village square
    this.spawnPoints.push({ x: 2, y: 0, z: 2, rotation: Math.PI / 4 });
    this.spawnPoints.push({ x: -2, y: 0, z: 2, rotation: -Math.PI / 4 });
    this.spawnPoints.push({ x: 2, y: 0, z: -2, rotation: 3 * Math.PI / 4 });
    this.spawnPoints.push({ x: -2, y: 0, z: -2, rotation: -3 * Math.PI / 4 });
    
    // Add spawn points near buildings
    this.spawnPoints.push({ x: 12, y: 0, z: 12, rotation: -3 * Math.PI / 4 });
    this.spawnPoints.push({ x: -12, y: 0, z: 12, rotation: -Math.PI / 4 });
    this.spawnPoints.push({ x: -10, y: 0, z: -8, rotation: Math.PI / 4 });
    this.spawnPoints.push({ x: 10, y: 0, z: -10, rotation: 3 * Math.PI / 4 });
  }
  
  /**
   * Get a random spawn point
   * @returns {Object} Spawn point {x, y, z, rotation}
   */
  getRandomSpawnPoint() {
    if (this.spawnPoints.length === 0) {
      // Default spawn if no points defined
      return { x: 0, y: 0, z: 0, rotation: 0 };
    }
    
    const index = Math.floor(Math.random() * this.spawnPoints.length);
    return this.spawnPoints[index];
  }
  
  /**
   * Add physics box to object
   * @param {THREE.Mesh} mesh - Visual mesh
   * @param {number} mass - Physics mass (0 for static)
   */
  addPhysicsBox(mesh, mass) {
    if (!this.physicsManager) return;
    
    // Get dimensions from mesh geometry
    const size = new THREE.Vector3();
    mesh.geometry.computeBoundingBox();
    mesh.geometry.boundingBox.getSize(size);
    
    // Create physics shape
    const shape = new CANNON.Box(new CANNON.Vec3(size.x/2, size.y/2, size.z/2));
    
    // Create body
    const body = new CANNON.Body({
      mass: mass,
      position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
      quaternion: new CANNON.Quaternion().setFromEuler(
        mesh.rotation.x,
        mesh.rotation.y, 
        mesh.rotation.z
      )
    });
    body.addShape(shape);
    
    // Add to physics world
    this.physicsManager.world.addBody(body);
    
    // If this is an interactive object (non-zero mass), add to physicsBodies map
    if (mass > 0) {
      const id = `physics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      this.physicsManager.physicsBodies.set(id, {
        body: body,
        mesh: mesh,
        properties: {
          size: { x: size.x, y: size.y, z: size.z },
          mass: mass,
          color: mesh.material.color.getHex(),
          shape: 'box',
          metallic: false,
          restitution: 0.3,
          friction: 0.5
        }
      });
    }
  }
  
  /**
   * Add a custom physics shape to object
   * @param {THREE.Mesh} mesh - Visual mesh
   * @param {CANNON.Shape} shape - Physics shape
   * @param {number} mass - Physics mass (0 for static)
   */
  addPhysicsShape(mesh, shape, mass) {
    if (!this.physicsManager) return;
    
    // Create body
    const body = new CANNON.Body({
      mass: mass,
      position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z),
      quaternion: new CANNON.Quaternion().setFromEuler(
        mesh.rotation.x,
        mesh.rotation.y, 
        mesh.rotation.z
      )
    });
    body.addShape(shape);
    
    // Add to physics world
    this.physicsManager.world.addBody(body);
    
    // If this is an interactive object (non-zero mass), add to physicsBodies map
    if (mass > 0) {
      const id = `physics_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get bounding box for size estimate
      const size = new THREE.Vector3();
      mesh.geometry.computeBoundingBox();
      mesh.geometry.boundingBox.getSize(size);
      
      this.physicsManager.physicsBodies.set(id, {
        body: body,
        mesh: mesh,
        properties: {
          size: { x: size.x, y: size.y, z: size.z },
          mass: mass,
          color: mesh.material.color.getHex(),
          shape: shape instanceof CANNON.Cylinder ? 'cylinder' : 'box',
          metallic: false,
          restitution: 0.3,
          friction: 0.5
        }
      });
    }
  }
  
  /**
   * Add a hollow physics shape (like a cylinder with a hole)
   * @param {THREE.Mesh} mesh - Visual mesh
   * @param {CANNON.Shape} outerShape - Outer physics shape
   * @param {CANNON.Shape} innerShape - Inner physics shape to subtract
   * @param {number} mass - Physics mass (0 for static)
   */
  addPhysicsShapeWithHollow(mesh, outerShape, innerShape, mass) {
    if (!this.physicsManager) return;
    
    // For static bodies, we can use multiple shapes to create a hollow effect
    // For simplicity we're using separate shapes for walls
    
    // Create body
    const body = new CANNON.Body({
      mass: mass,
      position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z)
    });
    
    // Add the outer shape
    body.addShape(outerShape);
    
    // Add the inner shape as a separate body for simplicity
    if (innerShape) {
      const innerBody = new CANNON.Body({
        mass: 0,
        position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z)
      });
      innerBody.addShape(innerShape);
      innerBody.collisionResponse = false; // Don't respond to collisions
      this.physicsManager.world.addBody(innerBody);
    }
    
    // Add to physics world
    this.physicsManager.world.addBody(body);
  }
  
  /**
   * Create hollow building physics using walls instead of a single box
   * @param {THREE.Mesh} mesh - Building mesh
   * @param {number} width - Building width
   * @param {number} height - Building height
   * @param {number} depth - Building depth
   * @param {number} rotation - Building rotation
   */
  createHollowBuildingPhysics(mesh, width, height, depth, rotation = 0) {
    if (!this.physicsManager) return;
    
    const halfWidth = width / 2;
    const halfDepth = depth / 2;
    const wallThickness = 0.3; // Wall thickness
    
    // Create a body for the building
    const buildingBody = new CANNON.Body({
      mass: 0, // Static
      position: new CANNON.Vec3(mesh.position.x, mesh.position.y, mesh.position.z)
    });
    
    // Apply rotation if specified
    if (rotation !== 0) {
      const q = new CANNON.Quaternion();
      q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotation);
      buildingBody.quaternion.copy(q);
    }
    
    // Front wall
    const frontWall = new CANNON.Box(new CANNON.Vec3(halfWidth, height/2, wallThickness/2));
    buildingBody.addShape(frontWall, new CANNON.Vec3(0, 0, halfDepth - wallThickness/2));
    
    // Back wall
    const backWall = new CANNON.Box(new CANNON.Vec3(halfWidth, height/2, wallThickness/2));
    buildingBody.addShape(backWall, new CANNON.Vec3(0, 0, -halfDepth + wallThickness/2));
    
    // Left wall
    const leftWall = new CANNON.Box(new CANNON.Vec3(wallThickness/2, height/2, halfDepth - wallThickness));
    buildingBody.addShape(leftWall, new CANNON.Vec3(-halfWidth + wallThickness/2, 0, 0));
    
    // Right wall
    const rightWall = new CANNON.Box(new CANNON.Vec3(wallThickness/2, height/2, halfDepth - wallThickness));
    buildingBody.addShape(rightWall, new CANNON.Vec3(halfWidth - wallThickness/2, 0, 0));
    
    // Add to physics world
    this.physicsManager.world.addBody(buildingBody);
  }
}
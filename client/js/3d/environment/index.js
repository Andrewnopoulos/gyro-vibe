import * as THREE from 'three';
import * as CANNON from 'cannon-es';

// Import all environment components
import { createMaterials } from './materials.js';
import { createSkybox } from './skybox.js';
import { TerrainBuilder } from './terrain.js';
import { PhysicsUtils } from './physics/physics-utils.js';

// Buildings
import { Tavern } from './buildings/tavern.js';
import { Blacksmith } from './buildings/blacksmith.js';
import { Houses } from './buildings/houses.js';

// Structures
import { VillageSquare } from './structures/village-square.js';
import { VillageWalls } from './structures/walls.js';
import { Towers } from './structures/towers.js';

// Decorations
import { Well } from './decorations/well.js';
import { Trees } from './decorations/trees.js';
import { Furniture } from './decorations/furniture.js';
import { MarketStalls } from './decorations/market-stalls.js';

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
    this.materials = createMaterials();
    
    // Create physics utilities
    this.physicsUtils = new PhysicsUtils(physicsManager, this.materials);
    
    // Initialize environment
    this.createSkybox();
    this.createTerrain();
    this.createVillage();
    
    // Add atmospheric fog
    this.scene.fog = new THREE.FogExp2(0xd6cca1, 0.02);
  }

  /**
   * Create skybox for the environment
   */
  createSkybox() {
    const skybox = createSkybox(this.scene);
    this.objects.set('skybox', skybox);
  }

  /**
   * Create terrain with proper physics
   */
  createTerrain() {
    const terrainBuilder = new TerrainBuilder(
      this.scene, 
      this.materials, 
      this.physicsUtils,
      this.objects
    );
    terrainBuilder.createTerrain();
  }

  /**
   * Create the full medieval village
   */
  createVillage() {
    // Create central village square
    const villageSquare = new VillageSquare(
      this.scene, 
      this.materials, 
      this.physicsUtils
    );
    villageSquare.create();
    
    // Create various buildings
    const tavern = new Tavern(
      this.scene, 
      this.materials, 
      this.physicsUtils, 
      this.objects
    );
    tavern.create({ x: 15, z: 15 });
    
    const blacksmith = new Blacksmith(
      this.scene, 
      this.materials, 
      this.physicsUtils, 
      this.objects
    );
    blacksmith.create({ x: -15, z: 15 });
    
    const houses = new Houses(
      this.scene, 
      this.materials, 
      this.physicsUtils, 
      this.objects
    );
    houses.create();
    
    // Create village walls
    const walls = new VillageWalls(
      this.scene, 
      this.materials, 
      this.physicsUtils, 
      this.objects
    );
    walls.create();
    
    // Create towers at the corners
    const towers = new Towers(
      this.scene, 
      this.materials, 
      this.physicsUtils, 
      this.objects
    );
    
    const wallHeight = 5;
    const wallOffset = 35;
    
    towers.create({ x: -wallOffset, z: -wallOffset }, wallHeight + 2);
    towers.create({ x: wallOffset, z: -wallOffset }, wallHeight + 2);
    towers.create({ x: -wallOffset, z: wallOffset }, wallHeight + 2);
    towers.create({ x: wallOffset, z: wallOffset }, wallHeight + 2);
    
    // Create decorative elements
    this.createDecorations();
    
    // Define spawn points for multiplayer
    this.defineSpawnPoints();
  }

  /**
   * Create decorative elements for the village
   */
  createDecorations() {
    // Create well
    const well = new Well(
      this.scene, 
      this.materials, 
      this.physicsUtils, 
      this.objects
    );
    well.create({ x: 0, z: 0 });
    
    // Create trees
    const trees = new Trees(
      this.scene, 
      this.materials, 
      this.physicsUtils
    );
    trees.create();
    
    // Create furniture (benches, haystacks)
    const furniture = new Furniture(
      this.scene, 
      this.materials, 
      this.physicsUtils
    );
    
    // Add benches around the village
    furniture.createBench({ x: 5, z: 5 }, Math.PI / 4);
    furniture.createBench({ x: -5, z: 5 }, -Math.PI / 4);
    furniture.createBench({ x: 0, z: 8 }, 0);
    
    // Add haystacks
    furniture.createHaystack({ x: -12, z: -5 });
    furniture.createHaystack({ x: 18, z: 8 });
    
    // Create market stalls
    const marketStalls = new MarketStalls(
      this.scene, 
      this.materials, 
      this.physicsUtils
    );
    
    // Add market stalls near the village square
    marketStalls.createMarketStall({ x: 5, z: -5 });
    marketStalls.createMarketStall({ x: -5, z: -7 });
    marketStalls.createMarketStall({ x: 7, z: 2 });
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
}
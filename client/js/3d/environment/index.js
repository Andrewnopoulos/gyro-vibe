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
   * @param {EventBus} eventBus - Application event bus
   * @param {THREE.LoadingManager} loadingManager - Loading manager for tracking assets
   */
  constructor(scene, physicsManager = null, eventBus = null, loadingManager = null) {
    this.scene = scene;
    this.physicsManager = physicsManager;
    this.eventBus = eventBus;
    this.loadingManager = loadingManager;
    this.objects = new Map(); // Store references to environment objects
    this.spawnPoints = []; // Player spawn locations
    this.villageLoaded = false;
    this.decorationsLoaded = false;
    
    // Define material properties for different surface types
    this.materials = createMaterials();
    
    // Create physics utilities with event bus for lazy loading
    this.physicsUtils = new PhysicsUtils(physicsManager, this.materials, this.eventBus);
    
    // Initialize essential parts immediately
    this.createSkybox();
    this.createTerrain();
    
    // Add atmospheric fog
    this.scene.fog = new THREE.FogExp2(0xd6cca1, 0.02);
    
    // Set up event handlers
    this.setupEventListeners();
    
    // Define default spawn points until the real ones are loaded
    this.defineDefaultSpawnPoints();
    
    // Lazy load the village after a short delay
    setTimeout(() => this.lazyLoadVillage(), 500);
  }
  
  /**
   * Set up event listeners for physics debug and other functionality
   */
  setupEventListeners() {
    if (this.eventBus) {
      // Listen for physics utils requests from other components
      this.eventBus.on('physics:request-utils', (callback) => {
        if (typeof callback === 'function') {
          callback(this.physicsUtils);
        }
      });
      
      // Listen for update events to update debug wireframes
      this.eventBus.on('scene:update', this.update.bind(this));
      
      // Listen for environment reset requests when leaving multiplayer
      this.eventBus.on('environment:reset', this.resetEnvironment.bind(this));
    }
  }
  
  /**
   * Reset environment when leaving multiplayer
   * Recreates walls, well and other key structures
   */
  resetEnvironment() {
    console.log('Resetting environment after leaving multiplayer...');
    
    // Reset flags to allow reloading
    this.villageLoaded = false;
    this.decorationsLoaded = false;
    
    // Remove existing objects from scene that need to be recreated
    this.removeSceneObjects();
    
    // Clear objects map
    this.objects.clear();
    
    // Recreate skybox and terrain
    this.createSkybox();
    this.createTerrain();
    
    // Reload village and decorations
    this.lazyLoadVillage();
    
    // No need to call lazyLoadDecorations() here as it will be called by lazyLoadVillage()
  }
  
  /**
   * Remove objects from the scene that need to be recreated
   */
  removeSceneObjects() {
    if (!this.scene) return;
    
    // Use array to avoid modifying during iteration
    const objectsToRemove = [];
    
    // Find all village walls, well parts, and other objects to remove
    this.scene.traverse((object) => {
      if (object.userData) {
        if (object.userData.isVillageWall || 
            object.userData.isWallCrenel || 
            object.userData.isWellBase ||
            object.userData.isWellWall) {
          objectsToRemove.push(object);
        }
      }
    });
    
    // Remove objects from scene
    for (const object of objectsToRemove) {
      if (object.parent) {
        object.parent.remove(object);
      }
      
      // Dispose of geometries and materials to avoid memory leaks
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
          object.material.forEach(material => material.dispose());
        } else {
          object.material.dispose();
        }
      }
    }
    
    console.log(`Removed ${objectsToRemove.length} objects from scene`);
  }
  
  /**
   * Update environment on each frame
   * @param {Object} data - Update data with delta time
   */
  update(data) {
    const { delta } = data;
    
    // Update physics debug wireframes if needed
    if (this.physicsUtils && this.physicsUtils.debugMode) {
      this.physicsUtils.updateDebugWireframes();
    }
  }
  
  /**
   * Lazy load the village buildings and walls
   */
  lazyLoadVillage() {
    if (this.villageLoaded) return;
    console.log('Lazy loading village buildings...');
    
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
    
    this.villageLoaded = true;
    
    // Update spawn points now that the village is loaded
    this.defineSpawnPoints();
    
    // Schedule decorations to load after another delay
    setTimeout(() => this.lazyLoadDecorations(), 500);
  }
  
  /**
   * Lazy load the decorative elements
   */
  lazyLoadDecorations() {
    if (this.decorationsLoaded) return;
    console.log('Lazy loading decorative elements...');
    
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
    
    this.decorationsLoaded = true;
    console.log('Environment fully loaded');
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

  // The createVillage() and createDecorations() methods have been replaced by
  // lazyLoadVillage() and lazyLoadDecorations() for progressive loading

  /**
   * Define default spawn points for multiplayer (before village is loaded)
   */
  defineDefaultSpawnPoints() {
    // Clear any existing spawn points
    this.spawnPoints = [];
    
    // Add simple spawn points in the center
    this.spawnPoints.push({ x: 0, y: 0, z: 0, rotation: 0 });
    this.spawnPoints.push({ x: 2, y: 0, z: 2, rotation: Math.PI / 4 });
    this.spawnPoints.push({ x: -2, y: 0, z: 2, rotation: -Math.PI / 4 });
    this.spawnPoints.push({ x: 0, y: 0, z: -2, rotation: Math.PI });
  }
  
  /**
   * Define full spawn points for multiplayer (after village is loaded)
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
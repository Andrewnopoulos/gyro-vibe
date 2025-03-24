/**
 * Manages loading progress for all assets in the application
 * Simplified for a no-loading-screen approach with lazy loading
 */
export class LoadingManager {
  /**
   * @param {EventBus} eventBus - Application event bus for broadcasting loading events
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.isLoading = false;
    
    // Create Three.js loading manager
    this.threeLoadingManager = this.createThreeLoadingManager();
    
    // Register for events
    this.setupEventListeners();
    
    // Immediately emit loading complete to start the app right away
    if (this.eventBus) {
      this.eventBus.emit('loading:complete');
    }
  }
  
  /**
   * Create Three.js loading manager with simplified callbacks
   * @returns {THREE.LoadingManager}
   */
  createThreeLoadingManager() {
    // Simplified loading manager that only logs errors but doesn't show a loading screen
    const manager = {
      onStart: (url, itemsLoaded, itemsTotal) => {
        console.log(`Loading started: ${url}`);
      },
      onLoad: () => {
        console.log('All assets loaded successfully');
      },
      onProgress: (url, itemsLoaded, itemsTotal) => {
        console.log(`Loading progress: ${url} (${itemsLoaded}/${itemsTotal})`);
      },
      onError: (url) => {
        console.error(`Failed to load: ${url}`);
      }
    };
    
    return manager;
  }
  
  /**
   * Set up event listeners for loading events
   */
  setupEventListeners() {
    // Simplified event listeners that just ignore load events
    if (this.eventBus) {
      // Listen for events but do nothing with them
      this.eventBus.on('audio:load-start', () => {});
      this.eventBus.on('audio:load-complete', () => {});
      this.eventBus.on('asset:load-start', () => {});
      this.eventBus.on('asset:load-progress', () => {});
      this.eventBus.on('asset:load-complete', () => {});
    }
  }
  
  // All the loading handler methods have been removed since we're not using a loading screen
  // and are implementing lazy loading directly in components
  
  /**
   * Returns the Three.js LoadingManager instance
   * @returns {Object} The Three.js LoadingManager
   */
  getThreeLoadingManager() {
    return this.threeLoadingManager;
  }
  
  /**
   * Simplified add assets method (no-op)
   * @param {number} count - Number of assets to add (ignored)
   * @param {string} type - Type of asset (ignored)
   */
  addAssets(count, type) {
    // No-op in the simplified version
    console.log(`Asset tracking disabled: ${count} ${type} assets added`);
  }
  
  /**
   * Simplified mark assets loaded method (no-op)
   * @param {number} count - Number of assets to mark as loaded (ignored)
   * @param {string} type - Type of asset (ignored)
   */
  markAssetsLoaded(count, type) {
    // No-op in the simplified version
    console.log(`Asset tracking disabled: ${count} ${type} assets marked as loaded`);
  }
}
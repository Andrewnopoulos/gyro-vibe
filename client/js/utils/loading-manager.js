/**
 * Manages loading progress for all assets in the application
 */
export class LoadingManager {
  /**
   * @param {EventBus} eventBus - Application event bus for broadcasting loading events
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.isLoading = true;
    this.loadingTimeoutSet = false;
    this.loadingScreen = document.getElementById('loading-screen');
    this.progressBar = document.getElementById('loading-progress-bar');
    this.loadingText = document.getElementById('loading-text');
    this.assetsText = document.getElementById('loading-assets-text');
    
    // Counters for different types of assets
    this.assetsTotal = 0;
    this.assetsLoaded = 0;
    this.texturesTotal = 0;
    this.texturesLoaded = 0;
    this.modelsTotal = 0;
    this.modelsLoaded = 0;
    this.soundsTotal = 0;
    this.soundsLoaded = 0;
    this.otherTotal = 1; // Start with 1 for the initial page load
    this.otherLoaded = 0;
    
    // Create Three.js loading manager
    this.threeLoadingManager = this.createThreeLoadingManager();
    
    // Register for events
    this.setupEventListeners();
    
    // Start tracking other general resources
    this.trackDocumentLoad();
  }
  
  /**
   * Create Three.js loading manager with callbacks
   * @returns {THREE.LoadingManager}
   */
  createThreeLoadingManager() {
    // We're using our own implementation instead of directly importing THREE.LoadingManager
    // because we want more control over the loading process
    const manager = {
      onStart: (url, itemsLoaded, itemsTotal) => {
        this.handleThreeStart(url, itemsLoaded, itemsTotal);
      },
      onLoad: () => {
        this.handleThreeComplete();
      },
      onProgress: (url, itemsLoaded, itemsTotal) => {
        this.handleThreeProgress(url, itemsLoaded, itemsTotal);
      },
      onError: (url) => {
        this.handleThreeError(url);
      }
    };
    
    return manager;
  }
  
  /**
   * Set up event listeners for loading events
   */
  setupEventListeners() {
    // Listen for sound loading events
    if (this.eventBus) {
      this.eventBus.on('audio:load-start', (data) => {
        this.soundsTotal += data.count || 1;
        this.assetsTotal += data.count || 1;
        this.updateLoadingProgress();
      });
      
      this.eventBus.on('audio:load-complete', (data) => {
        this.soundsLoaded += data.count || 1;
        this.assetsLoaded += data.count || 1;
        this.updateLoadingProgress();
      });
      
      // Custom asset loading events
      this.eventBus.on('asset:load-start', (data) => {
        const count = data.count || 1;
        
        if (data.type === 'texture') {
          this.texturesTotal += count;
        } else if (data.type === 'model') {
          this.modelsTotal += count;
        } else if (data.type === 'sound') {
          this.soundsTotal += count;
        } else {
          this.otherTotal += count;
        }
        
        this.assetsTotal += count;
        this.updateLoadingProgress();
      });
      
      this.eventBus.on('asset:load-progress', (data) => {
        this.updateLoadingText(`Loading ${data.type || 'asset'}: ${data.url || ''}`);
      });
      
      this.eventBus.on('asset:load-complete', (data) => {
        const count = data.count || 1;
        
        if (data.type === 'texture') {
          this.texturesLoaded += count;
        } else if (data.type === 'model') {
          this.modelsLoaded += count;
        } else if (data.type === 'sound') {
          this.soundsLoaded += count;
        } else {
          this.otherLoaded += count;
        }
        
        this.assetsLoaded += count;
        this.updateLoadingProgress();
      });
    }
  }
  
  /**
   * Handle Three.js loading started
   * @param {string} url - URL of the resource
   * @param {number} itemsLoaded - Items loaded so far
   * @param {number} itemsTotal - Total items to load
   */
  handleThreeStart(url, itemsLoaded, itemsTotal) {
    // Determine if this is a texture or model based on the URL
    if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp|tga|dds)$/i)) {
      this.texturesTotal++;
      this.assetsTotal++;
    } else if (url.match(/\.(gltf|glb|obj|fbx|dae|3ds|stl|ply)$/i)) {
      this.modelsTotal++;
      this.assetsTotal++;
    } else {
      this.otherTotal++;
      this.assetsTotal++;
    }
    
    this.updateLoadingProgress();
    this.updateLoadingText(`Loading: ${url}`);
  }
  
  /**
   * Handle Three.js loading progress
   * @param {string} url - URL of the resource
   * @param {number} itemsLoaded - Items loaded so far
   * @param {number} itemsTotal - Total items to load
   */
  handleThreeProgress(url, itemsLoaded, itemsTotal) {
    // Determine if this is a texture or model based on the URL
    if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp|tga|dds)$/i)) {
      this.texturesLoaded++;
      this.assetsLoaded++;
    } else if (url.match(/\.(gltf|glb|obj|fbx|dae|3ds|stl|ply)$/i)) {
      this.modelsLoaded++;
      this.assetsLoaded++;
    } else {
      this.otherLoaded++;
      this.assetsLoaded++;
    }
    
    this.updateLoadingProgress();
    this.updateLoadingText(`Loading: ${url}`);
  }
  
  /**
   * Handle Three.js loading complete
   */
  handleThreeComplete() {
    this.updateLoadingProgress();
    this.updateLoadingText('3D assets loaded');
    this.checkAllAssetsLoaded();
  }
  
  /**
   * Handle Three.js loading error
   * @param {string} url - URL of the resource that failed to load
   */
  handleThreeError(url) {
    console.error(`Failed to load: ${url}`);
    
    // Still count it as "loaded" to avoid hanging
    this.assetsLoaded++;
    
    // Determine the type and increment the counter
    if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp|tga|dds)$/i)) {
      this.texturesLoaded++;
    } else if (url.match(/\.(gltf|glb|obj|fbx|dae|3ds|stl|ply)$/i)) {
      this.modelsLoaded++;
    } else {
      this.otherLoaded++;
    }
    
    this.updateLoadingProgress();
    this.updateLoadingText(`Error loading: ${url}`);
  }
  
  /**
   * Track document load
   */
  trackDocumentLoad() {
    // If document is already loaded
    if (document.readyState === 'complete') {
      this.otherLoaded++;
      this.assetsLoaded++;
      this.updateLoadingProgress();
    } else {
      // Otherwise wait for it to load
      window.addEventListener('load', () => {
        this.otherLoaded++;
        this.assetsLoaded++;
        this.updateLoadingProgress();
        this.checkAllAssetsLoaded();
      });
    }
  }
  
  /**
   * Update loading progress indicators
   */
  updateLoadingProgress() {
    // Calculate progress percentage
    let progress = 0;
    
    if (this.assetsTotal > 0) {
      progress = Math.min(100, Math.floor((this.assetsLoaded / this.assetsTotal) * 100));
    }
    
    // Update progress bar
    if (this.progressBar) {
      this.progressBar.style.width = `${progress}%`;
    }
    
    // Update asset text display
    if (this.assetsText) {
      this.assetsText.textContent = `Textures: ${this.texturesLoaded}/${this.texturesTotal} | Models: ${this.modelsLoaded}/${this.modelsTotal} | Sounds: ${this.soundsLoaded}/${this.soundsTotal} | Overall: ${this.assetsLoaded}/${this.assetsTotal}`;
    }
    
    // Broadcast progress event
    if (this.eventBus) {
      this.eventBus.emit('loading:progress', {
        progress,
        loaded: this.assetsLoaded,
        total: this.assetsTotal
      });
    }
    
    // Check if we're done loading
    this.checkAllAssetsLoaded();
  }
  
  /**
   * Update loading text
   * @param {string} text - Text to display
   */
  updateLoadingText(text) {
    if (this.loadingText) {
      this.loadingText.textContent = text;
    }
  }
  
  /**
   * Check if all assets are loaded and hide the loading screen if so
   */
  checkAllAssetsLoaded() {
    // Only hide loading screen if:
    // 1. We have at least one asset to load (avoid flashing)
    // 2. We've loaded all known assets OR we've waited long enough
    // 3. We haven't already hidden it
    if (this.assetsTotal > 0 && this.isLoading) {
      if (this.assetsLoaded >= this.assetsTotal) {
        // All assets loaded, hide loading screen
        setTimeout(() => {
          this.hideLoadingScreen();
        }, 500);
      } else {
        // Set a maximum loading time to prevent getting stuck on missing files
        if (!this.loadingTimeoutSet) {
          this.loadingTimeoutSet = true;
          
          setTimeout(() => {
            // If we're still loading after 10 seconds, force completion
            if (this.isLoading) {
              console.warn('Loading timeout reached, forcing loading completion');
              this.updateLoadingText('Some assets failed to load, continuing anyway...');
              
              // Update progress to 100%
              if (this.progressBar) {
                this.progressBar.style.width = '100%';
              }
              
              // Hide loading screen after showing the message
              setTimeout(() => {
                this.hideLoadingScreen();
              }, 1500);
            }
          }, 10000); // 10 second timeout
        }
      }
    }
  }
  
  /**
   * Hide the loading screen
   */
  hideLoadingScreen() {
    if (this.loadingScreen && this.isLoading) {
      this.isLoading = false;
      
      // Fade out
      this.loadingScreen.style.opacity = '0';
      
      // Then hide completely
      setTimeout(() => {
        this.loadingScreen.style.display = 'none';
        
        // Broadcast loading complete event
        if (this.eventBus) {
          this.eventBus.emit('loading:complete');
        }
      }, 500);
    }
  }
  
  /**
   * Returns the Three.js LoadingManager instance
   * @returns {Object} The Three.js LoadingManager
   */
  getThreeLoadingManager() {
    return this.threeLoadingManager;
  }
  
  /**
   * Manually add assets to the loading queue
   * @param {number} count - Number of assets to add
   * @param {string} type - Type of asset ('texture', 'model', 'sound', 'other')
   */
  addAssets(count, type) {
    if (type === 'texture') {
      this.texturesTotal += count;
    } else if (type === 'model') {
      this.modelsTotal += count;
    } else if (type === 'sound') {
      this.soundsTotal += count;
    } else {
      this.otherTotal += count;
    }
    
    this.assetsTotal += count;
    this.updateLoadingProgress();
  }
  
  /**
   * Manually mark assets as loaded
   * @param {number} count - Number of assets to mark as loaded
   * @param {string} type - Type of asset ('texture', 'model', 'sound', 'other')
   */
  markAssetsLoaded(count, type) {
    if (type === 'texture') {
      this.texturesLoaded += count;
    } else if (type === 'model') {
      this.modelsLoaded += count;
    } else if (type === 'sound') {
      this.soundsLoaded += count;
    } else {
      this.otherLoaded += count;
    }
    
    this.assetsLoaded += count;
    this.updateLoadingProgress();
  }
}
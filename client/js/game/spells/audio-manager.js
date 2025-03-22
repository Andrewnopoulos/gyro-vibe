/**
 * Manages audio for spells and effects
 */
export class SpellAudioManager {
  /**
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    this.sounds = {};
    this.volume = options.volume || 0.5;
    this.enabled = options.enabled !== false;
    this.eventBus = options.eventBus || null;
    
    // Base path for audio files
    this.basePath = options.basePath || '/assets/sounds/';
    
    // Register default sounds
    // this.registerDefaultSounds();
  }

  /**
   * Register a sound for later playback
   * @param {string} id - Unique identifier for the sound
   * @param {string} url - URL to the sound file
   * @param {Object} options - Sound options
   */
  registerSound(id, url, options = {}) {
    // Emit loading event if we have an event bus
    if (this.eventBus) {
      this.eventBus.emit('asset:load-start', { type: 'sound', url, count: 1 });
    }
    
    // Create audio element
    const audio = new Audio(url);
    audio.volume = options.volume !== undefined ? options.volume : this.volume;
    audio.preload = options.preload !== undefined ? options.preload : 'auto';
    
    // Track loading completion
    audio.addEventListener('canplaythrough', () => {
      if (this.eventBus && !this.sounds[id]?.loaded) {
        this.eventBus.emit('asset:load-complete', { type: 'sound', url, count: 1 });
        
        // Mark as loaded to prevent duplicate events
        if (this.sounds[id]) {
          this.sounds[id].loaded = true;
        }
      }
    }, { once: true });
    
    // Track loading errors
    audio.addEventListener('error', () => {
      if (this.eventBus) {
        console.warn(`Failed to load sound: ${url} - Using placeholder`);
        this.eventBus.emit('asset:load-complete', { type: 'sound', url, count: 1 });
      }
      
      // Add empty audio buffer as fallback for missing sounds
      const emptyAudio = new Audio();
      
      // Replace the failed audio element with a placeholder
      if (this.sounds[id]) {
        this.sounds[id].element = emptyAudio;
        this.sounds[id].loaded = true;
        this.sounds[id].failed = true;
      }
    }, { once: true });
    
    // Set a timeout in case loading gets stuck
    const loadTimeout = setTimeout(() => {
      if (this.eventBus && !this.sounds[id]?.loaded) {
        console.warn(`Timeout loading sound: ${url}`);
        this.eventBus.emit('asset:load-complete', { type: 'sound', url, count: 1 });
        
        if (this.sounds[id]) {
          this.sounds[id].loaded = true;
        }
      }
    }, 5000); // 5 second timeout
    
    this.sounds[id] = {
      element: audio,
      options: options,
      loaded: false,
      failed: false,
      loadTimeout: loadTimeout
    };
    
    return this;
  }

  /**
   * Play a registered sound
   * @param {string} id - ID of the sound to play
   * @param {Object} options - Playback options
   * @returns {Promise} Promise that resolves when sound starts playing
   */
  playSound(id, options = {}) {
    if (!this.enabled) return Promise.resolve();
    
    const sound = this.sounds[id];
    if (!sound) {
      console.warn(`Sound '${id}' not found`);
      return Promise.resolve(); // Don't reject, just resolve silently
    }
    
    // If the sound failed to load, just return silently
    if (sound.failed) {
      return Promise.resolve();
    }
    
    // Create a new audio element for overlapping sounds
    let audioElement = sound.element;
    
    if (options.overlap || sound.options.overlap) {
      try {
        audioElement = new Audio(sound.element.src);
        audioElement.volume = options.volume !== undefined ? options.volume : sound.element.volume;
      } catch (err) {
        console.warn(`Failed to create overlapping sound for '${id}':`, err);
        return Promise.resolve();
      }
    } else {
      // Otherwise, reuse the existing element (restart it)
      try {
        audioElement.currentTime = 0;
      } catch (err) {
        console.warn(`Failed to reset sound '${id}':`, err);
        return Promise.resolve();
      }
    }
    
    // Apply options
    if (options.volume !== undefined) {
      audioElement.volume = options.volume;
    }
    
    if (options.playbackRate !== undefined) {
      audioElement.playbackRate = options.playbackRate;
    }
    
    // Play the sound with error handling
    try {
      // Play the sound
      const playPromise = audioElement.play();
      
      // Handle play errors (browsers may block autoplay)
      if (playPromise !== undefined) {
        return playPromise.catch(error => {
          console.warn(`Failed to play sound '${id}':`, error);
          return Promise.resolve(); // Still resolve to prevent further errors
        });
      }
    } catch (err) {
      console.warn(`Error playing sound '${id}':`, err);
    }
    
    return Promise.resolve();
  }

  /**
   * Stop a playing sound
   * @param {string} id - ID of the sound to stop
   */
  stopSound(id) {
    const sound = this.sounds[id];
    if (sound) {
      sound.element.pause();
      sound.element.currentTime = 0;
    }
  }

  /**
   * Stop all sounds
   */
  stopAllSounds() {
    Object.values(this.sounds).forEach(sound => {
      sound.element.pause();
      sound.element.currentTime = 0;
    });
  }

  /**
   * Register default spell sounds
   */
  registerDefaultSounds() {
    // Notify about sound loading start if we have an event bus
    if (this.eventBus) {
      // We're about to register 6 sounds
      this.eventBus.emit('audio:load-start', { count: 6 });
    }
    
    // Page turning sounds
    this.registerSound('page-flip', `${this.basePath}page-flip.wav`, { volume: 0.5 });
    this.registerSound('page-flip-fail', `${this.basePath}page-flip-fail.mp3`, { volume: 0.3 });
    
    // Spell casting sounds
    this.registerSound('spell-cast-success', `${this.basePath}spell-cast-success.mp3`, { volume: 0.7 });
    this.registerSound('spell-cast-fail', `${this.basePath}spell-cast-fail.mp3`, { volume: 0.5 });
    
    // Specific spell sounds
    this.registerSound('circle-spell', `${this.basePath}circle-spell.mp3`, { volume: 0.7 });
    this.registerSound('triangle-spell', `${this.basePath}triangle-spell.mp3`, { volume: 0.7 });
  }

  /**
   * Set global volume
   * @param {number} volume - Volume level (0-1)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    
    // Update volume for all sounds
    Object.values(this.sounds).forEach(sound => {
      sound.element.volume = this.volume;
    });
  }

  /**
   * Enable or disable all sounds
   * @param {boolean} enabled - Whether sounds should be enabled
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    
    // Stop all sounds if disabled
    if (!enabled) {
      this.stopAllSounds();
    }
  }
}
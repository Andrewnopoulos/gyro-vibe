/**
 * This file contains functions to create placeholder audio
 * Since we can't create real audio files in this environment,
 * this provides a way to create dummy audio objects that can be used
 * in development without failing when audio files are missing.
 */

/**
 * Create a dummy Audio object that won't fail when methods are called
 * @param {string} src - Audio file source URL
 * @returns {Object} - Mock Audio object
 */
export function createDummyAudio(src) {
  return {
    src,
    volume: 1,
    currentTime: 0,
    play: () => Promise.resolve(),
    pause: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}

/**
 * Create a mock version of the SpellAudioManager
 * that won't fail when audio files are missing
 * @returns {Object} Mock audio manager
 */
export function createMockAudioManager() {
  return {
    sounds: {},
    volume: 0.5,
    enabled: true,
    
    registerSound: (id, url) => {
      console.log(`Registered sound: ${id} -> ${url}`);
      return this;
    },
    
    playSound: (id) => {
      console.log(`Playing sound: ${id}`);
      return Promise.resolve();
    },
    
    stopSound: () => {},
    stopAllSounds: () => {},
    setVolume: () => {},
    setEnabled: () => {}
  };
}

/**
 * Patch the window.Audio constructor to use dummy audio
 * when actual audio files are missing
 */
export function patchAudioForDevelopment() {
  const originalAudio = window.Audio;
  
  // Replace Audio constructor with one that falls back to dummy audio
  window.Audio = function(src) {
    const audio = new originalAudio(src);
    
    // Override play method to catch errors
    const originalPlay = audio.play;
    audio.play = function() {
      const playPromise = originalPlay.call(this);
      
      if (playPromise) {
        return playPromise.catch(error => {
          console.warn(`Failed to play audio (${src}):`, error);
          console.log('Using dummy audio fallback');
          return Promise.resolve();
        });
      }
      
      return Promise.resolve();
    };
    
    return audio;
  };
}
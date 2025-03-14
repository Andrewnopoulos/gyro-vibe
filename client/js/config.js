// Global configuration constants

// WebRTC configuration
export const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

// Data visualization settings
export const MAX_DATA_POINTS = 50;

// Three.js camera settings
export const DEFAULT_CAMERA_POSITION = { x: 3, y: 2, z: 3 };

// First-person camera variables
export const PLAYER_HEIGHT = 1.6; // Player height in units (average human height)
export const MOVE_SPEED = 0.25; // Movement speed
export const LOOK_SPEED = 0.002; // Look sensitivity

// Weapon view settings
export const WEAPON_BOBBING = {
  intensity: 0.015,
  speed: 4
};

// Math constants
export const DEG_TO_RAD = Math.PI / 180;

// Debug configuration
export const DEBUG_CONFIG = {
  /**
   * Enable debug mode for multiplayer without requiring mobile connection
   */
  ENABLE_MULTIPLAYER_DEBUG: true,
  
  /**
   * Auto-join a debug room when in multiplayer debug mode
   * Disabled now that we have a proper lobby UI
   */
  AUTO_JOIN_DEBUG_ROOM: false,
  
  /**
   * Debug username to use in multiplayer
   */
  DEBUG_USERNAME: 'DebugPlayer',
  
  /**
   * Debug room name
   */
  DEBUG_ROOM_NAME: 'Debug Room',
  
  /**
   * Simulate touch input from gyroscope for debugging
   */
  SIMULATE_GYRO: false
};
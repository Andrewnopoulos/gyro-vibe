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

// Physics constants
export const PHYSICS = {
  GRAVITY: 20.0, // Gravity acceleration (units/s²) - slightly reduced
  JUMP_FORCE: 7.0, // Initial jump velocity - slightly reduced
  MAX_FALL_SPEED: 12.0, // Terminal velocity - reduced for better control
  PLAYER_RADIUS: 0.4, // Player collision radius - slightly reduced
  GROUND_FRICTION: 8.0, // Friction when on ground - reduced for smoother movement
  AIR_RESISTANCE: 1.5, // Air resistance when in air - reduced for better air control
  GROUND_CHECK_DISTANCE: 0.2 // Distance to check for ground below player
};

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
  SIMULATE_GYRO: false,
  
  /**
   * Show collision detection for debugging
   */
  SHOW_COLLISION_HELPERS: true
};
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
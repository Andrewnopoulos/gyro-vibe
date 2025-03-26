// Create global audio manager first
import { EventBus } from './utils/event-bus.js';
import { SpellAudioManager } from './game/spells/audio-manager.js';

// Create a temporary event bus for initial loading
const tempEventBus = new EventBus();

// Mobile detection function
function isMobileDevice() {
  const userAgent = navigator.userAgent || navigator.vendor || window.opera;
  
  // Detect phones
  const mobileRegex = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i;
  
  // Detect tablets
  const tabletRegex = /android|ipad|playbook|silk/i;
  
  // Check if not accessing via the mobile-specific endpoint
  const isMobileEndpoint = window.location.pathname.includes('/mobile');
  
  return (mobileRegex.test(userAgent) || tabletRegex.test(userAgent)) && !isMobileEndpoint;
}

// If user is on a mobile device (but not on the /mobile endpoint)
// Hide desktop-specific UI elements
if (isMobileDevice()) {
  window.addEventListener('DOMContentLoaded', () => {
    // Don't show the QR code
    const qrcodeElement = document.getElementById('qrcode');
    if (qrcodeElement) qrcodeElement.style.display = 'none';
    
    // Don't show the initial instructions
    const instructionsElement = document.getElementById('instructions');
    if (instructionsElement) instructionsElement.style.display = 'none';
    
    // Don't show the multiplayer UI toggle button
    const lobbyToggleBtn = document.getElementById('lobbyToggleBtn');
    if (lobbyToggleBtn) lobbyToggleBtn.style.display = 'none';
    
    // Don't show the debug button
    const debugToggleBtn = document.getElementById('debugToggleBtn');
    if (debugToggleBtn) debugToggleBtn.style.display = 'none';
    
    // Don't show the debug section
    const debugSection = document.getElementById('debugSection');
    if (debugSection) debugSection.style.display = 'none';
    
    // Don't show the controls UI (except calibration which may be needed)
    const controlsOverlay = document.getElementById('controls-overlay');
    if (controlsOverlay) {
      // Hide all children except calibration button
      Array.from(controlsOverlay.children).forEach(child => {
        child.style.display = 'none';
      });
    }
    
    console.log('Mobile device detected. Optimizing UI for mobile experience.');
  });
}

// Initialize audio manager early to start preloading sounds
window.spellAudioManager = new SpellAudioManager({
  eventBus: tempEventBus,
  volume: 0.5,
  enabled: true
});

// Import the main application
import './app.js';
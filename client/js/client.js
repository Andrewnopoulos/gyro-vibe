// Create global audio manager first
import { EventBus } from './utils/event-bus.js';
import { SpellAudioManager } from './game/spells/audio-manager.js';

// Create a temporary event bus for initial loading
const tempEventBus = new EventBus();

// Initialize audio manager early to start preloading sounds
window.spellAudioManager = new SpellAudioManager({
  eventBus: tempEventBus,
  volume: 0.5,
  enabled: true
});

// Import the main application
import './app.js';
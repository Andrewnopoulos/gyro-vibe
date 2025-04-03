/**
 * Entry point for spell system
 */
import { SpellRegistry } from './spell-registry.js';
import { SpellEffects } from './spell-effects.js';
import { Spell } from './spell.js';
import { ObjectSpawnerSpell } from './object-spawner-spell.js';
import { GravityGunSpell } from './gravity-gun-spell.js';
import { BlackHoleSpell } from './black-hole-spell.js';
import { LaserBeamSpell } from './laser-beam-spell.js';
import { FlightSpell } from './flight-spell.js';
import { SpellAudioManager } from './audio-manager.js';

// Export main spell classes
export {
  SpellRegistry,
  SpellEffects,
  Spell,
  ObjectSpawnerSpell,
  GravityGunSpell,
  BlackHoleSpell,
  LaserBeamSpell,
  FlightSpell,
  SpellAudioManager
};
/**
 * Entry point for spell system
 */
import { SpellRegistry } from './spell-registry.js';
import { SpellEffects } from './spell-effects.js';
import { Spell } from './spell.js';
import { CircleSpell } from './circle-spell.js';
import { TriangleSpell } from './triangle-spell.js';
import { ObjectSpawnerSpell } from './object-spawner-spell.js';
import { GravityGunSpell } from './gravity-gun-spell.js';
import { BlackHoleSpell } from './black-hole-spell.js';
import { SpellAudioManager } from './audio-manager.js';

// Export main spell classes
export {
  SpellRegistry,
  SpellEffects,
  Spell,
  CircleSpell,
  TriangleSpell,
  ObjectSpawnerSpell,
  GravityGunSpell,
  BlackHoleSpell,
  SpellAudioManager
};
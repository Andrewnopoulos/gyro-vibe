# Spellbook System

This directory contains the implementation of the multi-page spellbook system with shape-based spell casting.

## Overview

The spellbook system allows players to:
- Browse through a magical spellbook with multiple pages
- View different spells on each page
- Cast spells by drawing the appropriate shape on their mobile device
- Experience visual effects based on the spell cast

## Components

### Core Classes

- `Spell`: Base class for all spells, providing common functionality
- `SpellRegistry`: Central registry that manages all available spells
- `SpellEffects`: Library of visual effects for different spells
- `SpellAudioManager`: Handles audio effects for spell casting and page turning

### Specific Spell Implementations

- `CircleSpell`: Shield spell cast by drawing a circle
- `TriangleSpell`: Fireball spell cast by drawing a triangle

## How to Add a New Spell

1. Create a new spell class that extends the `Spell` base class:

```javascript
import { Spell } from './spell.js';

export class MyNewSpell extends Spell {
  constructor(options = {}) {
    super({
      id: options.id || 'my-spell',
      name: options.name || 'My Awesome Spell',
      shape: 'your-shape', // The shape to draw (e.g., 'square')
      description: options.description || 'Spell description here...',
      page: options.page, // Let SpellRegistry assign a page if not specified
      effect: (context) => this.castEffect(context),
      visualOptions: options.visualOptions || {
        strokeColor: '#HEXCOLOR',
        lineWidth: 4
      },
      cooldown: options.cooldown || 5
    });
    
    // Store additional spell-specific properties
    this.eventBus = options.eventBus;
    this.myProperty = options.myProperty || defaultValue;
  }
  
  // Implement custom drawing for shape page
  drawShape(context) {
    // Custom implementation...
  }
  
  // Implement custom drawing for description page
  drawDescription(context) {
    // Custom implementation...
  }
  
  // Implement spell effect
  castEffect(context) {
    // Implement the spell's effect...
    console.log('Casting my new spell!');
    
    // Emit events for other systems to respond to
    if (this.eventBus) {
      this.eventBus.emit('spell:my-spell-cast', {
        // Spell-specific data...
      });
    }
  }
}
```

2. Register the spell in `SpellRegistry`:

```javascript
// In SpellRegistry.js
import { MyNewSpell } from './my-new-spell.js';

// In the registerDefaultSpells method:
const mySpell = new MyNewSpell({
  eventBus: this.eventBus,
  page: 3, // Specify a page number or let it auto-assign
  // Other spell-specific options...
});
this.registerSpell(mySpell);
```

3. Implement any specialized visual effects in `SpellEffects.js`

## Usage

The spellbook is part of the first-person weapon view system. Players can:

- Turn pages with Q/E keys
- Draw shapes on their mobile device to cast spells
- See visual feedback when spells are cast correctly or incorrectly

## Dependencies

- THREE.js for 3D rendering
- EventBus for cross-system communication
- Mobile device with touch input for shape drawing
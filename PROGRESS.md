How to Use the Animations
The startFlipLeft() and startFlipRight() methods are ready to trigger the animations, but they need to be called based on your game’s input system. For example:

Gestures: If your game uses touch controls, you could tie swipes to these methods (e.g., swipe left for startFlipLeft).
Events: Add event listeners in setupEventListeners like this:

this.eventBus.on('weapon:flip-left', () => this.startFlipLeft());
this.eventBus.on('weapon:flip-right', () => this.startFlipRight());

Then emit these events (this.eventBus.emit('weapon:flip-left')) when appropriate in your game logic.

Notes
Visuals: The spellbook is basic (brown covers, white pages). You could enhance it with textures or more detailed geometry if desired.
Rune Effects: I simplified these to apply to the spellbook’s center. You might want to adjust positions or target specific parts (e.g., pages) further.
Testing: The position (0.25, -0.2, -0.8) and rotation -Math.PI / 2 are kept from the phone; tweak these if the spellbook doesn’t sit right in your view.
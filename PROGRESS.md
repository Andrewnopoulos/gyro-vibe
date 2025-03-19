Physics progress:

- can spawn rigidbodies
- gravity gun now raycasts from weapon in weapon-view

## Gravity Gun & Weapon View Integration

### Implementation Completed
1. ✅ Created weapon-to-world space mapping in WeaponView
   - Added getRaycastData() method to get origin and direction
   - Added mapToWorldSpace() method to transform coordinates
   - Added raycastOrigin point at top of weapon model

2. ✅ Updated GravityGunController to use WeaponView
   - Removed old reticle and phone model code
   - Modified performRaycast() to get data from WeaponView
   - Added coordinate transformation to world space

3. ✅ Added visual feedback in Weapon View
   - Implemented updateGravityBeam() for beam visualization
   - Created visual indicators for valid targets
   - Added smooth animations and effects

4. ✅ Set up communication between components
   - Added event listeners in WeaponView for gravity gun actions
   - Modified both components to respond to the same events
   - Ensured visual feedback is consistent across components

5. ✅ Connected in FirstPersonController
   - Instantiated WeaponView and GravityGunController together
   - Added proper update calls in the render loop
   - Implemented proper cleanup in dispose() method

### To Be Tested
- Test raycasting in different orientations
- Verify objects can be picked up correctly
- Test in different screen sizes/orientations
- Check for any performance bottlenecks

### Debugging Tips
- Visual indicator at raycast origin shows green when pointing at valid physics objects
- Beam visualization shows the direction and target of the gravity gun
- Press 'V' key to toggle a permanent debug raycast line (red)
- Debug raycast visualization can be disabled in production by setting DEBUG_RAYCAST to false

## Test results (2025-03-19):
- Raycast appears to be pointing from the back of the phone. Please redirect it so that it points from the top
- The raycast indicator might be in the same screen space as the weapon view, when I probably need one in the main world scene as well
- the E key still doesn't appear to be allowing me to interact with physics objects

## Fixes implemented (2025-03-19):
1. **Fixed raycast origin position**:
   - Moved raycast origin to top of phone and more forward from the device
   - Made origin indicator larger and always visible for easier debugging
   - Added a direction line showing which way the raycast points

2. **Improved coordinate transformation between spaces**:
   - Modified mapToWorldSpace to use camera position with proper offsets
   - Added better position/direction calculations for more intuitive aiming
   - Now uses camera's forward direction for more reliable raycasting

3. **Enhanced E key interaction debugging**:
   - Added verbose logging for raycast hits including object information
   - Force a raycast update when E key is pressed for immediate feedback
   - Increased visibility of raycast indicators to help with positioning

4. **Added additional debugging information**:
   - Console logs showing raycast origin and direction
   - Detailed intersection information for physics debugging
   - Visually distinguished raycast origin for clearer identification

## Additional Fixes (2025-03-19):
Based on testing feedback:

1. **Visual Feedback on Physics Objects**:
   - Added visual highlighting of physics objects when raycast intersects them
   - Objects now show a green emissive glow when hit by raycast
   - Highlight persists while objects are being held

2. **Improved Event Communication**:
   - Enhanced gravity gun event data with more detailed information
   - Added objectId and position to pickup events
   - Improved drop event with object reference
   - Added more verbose logging to track event flow

3. **Debug Visualization Cleanup**:
   - Disabled permanent debug raycast visualization (was causing confusion)
   - Removed conflicting direction indicators
   - Made origin indicator smaller and less obtrusive
   - Removed obsolete reticle references

4. **Improved Object Interaction Handling**:
   - Added proper material state management for highlighted objects
   - Ensured original materials are restored when objects are released
   - Fixed event handler to properly support object highlighting
   - Added traverse method to find objects by physics ID

These changes address the issues noted in testing where:
1. The visualizations didn't match the actual raycast behavior
2. There was no visual feedback on the 3D objects when they were hit
3. E key was detecting objects (shown in logs) but feedback was missing



### New testing:

- Debug logs:
Raycast intersects found: 1
gravity-gun-controller.js:220 Intersect 0: object: unnamed distance: 3.7143271155441746 physics ID: none
weapon-view.js:763 Raycast origin: Vector3 {x: 0.3516312163640528, y: -0.09327730035840767, z: -1.2508673432857758} direction: Vector3 {x: -0.0769848517838799, y: -0.9938096042328243, z: 0.08009870866881179}
weapon-view.js:763 Raycast origin: Vector3 {x: 0.3516312163640528, y: -0.09327730035840767, z: -1.2508673432857758} direction: Vector3 {x: -0.0769848517838799, y: -0.9938096042328243, z: 0.08009870866881179}
weapon-view.js:763 Raycast origin: Vector3 {x: 0.3516312163640528, y: -0.09327730035840767, z: -1.2508673432857758} direction: Vector3 {x: -0.0769848517838799, y: -0.9938096042328243, z: 0.08009870866881179}
gravity-gun-controller.js:206 Raycast origin: Vector3 {x: 3.3923686325899656, y: 1.5206982745590387, z: 1.6180245154024144}
gravity-gun-controller.js:207 Raycast direction: Vector3 {x: 0.38667765368434853, y: -0.5440280868377404, z: 0.7446568557885138}
gravity-gun-controller.js:218 Raycast intersects found: 1
gravity-gun-controller.js:220 Intersect 0: object: unnamed distance: 3.7143271155441746 physics ID: none

- Another debug log excerpt:
Raycast intersects found: 2
gravity-gun-controller.js:220 Intersect 0: object: unnamed distance: 0.5496479906332833 physics ID: physics_ajfpm7vzi
gravity-gun-controller.js:220 Intersect 1: object: unnamed distance: 2.151843215132433 physics ID: none
gravity-gun-controller.js:235 Physics object hit! physics_ajfpm7vzi
weapon-view.js:763 Raycast origin: Vector3 {x: 0.33387651141192376, y: -0.09785975137666547, z: -1.255556912409996} direction: Vector3 {x: -0.020586015291614936, y: -0.9945203806251895, z: 0.10249599258284053}
weapon-view.js:763 Raycast origin: Vector3 {x: 0.33387651141192376, y: -0.09785975137666547, z: -1.255556912409996} direction: Vector3 {x: -0.020586015291614936, y: -0.9945203806251895, z: 0.10249599258284053}
weapon-view.js:763 Raycast origin: Vector3 {x: 0.33387651141192376, y: -0.09785975137666547, z: -1.255556912409996} direction: Vector3 {x: -0.020586015291614936, y: -0.9945203806251895, z: 0.10249599258284053}
gravity-gun-controller.js:206 Raycast origin: Vector3 {x: 2.8774950604233376, y: 1.385354937454372, z: 1.624803921725152}
gravity-gun-controller.js:207 Raycast direction: Vector3 {x: -0.13528390611839253, y: -0.8761581346614697, z: -0.46265017865757274}
gravity-gun-controller.js:218 Raycast intersects found: 2
gravity-gun-controller.js:220 Intersect 0: object: unnamed distance: 0.5496479906332833 physics ID: physics_ajfpm7vzi
gravity-gun-controller.js:220 Intersect 1: object: unnamed distance: 2.151843215132433 physics ID: none
gravity-gun-controller.js:235 Physics object hit! physics_ajfpm7vzi

- I can see that it's successfully intersecting, even though the visualisation doesn't appear to intersect.
- Pressing E still doesn't cause anything to happen
- There is no visual indication on the 3d object that it's being intersected with
- The debug raycast visualisations still appear to be pointing the wrong way.
  - Now there is one pointing the old way
  - And a new one pointing a completely different way
- Maybe just remove the debug ray casting visualisations
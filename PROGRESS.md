Physics progress:

- can spawn rigidbodies
- can't pick them up with E

## Gravity Gun & Weapon View Integration Plan

### Current Understanding
1. The gravity gun controller currently performs raycasts from the `phoneModel` in the main scene
2. The weapon view renders the weapon in a separate scene with its own camera and renderer
3. The weapon in the weapon-view isn't physically present in the main world space

### Integration Plan

#### Step 1: Create Weapon-to-World Space Mapping
- Modify the `WeaponView` class to expose the weapon position/orientation in a way the gravity gun can use
- Add a method in `WeaponView` to calculate the world-space equivalent of a point in the weapon-view's local space
- Expose the top of the weapon as the raycast origin point

#### Step 2: Update GravityGunController to Use WeaponView for Raycasting
- Modify the `performRaycast()` method to get raycast origin and direction from the weapon view
- Update the `getWeaponPosition()` method to use the weapon-view's position instead of looking for "phoneModel"
- Ensure raycasts are properly transformed from weapon-view space to world space

#### Step 3: Add Visual Feedback in Weapon View
- Add a method to show raycast visual effects on the weapon in weapon-view
- Create a beam/laser effect that extends from the weapon when using the gravity gun
- Ensure the beam visually aligns with where objects are being picked up in the main scene

#### Step 4: Handle Communication Between Components
- Set up event listeners to synchronize weapon-view and gravity gun states
- Update both components when orientation changes
- Ensure the visual effects in both scenes are properly aligned

#### Step 5: Testing and Optimization
- Test raycasting from different positions and orientations
- Verify that objects can be picked up correctly
- Optimize any performance bottlenecks in the coordinate transformations
- Ensure consistent behavior in different screen sizes and orientations

### Implementation Details
- Add a reference point to the top of the weapon in `WeaponView` (e.g., "raycastOrigin")
- Create a transformation matrix to convert between weapon view space and world space
- Use vector math to ensure the raycast direction aligns between both scenes
- Add debug visualization options to help verify correct alignment
Currently the players of the desktop version of the game who use index.html as the entrypoint are supposed to scan the QR code with their mobile and use their mobile phone (which uses the /mobile endpoint) as a gyro and touch controller for the desktop game.

I need a new feature added. Here is the summary:

- When the desktop player presses the Q key, it should toggle rune mode
- The default mode is rune mode being deactivated. Everything is the same as it currently is
- When rune mode is active:
  - I want a visual indicator on the player's in-game phone visualisation to show it
  - The touch input from the player's mobile device should no longer rotate the player's view
  - Instead, I want the player to see a visual representation of the path of their touch input
  - I want there to be shape recognition of some sort on the path of the touch input
  - Let's just start off with detecting when simple shapes are drawn, ie triangles or circles

## Implementation Plan: Rune Mode Feature

### 1. Update Key Handling in FirstPersonController
- Modify the FirstPersonController class to listen for the 'Q' key press
- Add a runeMode boolean flag to track the current state
- Implement a toggleRuneMode method to switch between normal and rune modes
- Emit an event when the rune mode changes state so other components can react

### 2. Add Visual Indicator to Phone Model
- Update PhoneModel class to add a visual indicator for when rune mode is active
- Create a method to toggle the visibility of this indicator
- Listen for rune mode toggle events to update the indicator
- Use a distinctive visual element like a glowing rune symbol or color change

### 3. Modify Touch Input Handling
- Update how touch input is processed in TouchController class
- Add conditional logic to check if rune mode is active
- When rune mode is active, capture touch points instead of using them for rotation
- Create data structures to store the touch path for shape recognition
- Emit events with the touch path data for visualization and recognition

### 4. Implement Touch Path Visualization
- Create a new visual component for the mobile device to render the touch path
- Add a canvas element overlay to the mobile interface
- Implement drawing functions to visualize the touch input path
- Use different colors or effects to enhance the visual experience
- Clear path visualization when a gesture is completed or recognized

### 5. Develop Shape Recognition System
- Implement basic shape recognition algorithms 
- Focus on detecting simple shapes first (circles and triangles)
- Use geometric algorithms like:
  - Calculating convexity and area for triangles
  - Checking roundness and closure for circles
- Add threshold values to account for imprecise human drawing
- Emit events when shapes are successfully recognized

### 6. Connect Desktop and Mobile Components
- Ensure proper communication between desktop and mobile devices
- Update WebRTC data channel to transmit rune mode status
- Send touch path data from mobile to desktop
- Process and visualize recognized shapes on both devices

### 7. User Feedback System
- Implement visual and potentially audio feedback when shapes are recognized
- Show success/failure indicators for attempted shape drawing
- Highlight recognized shapes with special effects
- Clear the canvas after successful recognition or after a timeout

### 8. Testing and Refinement
- Test shape recognition accuracy across different devices
- Adjust sensitivity parameters for optimal user experience
- Test responsiveness and latency of the system
- Ensure the rune mode can be toggled on/off reliably
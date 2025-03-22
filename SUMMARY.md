# MAGE FIGHT - Gameplay Summary

## Core Gameplay

MAGE FIGHT is a first-person spellcasting game that uses a mobile device as a motion controller. Players use their mobile phone as a magical wand to cast spells and interact with the game world.

## Main Features

### Motion Controls
- Use your mobile phone as a magical wand/spellbook
- Natural movement tracking with gyroscope and accelerometer
- Point, aim, and cast with intuitive gestures

### Spellcasting System
- **Spellbook Interface**: Navigate through pages of different spells with Q/E keys
- **Shape Recognition**: Draw shapes on your mobile device to cast spells
- **Cooldown System**: Visual cooldown indicators show when spells are ready
- **Current Spells**:
  - **Shield** (Circle shape): Cast a protective shield
  - **Fireball** (Triangle shape): Launch a fiery projectile
  - **Object Conjuring** (Space key): Spawn random physics objects
  - **Gravity Control** (Space key): Pick up and manipulate objects with magical energy

### Physics Interaction
- **Gravity Gun**: Pick up, move, and throw physics objects
- **Conjured Objects**: Spawn various objects with different properties (size, weight, bounciness)
- **Environmental Physics**: Objects interact realistically with each other and the environment

### First-Person Movement
- Standard WASD/Arrow key movement controls
- Mouse look for camera control
- Mobile device touch input for camera control

### Multiplayer Features
- Room-based multiplayer sessions
- QR code for easy mobile device connection
- Room code sharing for multiplayer games

### Visualization and Feedback
- 3D visualization of phone orientation
- Visual spell effects when casting
- Physics-based object interaction
- Cooldown indicators for spell recharging

### Special Modes
- **Rune Mode**: Toggle with Left Shift key for drawing spell shapes
- **God Mode**: Advanced movement mode with vertical flight (for debugging)

## Input Controls

### Keyboard Controls
- **W/Arrow Up**: Move forward
- **S/Arrow Down**: Move backward
- **A/Arrow Left**: Move left
- **D/Arrow Right**: Move right
- **Q**: Flip spell page left
- **E**: Flip spell page right
- **Space**: Cast current page spell
- **Left Shift**: Toggle rune drawing mode
- **V**: Toggle debug raycast visualization

### Mobile Controls
- **Touch Drag**: Look around / Draw runes (in rune mode)
- **Draw Circle**: Cast shield spell (when on shield page)
- **Draw Triangle**: Cast fireball spell (when on fireball page)

## Game World
- 3D environment with buildings, structures, and interactive elements
- Physics-based object interaction
- Different object types with varying properties
- Gravity and collision physics

## Technical Features
- WebRTC for low-latency communication between mobile and desktop
- Socket.IO for connection establishment and fallback
- Three.js for 3D rendering
- Mobile sensor data processing and filtering
- Shape recognition algorithms
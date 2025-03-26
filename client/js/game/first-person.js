import * as THREE from 'three';
import { PLAYER_HEIGHT, LOOK_SPEED, MOVE_SPEED } from '../config.js';

/**
 * Manages first-person mode controls
 */
export class FirstPersonController {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {Object} sceneManager - Scene manager containing camera and scene
   */
  constructor(eventBus, sceneManager) {
    this.eventBus = eventBus;
    this.sceneManager = sceneManager;
    this.camera = sceneManager.getCamera();
    this.container = document.getElementById('phone3d');

    // Movement variables
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.moveUp = false;     // New - for God Mode vertical movement
    this.moveDown = false;   // New - for God Mode vertical movement
    this.velocity = new THREE.Vector3();
    this.direction = new THREE.Vector3();
    this.enabled = false;

    // God Mode
    this.godMode = false;    // New - God Mode toggle
    this.godModeIndicator = null; // New - UI indicator for God Mode

    // Touch control variables
    this.touchActive = false;
    this.lastTouchX = 0;
    this.lastTouchY = 0;
    this.touchSensitivity = 2.5; // Sensitivity multiplier for touch movement

    // Mobile control variables
    this.isMobileDevice = this.checkIsMobileDevice();
    this.mobileControls = {
      leftJoystick: {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        element: null,
        stick: null,
        radius: 50,
        maxDistance: 40 // Maximum distance joystick can move from center
      },
      rightJoystick: {
        active: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        element: null,
        stick: null,
        radius: 50,
        maxDistance: 40
      },
      // For swipe detection
      swipe: {
        startX: 0,
        startY: 0,
        endX: 0,
        endY: 0,
        startTime: 0,
        minDistance: 70, // Minimum distance to detect swipe
        maxTime: 300 // Maximum time (ms) for swipe detection
      }
    };

    // UI elements
    this.controlsGuide = null;

    this.createUI();
    this.setupEventListeners();

    // Log successful initialization
    console.log('FirstPersonController initialized');
  }

  /**
   * Create first-person UI elements
   */
  createUI() {
    console.log('FirstPersonController.createUI called');

    // Check if container exists
    if (!this.container) {
      console.error('Container element not found! Cannot create UI elements.');
      return;
    }

    console.log('Creating UI elements in container:', this.container);

    // Add controls guide
    this.controlsGuide = document.createElement('div');

    if (this.isMobileDevice) {
      // Mobile-specific controls style
      this.controlsGuide.style.position = 'absolute';
      this.controlsGuide.style.top = '10px';
      this.controlsGuide.style.left = '10px';
      this.controlsGuide.style.padding = '8px';
      this.controlsGuide.style.backgroundColor = 'rgba(0,0,0,0.6)';
      this.controlsGuide.style.color = 'white';
      this.controlsGuide.style.fontSize = '11px';
      this.controlsGuide.style.borderRadius = '4px';
      this.controlsGuide.style.zIndex = '1000';
      this.controlsGuide.style.display = 'none'; // Hidden by default
      this.controlsGuide.style.maxWidth = '160px';
      this.controlsGuide.innerHTML = `
        <strong style="color:#4fc3f7">Mobile Controls:</strong><br>
        • Left Joystick - Move<br>
        • Touch Right Side - Look Around<br>
        • Swipe Horizontally - Flip Pages<br>
        • Swipe Up - Cast Spell<br>
        <strong>DESKTOP FOR BEST EXPERIENCE</strong>
      `;

      // Create virtual joysticks for mobile
      this.createMobileJoysticks();
    } else {
      // Desktop controls
      this.controlsGuide.style.position = 'absolute';
      this.controlsGuide.style.bottom = '10px';
      this.controlsGuide.style.right = '10px';
      this.controlsGuide.style.padding = '10px';
      this.controlsGuide.style.backgroundColor = 'rgba(0,0,0,0.5)';
      this.controlsGuide.style.color = 'white';
      this.controlsGuide.style.fontSize = '12px';
      this.controlsGuide.style.borderRadius = '4px';
      this.controlsGuide.style.zIndex = '1000';
      this.controlsGuide.style.display = 'none'; // Hidden by default
      this.controlsGuide.innerHTML = `
        <strong>Controls:</strong><br>
        W/Arrow Up - Move Forward<br>
        S/Arrow Down - Move Backward<br>
        A/Arrow Left - Move Left<br>
        D/Arrow Right - Move Right<br>
        Space - Use Current Spell<br>
        Q - Flip Page Left<br>
        E - Flip Page Right<br>
        V - Toggle Debug Raycast<br>
        Mouse - Look Around<br>
        <strong>Mobile Controls:</strong><br>
        Touch Drag - Look Around
      `;
    }

    this.controlsGuide.id = 'fp-controls-guide';
    this.container.appendChild(this.controlsGuide);
    console.log('Controls guide added to container');

    // Create God Mode indicator
    this.godModeIndicator = document.createElement('div');
    this.godModeIndicator.style.position = 'fixed';
    this.godModeIndicator.style.top = '100px'; // Position below rune mode indicator
    this.godModeIndicator.style.left = '50%';
    this.godModeIndicator.style.transform = 'translateX(-50%)';
    this.godModeIndicator.style.padding = '10px 20px';
    this.godModeIndicator.style.backgroundColor = 'rgba(255, 215, 0, 0.8)'; // Gold color
    this.godModeIndicator.style.color = 'black';
    this.godModeIndicator.style.fontSize = '18px';
    this.godModeIndicator.style.fontWeight = 'bold';
    this.godModeIndicator.style.borderRadius = '6px';
    this.godModeIndicator.style.zIndex = '2000';
    this.godModeIndicator.style.display = 'none'; // Hidden by default
    this.godModeIndicator.style.boxShadow = '0 0 15px rgba(255, 215, 0, 0.9)';
    this.godModeIndicator.textContent = '🚀 GOD MODE ACTIVE 🚀';
    this.godModeIndicator.id = 'god-mode-indicator';

    // Add to document.body
    document.body.appendChild(this.godModeIndicator);

    // Create debug visualization canvas for touch paths
    this.debugCanvas = document.createElement('canvas');
    this.debugCanvas.style.position = 'fixed';
    this.debugCanvas.style.bottom = '20px';
    this.debugCanvas.style.right = '20px';
    this.debugCanvas.style.width = '300px';
    this.debugCanvas.style.height = '300px';
    this.debugCanvas.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    this.debugCanvas.style.borderRadius = '8px';
    this.debugCanvas.style.zIndex = '1999';
    this.debugCanvas.style.display = 'none'; // Hidden by default
    this.debugCanvas.style.border = '2px solid rgba(255, 255, 255, 0.5)';
    this.debugCanvas.width = 300; // Actual canvas resolution
    this.debugCanvas.height = 300;
    this.debugCanvas.id = 'rune-debug-canvas';

    // Add debug label
    const debugLabel = document.createElement('div');
    debugLabel.style.position = 'absolute';
    debugLabel.style.top = '-30px';
    debugLabel.style.left = '0';
    debugLabel.style.width = '100%';
    debugLabel.style.textAlign = 'center';
    debugLabel.style.color = 'white';
    debugLabel.style.fontFamily = 'Arial, sans-serif';
    debugLabel.style.fontSize = '14px';
    debugLabel.style.fontWeight = 'bold';
    debugLabel.textContent = 'Touch Path Debug';
    this.debugCanvas.appendChild(debugLabel);

    // Add to document.body
    document.body.appendChild(this.debugCanvas);

    // Get the drawing context
    this.debugContext = this.debugCanvas.getContext('2d');
  }

  /**
   * Create virtual joysticks for mobile controls
   */
  createMobileJoysticks() {
    const joystickStyle = {
      position: 'fixed',
      width: '100px',
      height: '100px',
      borderRadius: '50%',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      zIndex: '999'
    };

    const stickStyle = {
      position: 'absolute',
      width: '40px',
      height: '40px',
      borderRadius: '50%',
      backgroundColor: 'rgba(255, 255, 255, 0.5)',
      top: '30px',
      left: '30px',
      transform: 'translate(-50%, -50%)',
      zIndex: '1000'
    };

    // Create left joystick (movement)
    const leftJoystick = document.createElement('div');
    Object.assign(leftJoystick.style, joystickStyle);
    leftJoystick.style.bottom = '30px';
    leftJoystick.style.left = '30px';

    const leftStick = document.createElement('div');
    Object.assign(leftStick.style, stickStyle);
    leftJoystick.appendChild(leftStick);

    // Create right joystick (camera) - invisible but functionally active
    const rightJoystick = document.createElement('div');
    Object.assign(rightJoystick.style, joystickStyle);
    rightJoystick.style.bottom = '30px';
    rightJoystick.style.right = '30px';
    rightJoystick.style.backgroundColor = 'rgba(0, 0, 0, 0)'; // Make it completely transparent

    const rightStick = document.createElement('div');
    Object.assign(rightStick.style, stickStyle);
    rightStick.style.backgroundColor = 'rgba(0, 0, 0, 0)'; // Make stick transparent too
    rightJoystick.appendChild(rightStick);

    // Store references
    this.mobileControls.leftJoystick.element = leftJoystick;
    this.mobileControls.leftJoystick.stick = leftStick;
    this.mobileControls.rightJoystick.element = rightJoystick;
    this.mobileControls.rightJoystick.stick = rightStick;

    // Add to document (initially hidden)
    leftJoystick.style.display = 'none';
    // Right joystick is always functionally active but visually hidden
    rightJoystick.style.display = 'none';
    rightJoystick.style.pointerEvents = 'none'; // Ensure it doesn't interfere with touches

    document.body.appendChild(leftJoystick);
    document.body.appendChild(rightJoystick);

    console.log('Mobile joysticks created');
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    document.addEventListener('keydown', this.onKeyDown.bind(this), false);
    document.addEventListener('keyup', this.onKeyUp.bind(this), false);
    document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
    this.container.addEventListener('click', this.requestPointerLock.bind(this), false);

    // Subscribe to touch data events from the mobile device
    this.eventBus.on('sensor:touch-updated', this.onTouchUpdate.bind(this));

    // If on mobile, set up the touch event handlers for virtual joysticks and swipes
    if (this.isMobileDevice) {
      this.setupMobileTouchHandlers();
    }

    // Listen for mobile connection/disconnection events
    this.eventBus.on('mobile:joined', () => {
      // Enable first person mode when mobile connects
      if (!this.enabled) {
        this.toggleFirstPersonMode();
      }
    });

    this.eventBus.on('mobile:disconnected', () => {
      // Disable first person mode when mobile disconnects
      if (this.enabled) {
        this.toggleFirstPersonMode();
      }
    });


    // Listen for God Mode toggle events
    this.eventBus.on('debug:toggle-god-mode', (data) => {
      this.toggleGodMode(data.enabled);
    });

    // Provide camera access for spell systems
    this.eventBus.on('camera:get-position', (callback) => {
      if (typeof callback === 'function' && this.camera) {
        callback(this.camera.position.clone());
      }
    });

    this.eventBus.on('camera:get-direction', (callback) => {
      if (typeof callback === 'function' && this.camera) {
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.camera.quaternion);
        callback(direction);
      }
    });
  }

  /**
   * Setup touch event handlers for mobile controls (joysticks and swipes)
   */
  setupMobileTouchHandlers() {
    if (!this.container) return;

    const gameContainer = this.container;

    // Handle touch start
    gameContainer.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;

      const touch = e.touches[0];
      const touchX = touch.clientX;
      const touchY = touch.clientY;

      // Check which half of the screen was touched for swipe detection
      if (touchX < window.innerWidth / 2) {
        // Left half - movement joystick or swipe
        const leftJoystick = this.mobileControls.leftJoystick;

        // Store touch start for swipe detection
        this.mobileControls.swipe.startX = touchX;
        this.mobileControls.swipe.startY = touchY;
        this.mobileControls.swipe.startTime = Date.now();

        // Activate left joystick
        leftJoystick.active = true;
        leftJoystick.startX = touchX;
        leftJoystick.startY = touchY;
        leftJoystick.currentX = touchX;
        leftJoystick.currentY = touchY;

        // Position and show joystick at touch location
        if (leftJoystick.element) {
          leftJoystick.element.style.display = 'block';
          leftJoystick.element.style.left = (touchX - leftJoystick.radius) + 'px';
          leftJoystick.element.style.top = (touchY - leftJoystick.radius) + 'px';
          leftJoystick.stick.style.left = '50%';
          leftJoystick.stick.style.top = '50%';
        }
      } else {
        // Right half - camera joystick
        const rightJoystick = this.mobileControls.rightJoystick;

        // Activate right joystick
        rightJoystick.active = true;
        rightJoystick.startX = touchX;
        rightJoystick.startY = touchY;
        rightJoystick.currentX = touchX;
        rightJoystick.currentY = touchY;

        // Right joystick is functionally active but visually hidden
        // We still track position internally but don't show the joystick UI
        if (rightJoystick.element) {
          // Keep joystick hidden
          rightJoystick.element.style.display = 'none';
          // Still update internal position for tracking
          rightJoystick.element.style.left = (touchX - rightJoystick.radius) + 'px';
          rightJoystick.element.style.top = (touchY - rightJoystick.radius) + 'px';
        }
      }

      // Prevent default to avoid scrolling
      e.preventDefault();
    }, { passive: false });

    // Handle touch move
    gameContainer.addEventListener('touchmove', (e) => {
      if (!this.enabled) return;

      // Process all active touches
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i];
        const touchX = touch.clientX;
        const touchY = touch.clientY;

        // Check which joystick is active based on touch position
        if (touchX < window.innerWidth / 2) {
          // Left joystick - movement
          const leftJoystick = this.mobileControls.leftJoystick;

          if (leftJoystick.active) {
            leftJoystick.currentX = touchX;
            leftJoystick.currentY = touchY;

            // Calculate joystick position
            this.updateJoystickPosition(leftJoystick);

            // Update movement based on joystick position
            const deltaX = (leftJoystick.currentX - leftJoystick.startX) / leftJoystick.maxDistance;
            const deltaY = (leftJoystick.currentY - leftJoystick.startY) / leftJoystick.maxDistance;

            // Set movement direction based on joystick
            this.moveRight = deltaX > -0.2; // Right
            this.moveLeft = deltaX < 0.2;   // Left
            this.moveBackward = deltaY > 0.2; // Down
            this.moveForward = deltaY < -0.2; // Up
          }
        } else {
          // Right joystick - camera rotation
          const rightJoystick = this.mobileControls.rightJoystick;

          if (rightJoystick.active) {
            rightJoystick.currentX = touchX;
            rightJoystick.currentY = touchY;

            // No need to update visual position for right joystick since it's hidden

            // Calculate camera rotation based on joystick position
            const deltaX = (rightJoystick.currentX - rightJoystick.startX) / 2;
            const deltaY = (rightJoystick.currentY - rightJoystick.startY) / 2;

            if (Math.abs(deltaX) > 0.1 || Math.abs(deltaY) > 0.1) {
              // Update camera rotation
              const euler = new THREE.Euler(0, 0, 0, 'YXZ');
              euler.setFromQuaternion(this.camera.quaternion);

              // Apply yaw (left/right) rotation from X movement
              euler.y -= deltaX * LOOK_SPEED * 5;

              // Apply pitch (up/down) rotation from Y movement
              euler.x -= deltaY * LOOK_SPEED * 5;

              // Clamp vertical rotation to avoid flipping
              euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));

              // Update camera orientation
              this.camera.quaternion.setFromEuler(euler);

              // Reset joystick start position to current position to avoid continuous rotation
              rightJoystick.startX = touchX;
              rightJoystick.startY = touchY;
            }
          }
        }
      }

      // Prevent default to avoid scrolling
      e.preventDefault();
    }, { passive: false });

    // Handle touch end
    gameContainer.addEventListener('touchend', (e) => {
      if (!this.enabled) return;

      // Check if all touches are ended
      if (e.touches.length === 0) {
        const leftJoystick = this.mobileControls.leftJoystick;
        const rightJoystick = this.mobileControls.rightJoystick;
        const swipe = this.mobileControls.swipe;

        // Check for swipe gestures
        if (leftJoystick.active) {
          // Set end position for swipe detection
          swipe.endX = leftJoystick.currentX;
          swipe.endY = leftJoystick.currentY;

          // Calculate swipe distance and direction
          const deltaX = swipe.endX - swipe.startX;
          const deltaY = swipe.endY - swipe.startY;
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          const duration = Date.now() - swipe.startTime;

          // Check if this is a valid swipe
          if (distance > swipe.minDistance && duration < swipe.maxTime) {
            // Determine swipe direction
            const absX = Math.abs(deltaX);
            const absY = Math.abs(deltaY);

            if (absX > absY) {
              // Horizontal swipe - flip pages
              if (deltaX > 0) {
                // Swipe right - flip page right (E key)
                this.eventBus.emit('weapon:flip-right');
                console.log('Swipe right detected - flipping page right');
              } else {
                // Swipe left - flip page left (Q key)
                this.eventBus.emit('weapon:flip-left');
                console.log('Swipe left detected - flipping page left');
              }
            } else {
              // Vertical swipe
              if (deltaY < 0) {
                // Swipe up - cast spell (Space key)
                this.eventBus.emit('weapon:use');
                console.log('Swipe up detected - casting spell');
              }
            }
          }
        }

        // Reset joysticks
        if (leftJoystick.active) {
          leftJoystick.active = false;
          if (leftJoystick.element) {
            leftJoystick.element.style.display = 'none';
          }
          // Reset movement flags
          this.moveForward = false;
          this.moveBackward = false;
          this.moveLeft = false;
          this.moveRight = false;
        }

        if (rightJoystick.active) {
          rightJoystick.active = false;
          if (rightJoystick.element) {
            rightJoystick.element.style.display = 'none';
          }
        }
      }

      // Prevent default
      e.preventDefault();
    }, { passive: false });

    // For iOS devices, add specific handler to prevent scrolling
    document.addEventListener('gesturestart', (e) => {
      if (this.enabled) {
        e.preventDefault();
      }
    }, { passive: false });
  }

  /**
   * Update joystick position based on touch movement
   * @param {Object} joystick - The joystick object to update
   */
  updateJoystickPosition(joystick) {
    if (!joystick.element || !joystick.stick) return;

    // Calculate distance from center
    const deltaX = joystick.currentX - joystick.startX;
    const deltaY = joystick.currentY - joystick.startY;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

    // Calculate normalized position within maxDistance
    const limitedDistance = Math.min(distance, joystick.maxDistance);
    const angle = Math.atan2(deltaY, deltaX);

    // Calculate stick position
    const stickX = 50 + (Math.cos(angle) * limitedDistance * 50 / joystick.radius);
    const stickY = 50 + (Math.sin(angle) * limitedDistance * 50 / joystick.radius);

    // Update stick position
    joystick.stick.style.left = stickX + '%';
    joystick.stick.style.top = stickY + '%';
  }

  /**
   * Toggle God Mode
   * @param {boolean} enabled - Whether God Mode should be enabled
   */
  toggleGodMode(enabled) {
    // Set God Mode state
    this.godMode = enabled !== undefined ? enabled : !this.godMode;

    // Update UI indicator
    if (this.godModeIndicator) {
      this.godModeIndicator.style.display = this.godMode ? 'block' : 'none';
    }

    // Check if we're on a mobile device
    const isMobileDevice = this.checkIsMobileDevice();

    // Update controls guide with God Mode instructions if active
    if (this.controlsGuide) {
      if (isMobileDevice) {
        // Mobile-specific controls
        if (this.godMode) {
          // God mode mobile controls
          this.controlsGuide.innerHTML = `
            <strong style="color:#ffd700">GOD MODE CONTROLS:</strong><br>
            • Swipe - Look Around<br>
            • Tap - Cast Spell<br>
            • Tilt Phone - Navigate<br>
            <span style="color:#ffd700">⚡ Flying Enabled ⚡</span>
          `;
        } else {
          // Normal mobile controls
          this.controlsGuide.innerHTML = `
            <strong style="color:#4fc3f7">Mobile Controls:</strong><br>
            • Swipe - Look Around<br>
            • Tap - Cast Spell<br>
            • Tilt Phone - Aim<br>
            <strong>Play on desktop for full experience</strong>
          `;
        }
      } else {
        // Desktop controls
        if (this.godMode) {
          // Update controls guide to include God Mode keys
          this.controlsGuide.innerHTML = `
            <strong>Controls (GOD MODE):</strong><br>
            W/Arrow Up - Move Forward<br>
            S/Arrow Down - Move Backward<br>
            A/Arrow Left - Move Left<br>
            D/Arrow Right - Move Right<br>
            Q - Move Up<br>
            E - Move Down<br>
            Space - Cast Current Page Spell<br>
            V - Toggle Debug Raycast<br>
            Mouse - Look Around<br>
            <strong>Mobile Controls:</strong><br>
            Touch Drag - Look Around / Draw Runes
          `;
        } else {
          // Restore normal controls guide
          this.controlsGuide.innerHTML = `
            <strong>Controls:</strong><br>
            W/Arrow Up - Move Forward<br>
            S/Arrow Down - Move Backward<br>
            A/Arrow Left - Move Left<br>
            D/Arrow Right - Move Right<br>
            Space - Gravity Gun (pickup/drop objects)<br>
            Q - Flip Page Left<br>
            E - Flip Page Right<br>
            T - Spawn Random Object<br>
            V - Toggle Debug Raycast<br>
            Mouse - Look Around<br>
            <strong>Mobile Controls:</strong><br>
            Touch Drag - Look Around / Draw Runes
          `;
        }
      }
    }

    console.log(`God Mode ${this.godMode ? 'enabled' : 'disabled'}`);
  }

  /**
   * Toggle first-person mode
   */
  toggleFirstPersonMode() {
    this.enabled = !this.enabled;

    // Check if we're on a mobile device
    const isMobileDevice = this.checkIsMobileDevice();

    if (this.enabled) {
      // Enable first-person mode
      this.sceneManager.setFirstPersonMode(true);

      // Try to get a spawn point from the environment
      if (this.sceneManager.environment &&
        typeof this.sceneManager.environment.getRandomSpawnPoint === 'function') {
        const spawnPoint = this.sceneManager.environment.getRandomSpawnPoint();

        // Set position from spawn point
        this.camera.position.set(
          spawnPoint.x,
          PLAYER_HEIGHT, // Use standard player height
          spawnPoint.z
        );

        // If spawn point includes rotation, apply it
        if (spawnPoint.rotation !== undefined) {
          const euler = new THREE.Euler(0, spawnPoint.rotation, 0, 'YXZ');
          this.camera.quaternion.setFromEuler(euler);
        }
      } else {
        // Default position if no spawn points available
        this.camera.position.y = PLAYER_HEIGHT;
      }

      // Always show controls guide when first-person mode is enabled
      this.controlsGuide.style.display = 'block';

      // Only request pointer lock on desktop - not needed on mobile
      if (!isMobileDevice) {
        this.requestPointerLock();
      }

      // Apply additional mobile-specific UI tweaks if on mobile
      if (isMobileDevice) {
        // Show virtual joysticks if on mobile
        if (this.mobileControls.leftJoystick.element) {
          // Position joysticks at default locations but keep them hidden until touched
          const leftJoystick = this.mobileControls.leftJoystick;
          const rightJoystick = this.mobileControls.rightJoystick;

          // When in first-person mode, make sure joysticks are ready for touch activation
          leftJoystick.element.style.bottom = '30px';
          leftJoystick.element.style.left = '30px';
          leftJoystick.element.style.top = 'auto';
          leftJoystick.element.style.display = 'none';

          rightJoystick.element.style.bottom = '30px';
          rightJoystick.element.style.right = '30px';
          rightJoystick.element.style.top = 'auto';
          rightJoystick.element.style.display = 'none';

          // Reset joystick positions
          leftJoystick.stick.style.left = '50%';
          leftJoystick.stick.style.top = '50%';
          rightJoystick.stick.style.left = '50%';
          rightJoystick.stick.style.top = '50%';
        }

        // Make the controlsGuide fade out after a few seconds
        setTimeout(() => {
          // Add transition for smooth fade
          if (this.controlsGuide) {
            this.controlsGuide.style.transition = 'opacity 1s ease-in-out';
            this.controlsGuide.style.opacity = '0.5';
          }
        }, 5000);

        // Add touch event to toggle controls guide visibility on tap
        this.controlsGuide.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent click from passing through
          // Toggle opacity
          this.controlsGuide.style.opacity =
            this.controlsGuide.style.opacity === '1' ? '0.5' : '1';
        });
      }

      this.eventBus.emit('firstperson:enabled');
    } else {
      // Disable first-person mode
      this.sceneManager.setFirstPersonMode(false);
      this.controlsGuide.style.display = 'none';

      // Only need to exit pointer lock on desktop
      if (!isMobileDevice) {
        document.exitPointerLock();
      }

      this.eventBus.emit('firstperson:disabled');
    }
  }

  /**
   * Update first-person controls
   * @param {number} delta - Time delta in seconds
   */
  update(delta) {
    if (!this.enabled) return;

    // Apply damping to slow down movement
    this.velocity.x -= this.velocity.x * 10.0 * delta;
    this.velocity.z -= this.velocity.z * 10.0 * delta;

    // God Mode: Add vertical movement
    if (this.godMode) {
      // Add vertical velocity component
      if (!this.velocity.y) this.velocity.y = 0;
      this.velocity.y -= this.velocity.y * 10.0 * delta;
    }

    // Set movement direction based on key states
    this.direction.z = Number(this.moveForward) - Number(this.moveBackward);
    this.direction.x = Number(this.moveLeft) - Number(this.moveRight);

    // God Mode: Add vertical direction
    if (this.godMode) {
      this.direction.y = Number(this.moveUp) - Number(this.moveDown);
    } else {
      this.direction.y = 0;
    }

    this.direction.normalize(); // Normalize for consistent movement speed

    // Move in the direction the camera is facing
    const movementSpeed = this.godMode ? MOVE_SPEED * 1.5 : MOVE_SPEED; // Faster in God Mode

    if (this.moveForward || this.moveBackward)
      this.velocity.z -= this.direction.z * movementSpeed * delta * 100;
    if (this.moveLeft || this.moveRight)
      this.velocity.x -= this.direction.x * movementSpeed * delta * 100;
    if (this.godMode && (this.moveUp || this.moveDown))
      this.velocity.y -= this.direction.y * movementSpeed * delta * 100;

    // Calculate new camera position based on velocity
    const cameraDirection = new THREE.Vector3();
    this.camera.getWorldDirection(cameraDirection);

    if (this.godMode) {
      // God Mode: Full 3D movement along camera direction
      const forward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
      const right = new THREE.Vector3(forward.z, 0, -forward.x);
      const up = new THREE.Vector3(0, 1, 0);

      // Apply movement
      this.camera.position.add(forward.multiplyScalar(-this.velocity.z * delta));
      this.camera.position.add(right.multiplyScalar(-this.velocity.x * delta));
      this.camera.position.add(up.multiplyScalar(this.velocity.y * delta));

      // No height constraint in God Mode
    } else {
      // Normal mode: Project movement onto the XZ plane (horizontal movement only)
      const forward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
      const right = new THREE.Vector3(forward.z, 0, -forward.x);

      // Apply movement
      this.camera.position.add(forward.multiplyScalar(-this.velocity.z * delta));
      this.camera.position.add(right.multiplyScalar(-this.velocity.x * delta));

      // Maintain player height in normal mode
      this.camera.position.y = PLAYER_HEIGHT;
    }

    // Determine if player is moving for weapon bob effect
    const isMoving = this.moveForward || this.moveBackward || this.moveLeft || this.moveRight ||
      (this.godMode && (this.moveUp || this.moveDown));
  }


  /**
   * Handle keydown events
   * @param {KeyboardEvent} event - Keyboard event
   */
  onKeyDown(event) {
    if (!this.enabled) return;

    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveForward = true;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft = true;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveBackward = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight = true;
        break;
      case 'KeyQ':
        // In God Mode: move up, otherwise flip spellbook page left
        if (this.godMode) {
          this.moveUp = true;
        } else if (!event.repeat) {
          this.eventBus.emit('weapon:flip-left');
        }
        break;
      case 'KeyE':
        // In God Mode: move down, otherwise flip spellbook page right
        if (this.godMode) {
          this.moveDown = true;
        } else if (!event.repeat) {
          this.eventBus.emit('weapon:flip-right');
        }
        break;
        // ShiftLeft case removed - Rune Mode no longer supported
        break;
    }
  }

  /**
   * Handle keyup events
   * @param {KeyboardEvent} event - Keyboard event
   */
  onKeyUp(event) {
    if (!this.enabled) return;

    switch (event.code) {
      case 'ArrowUp':
      case 'KeyW':
        this.moveForward = false;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.moveLeft = false;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.moveBackward = false;
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.moveRight = false;
        break;
      case 'KeyQ':
        if (this.godMode) {
          this.moveUp = false;
        }
        break;
      case 'KeyE':
        if (this.godMode) {
          this.moveDown = false;
        }
        break;
    }
  }

  /**
   * Handle mouse movement
   * @param {MouseEvent} event - Mouse event
   */
  onMouseMove(event) {
    if (!this.enabled || !document.pointerLockElement) return;

    const movementX = event.movementX || 0;
    const movementY = event.movementY || 0;

    // Rotate camera based on mouse movement
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(this.camera.quaternion);

    // Apply pitch (up/down) rotation - limit to avoid flipping
    euler.x -= movementY * LOOK_SPEED;
    euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));

    // Apply yaw (left/right) rotation
    euler.y -= movementX * LOOK_SPEED;

    this.camera.quaternion.setFromEuler(euler);
  }

  /**
   * Request pointer lock for mouse control
   */
  requestPointerLock() {
    if (!this.enabled) return;

    this.container.requestPointerLock = this.container.requestPointerLock ||
      this.container.mozRequestPointerLock ||
      this.container.webkitRequestPointerLock;

    if (this.container.requestPointerLock) {
      this.container.requestPointerLock();
    }
  }

  /**
   * Check if first-person mode is enabled
   * @returns {boolean} First-person mode status
   */
  isEnabled() {
    return this.enabled;
  }


  /**
   * Handle touch updates from the mobile device
   * @param {Object} touchData - Touch data from mobile device
   */
  /**
   * Handle touch updates from the mobile device
   * @param {Object} touchData - Touch data from mobile device
   */
  onTouchUpdate(touchData) {
    if (!this.enabled) return;

    // Only process touch events when active
    if (touchData.active) {
      // If this is the first touch event, store the initial position
      if (!this.touchActive) {
        this.lastTouchX = touchData.x;
        this.lastTouchY = touchData.y;
        this.touchActive = true;
        return;
      }

      // Calculate touch movement delta (normalized 0-1 coordinates)
      const deltaX = (touchData.x - this.lastTouchX) * this.touchSensitivity;
      const deltaY = (touchData.y - this.lastTouchY) * this.touchSensitivity;

      // Update camera rotation - similar to mouse movement
      if (Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) {
        // Get current camera orientation
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(this.camera.quaternion);

        // Apply yaw (left/right) rotation from X movement
        euler.y -= deltaX;

        // Apply pitch (up/down) rotation from Y movement
        euler.x -= deltaY;

        // Clamp vertical rotation to avoid flipping
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));

        // Update camera orientation
        this.camera.quaternion.setFromEuler(euler);
      }

      // Update last touch position
      this.lastTouchX = touchData.x;
      this.lastTouchY = touchData.y;
    } else {
      // Touch ended
      this.touchActive = false;
    }
  }


  /**
   * Check if the current device is a mobile device not using the mobile endpoint
   * @returns {boolean} Whether the device is a mobile device
   */
  checkIsMobileDevice() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;

    // Detect phones
    const mobileRegex = /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i;

    // Detect tablets
    const tabletRegex = /android|ipad|playbook|silk/i;

    // Check if not accessing via the mobile-specific endpoint
    const isMobileEndpoint = window.location.pathname.includes('/mobile');

    return (mobileRegex.test(userAgent) || tabletRegex.test(userAgent)) && !isMobileEndpoint;
  }

  /**
   * Clean up resources and event listeners
   */
  dispose() {
    // Remove event listeners
    document.removeEventListener('keydown', this.onKeyDown.bind(this));
    document.removeEventListener('keyup', this.onKeyUp.bind(this));
    document.removeEventListener('mousemove', this.onMouseMove.bind(this));

    // Dispose of UI elements
    if (this.controlsGuide && this.controlsGuide.parentNode) {
      this.controlsGuide.parentNode.removeChild(this.controlsGuide);
    }

    if (this.godModeIndicator && this.godModeIndicator.parentNode) {
      this.godModeIndicator.parentNode.removeChild(this.godModeIndicator);
    }

    // Clean up mobile controls
    if (this.isMobileDevice) {
      // Remove joystick elements
      const leftJoystick = this.mobileControls.leftJoystick;
      const rightJoystick = this.mobileControls.rightJoystick;

      if (leftJoystick.element && leftJoystick.element.parentNode) {
        leftJoystick.element.parentNode.removeChild(leftJoystick.element);
      }

      if (rightJoystick.element && rightJoystick.element.parentNode) {
        rightJoystick.element.parentNode.removeChild(rightJoystick.element);
      }
    }
  }
}
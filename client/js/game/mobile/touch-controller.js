/**
 * Handles touch input for mobile players with dual joystick controls and rune drawing
 */
export class TouchController {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {HTMLElement} element - DOM element to capture touch events from
   */
  constructor(eventBus, element) {
    this.eventBus = eventBus;
    this.element = element;
    this.enabled = false;
    
    // Rune mode state
    this.runeMode = false;
    
    // Touch event handlers
    this.touchStartHandler = this.onTouchStart.bind(this);
    this.touchMoveHandler = this.onTouchMove.bind(this);
    this.touchEndHandler = this.onTouchEnd.bind(this);
    
    // Virtual joysticks
    this.leftJoystick = { active: false, id: null, startX: 0, startY: 0, currentX: 0, currentY: 0, deltaX: 0, deltaY: 0 };
    this.rightJoystick = { active: false, id: null, startX: 0, startY: 0, currentX: 0, currentY: 0, deltaX: 0, deltaY: 0 };
    
    // Action buttons state
    this.actionButtonActive = false;
    this.actionButtonId = null;
    
    // Visual elements
    this.joystickElements = { left: null, right: null, leftIndicator: null, rightIndicator: null };
    this.actionButtonElement = null;
    
    // Screen division - left half for movement, right half for looking
    this.screenDivider = 0.5;
    
    // Flags for movement and camera controls
    this.isMoving = false;
    this.isTurning = false;
    
    // Rune drawing variables
    this.runeCanvas = null;
    this.runeContext = null;
    this.touchPath = [];
    
    // Control options
    this.options = {
      joystickSize: 120,
      joystickColor: 'rgba(255, 255, 255, 0.2)',
      indicatorColor: 'rgba(255, 255, 255, 0.8)',
      actionButtonColor: 'rgba(255, 50, 50, 0.7)',
      actionButtonActiveColor: 'rgba(255, 50, 50, 0.9)',
      actionButtonSize: 70,
      useGyroWhenAvailable: true,
      // Rune options
      runeStrokeColor: 'rgba(147, 112, 219, 0.8)', // Light purple
      runeStrokeWidth: 8,
      runeGlowColor: 'rgba(186, 85, 211, 0.5)', // Medium orchid with transparency
      runeIndicatorSize: '18px',
      runeIndicatorColor: 'rgba(138, 43, 226, 0.9)' // BlueViolet
    };
    
    // Create UI elements for controls
    this.createControlElements();
    
    // Setup event listeners for rune mode
    this.setupEventListeners();
  }
  
  /**
   * Set up event listeners
   */
  setupEventListeners() {
    if (this.eventBus) {
      // Listen for rune mode toggle events
      this.eventBus.on('runeMode:toggled', this.handleRuneModeToggled.bind(this));
      
      // Listen for rune touch events from desktop
      this.eventBus.on('runeMode:touchStart', this.handleRuneTouchStart.bind(this));
      this.eventBus.on('runeMode:touchMove', this.handleRuneTouchMove.bind(this));
      this.eventBus.on('runeMode:touchEnd', this.handleRuneTouchEnd.bind(this));
    }
  }
  
  /**
   * Handle rune mode toggled event
   * @param {Object} data - Event data
   */
  handleRuneModeToggled(data) {
    this.setRuneMode(data.active);
  }
  
  /**
   * Set rune mode active state
   * @param {boolean} active - Whether rune mode is active
   */
  setRuneMode(active) {
    this.runeMode = active;
    
    // Show/hide appropriate UI elements
    if (this.runeCanvas) {
      this.runeCanvas.style.display = active ? 'block' : 'none';
    }
    
    if (this.runeModeIndicator) {
      this.runeModeIndicator.style.display = active ? 'block' : 'none';
    }
    
    // Clear any existing touch paths
    this.clearRuneCanvas();
    this.touchPath = [];
    
    console.log(`Touch controller: Rune mode ${active ? 'activated' : 'deactivated'}`);
  }
  
  /**
   * Create UI elements for virtual joysticks and action buttons
   */
  createControlElements() {
    // Create container for joysticks
    const container = document.createElement('div');
    container.id = 'touchControlsContainer';
    container.style.position = 'absolute';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '1000';
    
    // Left joystick
    const leftJoystick = document.createElement('div');
    leftJoystick.className = 'joystick left-joystick';
    leftJoystick.style.position = 'absolute';
    leftJoystick.style.bottom = '100px';
    leftJoystick.style.left = '100px';
    leftJoystick.style.width = `${this.options.joystickSize}px`;
    leftJoystick.style.height = `${this.options.joystickSize}px`;
    leftJoystick.style.borderRadius = '50%';
    leftJoystick.style.background = this.options.joystickColor;
    leftJoystick.style.opacity = '0';
    leftJoystick.style.transition = 'opacity 0.3s';
    
    // Left joystick indicator (the movable part)
    const leftIndicator = document.createElement('div');
    leftIndicator.className = 'joystick-indicator';
    leftIndicator.style.position = 'absolute';
    leftIndicator.style.top = '50%';
    leftIndicator.style.left = '50%';
    leftIndicator.style.transform = 'translate(-50%, -50%)';
    leftIndicator.style.width = `${this.options.joystickSize * 0.4}px`;
    leftIndicator.style.height = `${this.options.joystickSize * 0.4}px`;
    leftIndicator.style.borderRadius = '50%';
    leftIndicator.style.background = this.options.indicatorColor;
    
    leftJoystick.appendChild(leftIndicator);
    
    // Right joystick
    const rightJoystick = document.createElement('div');
    rightJoystick.className = 'joystick right-joystick';
    rightJoystick.style.position = 'absolute';
    rightJoystick.style.bottom = '100px';
    rightJoystick.style.right = '100px';
    rightJoystick.style.width = `${this.options.joystickSize}px`;
    rightJoystick.style.height = `${this.options.joystickSize}px`;
    rightJoystick.style.borderRadius = '50%';
    rightJoystick.style.background = this.options.joystickColor;
    rightJoystick.style.opacity = '0';
    rightJoystick.style.transition = 'opacity 0.3s';
    
    // Right joystick indicator
    const rightIndicator = document.createElement('div');
    rightIndicator.className = 'joystick-indicator';
    rightIndicator.style.position = 'absolute';
    rightIndicator.style.top = '50%';
    rightIndicator.style.left = '50%';
    rightIndicator.style.transform = 'translate(-50%, -50%)';
    rightIndicator.style.width = `${this.options.joystickSize * 0.4}px`;
    rightIndicator.style.height = `${this.options.joystickSize * 0.4}px`;
    rightIndicator.style.borderRadius = '50%';
    rightIndicator.style.background = this.options.indicatorColor;
    
    rightJoystick.appendChild(rightIndicator);
    
    // Action button
    const actionButton = document.createElement('div');
    actionButton.className = 'action-button';
    actionButton.style.position = 'absolute';
    actionButton.style.bottom = '140px';
    actionButton.style.right = '60px';
    actionButton.style.width = `${this.options.actionButtonSize}px`;
    actionButton.style.height = `${this.options.actionButtonSize}px`;
    actionButton.style.borderRadius = '50%';
    actionButton.style.background = this.options.actionButtonColor;
    actionButton.style.opacity = '0.7';
    actionButton.style.transition = 'opacity 0.2s, transform 0.2s';
    actionButton.style.display = 'flex';
    actionButton.style.alignItems = 'center';
    actionButton.style.justifyContent = 'center';
    actionButton.style.color = 'white';
    actionButton.style.fontWeight = 'bold';
    actionButton.style.fontSize = '18px';
    actionButton.innerHTML = 'FIRE';
    
    // Create rune drawing canvas
    const runeCanvas = document.createElement('canvas');
    runeCanvas.id = 'runeDrawingCanvas';
    runeCanvas.style.position = 'absolute';
    runeCanvas.style.top = '0';
    runeCanvas.style.left = '0';
    runeCanvas.style.width = '100%';
    runeCanvas.style.height = '100%';
    runeCanvas.style.pointerEvents = 'none';
    runeCanvas.style.zIndex = '1001';
    runeCanvas.style.display = 'none'; // Initially hidden
    
    // Size the canvas to match the display size for proper rendering
    const updateCanvasSize = () => {
      const parentWidth = this.element.parentElement ? 
        this.element.parentElement.clientWidth : window.innerWidth;
      const parentHeight = this.element.parentElement ? 
        this.element.parentElement.clientHeight : window.innerHeight;
      
      runeCanvas.width = parentWidth;
      runeCanvas.height = parentHeight;
      
      // Reset any previous drawing context settings
      if (this.runeContext) {
        this.setupRuneContext();
      }
    };
    
    // Initialize canvas with correct size
    updateCanvasSize();
    
    // Get 2D context for drawing
    this.runeContext = runeCanvas.getContext('2d');
    this.setupRuneContext();
    
    // Create rune mode visual indicator
    const runeModeIndicator = document.createElement('div');
    runeModeIndicator.id = 'runeModeIndicator';
    runeModeIndicator.style.position = 'absolute';
    runeModeIndicator.style.top = '20px';
    runeModeIndicator.style.left = '50%';
    runeModeIndicator.style.transform = 'translateX(-50%)';
    runeModeIndicator.style.padding = '8px 16px';
    runeModeIndicator.style.backgroundColor = 'rgba(138, 43, 226, 0.7)';
    runeModeIndicator.style.color = 'white';
    runeModeIndicator.style.fontSize = this.options.runeIndicatorSize;
    runeModeIndicator.style.fontWeight = 'bold';
    runeModeIndicator.style.borderRadius = '20px';
    runeModeIndicator.style.boxShadow = '0 0 10px rgba(128, 0, 128, 0.7)';
    runeModeIndicator.style.textAlign = 'center';
    runeModeIndicator.style.zIndex = '1002';
    runeModeIndicator.style.display = 'none'; // Initially hidden
    runeModeIndicator.textContent = 'RUNE MODE';
    
    // Setup animated glow effect for rune mode indicator
    this.setupRuneIndicatorAnimation(runeModeIndicator);
    
    // Add elements to container
    container.appendChild(leftJoystick);
    container.appendChild(rightJoystick);
    container.appendChild(actionButton);
    container.appendChild(runeCanvas);
    container.appendChild(runeModeIndicator);
    
    // Store references
    this.joystickElements.left = leftJoystick;
    this.joystickElements.right = rightJoystick;
    this.joystickElements.leftIndicator = leftIndicator;
    this.joystickElements.rightIndicator = rightIndicator;
    this.actionButtonElement = actionButton;
    this.runeCanvas = runeCanvas;
    this.runeModeIndicator = runeModeIndicator;
    
    // Add container to the element
    this.element.parentElement.appendChild(container);
    this.controlsContainer = container;
    
    // Update canvas size on window resize
    window.addEventListener('resize', updateCanvasSize);
  }
  
  /**
   * Setup rune canvas drawing context with proper styles
   */
  setupRuneContext() {
    if (!this.runeContext) return;
    
    // Set line style for rune drawing
    this.runeContext.lineWidth = this.options.runeStrokeWidth;
    this.runeContext.strokeStyle = this.options.runeStrokeColor;
    this.runeContext.lineCap = 'round';
    this.runeContext.lineJoin = 'round';
    
    // Add glow effect with shadow
    this.runeContext.shadowColor = this.options.runeGlowColor;
    this.runeContext.shadowBlur = 15;
    this.runeContext.shadowOffsetX = 0;
    this.runeContext.shadowOffsetY = 0;
  }
  
  /**
   * Setup animation for the rune mode indicator
   * @param {HTMLElement} indicator - The indicator element
   */
  setupRuneIndicatorAnimation(indicator) {
    if (!indicator) return;
    
    // Create pulsing animation
    const animate = () => {
      if (!indicator || !this.runeMode) {
        requestAnimationFrame(animate);
        return;
      }
      
      const time = Date.now() * 0.001; // Convert to seconds
      
      // Pulse size
      const scale = 1 + Math.sin(time * 2) * 0.05;
      indicator.style.transform = `translateX(-50%) scale(${scale})`;
      
      // Pulse shadow
      const shadowSize = 5 + Math.sin(time * 3) * 3;
      indicator.style.boxShadow = `0 0 ${shadowSize}px rgba(128, 0, 128, 0.7)`;
      
      requestAnimationFrame(animate);
    };
    
    // Start animation
    animate();
  }
  
  /**
   * Clear the rune drawing canvas
   */
  clearRuneCanvas() {
    if (this.runeContext && this.runeCanvas) {
      // Clear the entire canvas
      this.runeContext.clearRect(0, 0, this.runeCanvas.width, this.runeCanvas.height);
    }
  }
  
  /**
   * Enable touch controls
   */
  enable() {
    if (this.enabled) return;
    
    this.element.addEventListener('touchstart', this.touchStartHandler, false);
    this.element.addEventListener('touchmove', this.touchMoveHandler, false);
    this.element.addEventListener('touchend', this.touchEndHandler, false);
    this.element.addEventListener('touchcancel', this.touchEndHandler, false);
    this.enabled = true;
    
    console.log('Enhanced touch controller enabled');
    
    // Prevent default touch actions (e.g., scrolling)
    this.element.style.touchAction = 'none';
    
    // Show control elements
    if (this.controlsContainer) {
      this.controlsContainer.style.display = 'block';
    }
    
    // Check if gyroscope is available
    if (this.options.useGyroWhenAvailable && window.DeviceOrientationEvent) {
      this.gyroAvailable = true;
      
      // Listen for gyro events
      this.gyroHandler = this.onGyroUpdate.bind(this);
      window.addEventListener('deviceorientation', this.gyroHandler, false);
      
      console.log('Gyroscope controls enabled');
    }
  }
  
  /**
   * Disable touch controls
   */
  disable() {
    if (!this.enabled) return;
    
    this.element.removeEventListener('touchstart', this.touchStartHandler);
    this.element.removeEventListener('touchmove', this.touchMoveHandler);
    this.element.removeEventListener('touchend', this.touchEndHandler);
    this.element.removeEventListener('touchcancel', this.touchEndHandler);
    this.enabled = false;
    
    // Remove gyroscope listener if active
    if (this.gyroHandler) {
      window.removeEventListener('deviceorientation', this.gyroHandler);
      this.gyroHandler = null;
    }
    
    console.log('Touch controller disabled');
    
    // Hide control elements
    if (this.controlsContainer) {
      this.controlsContainer.style.display = 'none';
    }
    
    // Restore default touch actions
    this.element.style.touchAction = '';
  }
  
  /**
   * Handle gyroscope updates
   * @param {DeviceOrientationEvent} event - Gyroscope event
   */
  onGyroUpdate(event) {
    if (!this.enabled || !this.options.useGyroWhenAvailable) return;
    
    // Only use gyro for looking if right joystick isn't active
    if (!this.rightJoystick.active) {
      const alpha = event.alpha || 0; // Z axis - compass direction
      const beta = event.beta || 0;   // X axis - front/back tilt
      const gamma = event.gamma || 0; // Y axis - left/right tilt
      
      // Only emit if we have meaningful values
      if (alpha !== null && beta !== null && gamma !== null) {
        this.eventBus.emit('mobile:gyro-control', {
          alpha: alpha,
          beta: beta,
          gamma: gamma
        });
      }
    }
  }
  
  /**
   * Handle rune touch start event from desktop
   * @param {Object} data - Touch data
   */
  handleRuneTouchStart(data) {
    if (!this.runeMode) return;
    
    // Clear previous path
    this.clearRuneCanvas();
    this.touchPath = [];
    
    // Add first point
    this.touchPath.push({
      x: data.x * this.runeCanvas.width,
      y: data.y * this.runeCanvas.height
    });
    
    // Start a new path
    if (this.runeContext) {
      this.runeContext.beginPath();
      this.runeContext.moveTo(this.touchPath[0].x, this.touchPath[0].y);
    }
  }
  
  /**
   * Handle rune touch move event from desktop
   * @param {Object} data - Touch data
   */
  handleRuneTouchMove(data) {
    if (!this.runeMode || this.touchPath.length === 0) return;
    
    // Convert normalized coordinates to canvas coordinates
    const x = data.x * this.runeCanvas.width;
    const y = data.y * this.runeCanvas.height;
    
    // Add point to path
    this.touchPath.push({ x, y });
    
    // Draw line to new point
    if (this.runeContext) {
      this.runeContext.lineTo(x, y);
      this.runeContext.stroke();
    }
  }
  
  /**
   * Handle rune touch end event from desktop
   */
  handleRuneTouchEnd() {
    if (!this.runeMode || this.touchPath.length < 3) return;
    
    // Analyze the shape
    const recognizedShape = this.recognizeShape(this.touchPath);
    
    // Display the result
    this.showRecognitionResult(recognizedShape);
    
    // Emit the recognized shape event
    this.eventBus.emit('runeMode:shapeRecognized', {
      shape: recognizedShape.shape,
      confidence: recognizedShape.confidence
    });
    
    // Clear after a delay to show the completed shape first
    setTimeout(() => {
      this.clearRuneCanvas();
      this.touchPath = [];
    }, 1500);
  }
  
  /**
   * Handle touch start event
   * @param {TouchEvent} event - Touch event
   */
  onTouchStart(event) {
    // Prevent default to avoid scrolling
    event.preventDefault();
    
    // Check if we're in rune mode
    if (this.runeMode) {
      // Handle touches for rune drawing
      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        const rect = this.element.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // Normalize coordinates (0-1)
        const normalizedX = x / rect.width;
        const normalizedY = y / rect.height;
        
        // Clear previous path
        this.clearRuneCanvas();
        this.touchPath = [];
        
        // Add first point
        this.touchPath.push({ x, y });
        
        // Start a new path
        if (this.runeContext) {
          this.runeContext.beginPath();
          this.runeContext.moveTo(x, y);
        }
        
        // Emit touch start event
        this.eventBus.emit('mobile:rune-touch-start', {
          x: normalizedX,
          y: normalizedY
        });
      }
      
      return;
    }
    
    // Standard joystick control handling
    // Process each touch
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const touchId = touch.identifier;
      const rect = this.element.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      // Normalize coordinates (0-1)
      const normalizedX = x / rect.width;
      const normalizedY = y / rect.height;
      
      // Check if touch is on left or right side of screen
      if (normalizedX < this.screenDivider && !this.leftJoystick.active) {
        // Left joystick
        this.leftJoystick.active = true;
        this.leftJoystick.id = touchId;
        this.leftJoystick.startX = x;
        this.leftJoystick.startY = y;
        this.leftJoystick.currentX = x;
        this.leftJoystick.currentY = y;
        
        // Position and show left joystick at touch location
        this.joystickElements.left.style.left = `${x - this.options.joystickSize/2}px`;
        this.joystickElements.left.style.top = `${y - this.options.joystickSize/2}px`;
        this.joystickElements.left.style.opacity = '1';
        this.joystickElements.leftIndicator.style.transform = 'translate(-50%, -50%)';
        
        this.isMoving = true;
      } 
      else if (normalizedX >= this.screenDivider && !this.rightJoystick.active) {
        // Right joystick
        this.rightJoystick.active = true;
        this.rightJoystick.id = touchId;
        this.rightJoystick.startX = x;
        this.rightJoystick.startY = y;
        this.rightJoystick.currentX = x;
        this.rightJoystick.currentY = y;
        
        // Position and show right joystick at touch location
        this.joystickElements.right.style.left = `${x - this.options.joystickSize/2}px`;
        this.joystickElements.right.style.top = `${y - this.options.joystickSize/2}px`;
        this.joystickElements.right.style.opacity = '1';
        this.joystickElements.rightIndicator.style.transform = 'translate(-50%, -50%)';
        
        this.isTurning = true;
      }
      
      // Check if touch is on action button
      if (this.isPointInActionButton(x, y) && !this.actionButtonActive) {
        this.actionButtonActive = true;
        this.actionButtonId = touchId;
        
        // Visual feedback
        this.actionButtonElement.style.transform = 'scale(0.9)';
        this.actionButtonElement.style.background = this.options.actionButtonActiveColor;
        
        // Emit action event
        this.eventBus.emit('mobile:action-start');
      }
    }
  }
  
  /**
   * Check if a point is within the action button
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate
   * @returns {boolean} Whether point is in action button
   */
  isPointInActionButton(x, y) {
    if (!this.actionButtonElement) return false;
    
    const rect = this.actionButtonElement.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width / 2;
    
    // Distance from point to center
    const distance = Math.sqrt(
      Math.pow(x - centerX, 2) + 
      Math.pow(y - centerY, 2)
    );
    
    return distance <= radius;
  }
  
  /**
   * Handle touch move event
   * @param {TouchEvent} event - Touch event
   */
  onTouchMove(event) {
    // Prevent default to avoid scrolling
    event.preventDefault();
    
    // Check if we're in rune mode
    if (this.runeMode) {
      // Handle touches for rune drawing
      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        const rect = this.element.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // Normalize coordinates (0-1)
        const normalizedX = x / rect.width;
        const normalizedY = y / rect.height;
        
        // Skip if no path started
        if (this.touchPath.length === 0) continue;
        
        // Add point to path
        this.touchPath.push({ x, y });
        
        // Draw line to new point
        if (this.runeContext) {
          this.runeContext.lineTo(x, y);
          this.runeContext.stroke();
        }
        
        // Emit touch move event
        this.eventBus.emit('mobile:rune-touch-move', {
          x: normalizedX,
          y: normalizedY
        });
      }
      
      return;
    }
    
    // Standard joystick control handling
    // Process each moved touch
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const touchId = touch.identifier;
      const rect = this.element.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      // Update left joystick
      if (this.leftJoystick.active && this.leftJoystick.id === touchId) {
        // Calculate delta from start position
        const deltaX = x - this.leftJoystick.startX;
        const deltaY = y - this.leftJoystick.startY;
        
        // Limit distance
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = this.options.joystickSize * 0.3;
        
        if (distance > maxDistance) {
          const angle = Math.atan2(deltaY, deltaX);
          const limitedX = Math.cos(angle) * maxDistance;
          const limitedY = Math.sin(angle) * maxDistance;
          
          this.leftJoystick.deltaX = limitedX / maxDistance; // -1 to 1
          this.leftJoystick.deltaY = limitedY / maxDistance; // -1 to 1
          
          // Update indicator position
          this.joystickElements.leftIndicator.style.transform = 
            `translate(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px))`;
        } else {
          this.leftJoystick.deltaX = deltaX / maxDistance; // -1 to 1
          this.leftJoystick.deltaY = deltaY / maxDistance; // -1 to 1
          
          // Update indicator position
          this.joystickElements.leftIndicator.style.transform = 
            `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
        }
        
        // Emit movement event
        this.eventBus.emit('mobile:move-joystick', {
          x: this.leftJoystick.deltaX,
          y: this.leftJoystick.deltaY
        });
      }
      
      // Update right joystick
      if (this.rightJoystick.active && this.rightJoystick.id === touchId) {
        // Calculate delta from start position
        const deltaX = x - this.rightJoystick.startX;
        const deltaY = y - this.rightJoystick.startY;
        
        // Limit distance
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const maxDistance = this.options.joystickSize * 0.3;
        
        if (distance > maxDistance) {
          const angle = Math.atan2(deltaY, deltaX);
          const limitedX = Math.cos(angle) * maxDistance;
          const limitedY = Math.sin(angle) * maxDistance;
          
          this.rightJoystick.deltaX = limitedX / maxDistance; // -1 to 1
          this.rightJoystick.deltaY = limitedY / maxDistance; // -1 to 1
          
          // Update indicator position
          this.joystickElements.rightIndicator.style.transform = 
            `translate(calc(-50% + ${limitedX}px), calc(-50% + ${limitedY}px))`;
        } else {
          this.rightJoystick.deltaX = deltaX / maxDistance; // -1 to 1
          this.rightJoystick.deltaY = deltaY / maxDistance; // -1 to 1
          
          // Update indicator position
          this.joystickElements.rightIndicator.style.transform = 
            `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px))`;
        }
        
        // Emit look event
        this.eventBus.emit('mobile:look-joystick', {
          x: this.rightJoystick.deltaX,
          y: this.rightJoystick.deltaY
        });
      }
    }
  }
  
  /**
   * Handle touch end event
   * @param {TouchEvent} event - Touch event
   */
  onTouchEnd(event) {
    // Prevent default
    event.preventDefault();
    
    // Check if we're in rune mode
    if (this.runeMode) {
      // Handle touch end for rune drawing
      for (let i = 0; i < event.changedTouches.length; i++) {
        const touch = event.changedTouches[i];
        const rect = this.element.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        // Normalize coordinates (0-1)
        const normalizedX = x / rect.width;
        const normalizedY = y / rect.height;
        
        // Skip if no path or too short
        if (this.touchPath.length < 3) {
          this.clearRuneCanvas();
          this.touchPath = [];
          return;
        }
        
        // Add final point
        this.touchPath.push({ x, y });
        
        // Analyze the shape
        const recognizedShape = this.recognizeShape(this.touchPath);
        
        // Display the result
        this.showRecognitionResult(recognizedShape);
        
        // Emit touch end and shape recognized events
        this.eventBus.emit('mobile:rune-touch-end', {
          x: normalizedX,
          y: normalizedY
        });
        
        // Use the correct event name that matches what FirstPersonController is listening for
        this.eventBus.emit('mobile:rune-cast', {
          shape: recognizedShape.shape,
          confidence: recognizedShape.confidence,
          playerId: 'mobile' // Add playerId to match expected format
        });
        
        // Clear after a delay
        setTimeout(() => {
          this.clearRuneCanvas();
          this.touchPath = [];
        }, 1500);
      }
      
      return;
    }
    
    // Standard joystick control handling
    // Process each ended touch
    for (let i = 0; i < event.changedTouches.length; i++) {
      const touch = event.changedTouches[i];
      const touchId = touch.identifier;
      
      // Check if left joystick was released
      if (this.leftJoystick.active && this.leftJoystick.id === touchId) {
        this.leftJoystick.active = false;
        this.leftJoystick.deltaX = 0;
        this.leftJoystick.deltaY = 0;
        
        // Hide joystick
        this.joystickElements.left.style.opacity = '0';
        
        // Reset indicator
        this.joystickElements.leftIndicator.style.transform = 'translate(-50%, -50%)';
        
        // Emit move stop event
        this.eventBus.emit('mobile:move-joystick', { x: 0, y: 0 });
        
        this.isMoving = false;
      }
      
      // Check if right joystick was released
      if (this.rightJoystick.active && this.rightJoystick.id === touchId) {
        this.rightJoystick.active = false;
        this.rightJoystick.deltaX = 0;
        this.rightJoystick.deltaY = 0;
        
        // Hide joystick
        this.joystickElements.right.style.opacity = '0';
        
        // Reset indicator
        this.joystickElements.rightIndicator.style.transform = 'translate(-50%, -50%)';
        
        // Emit look stop event
        this.eventBus.emit('mobile:look-joystick', { x: 0, y: 0 });
        
        this.isTurning = false;
      }
      
      // Check if action button was released
      if (this.actionButtonActive && this.actionButtonId === touchId) {
        this.actionButtonActive = false;
        
        // Visual feedback
        this.actionButtonElement.style.transform = 'scale(1)';
        this.actionButtonElement.style.background = this.options.actionButtonColor;
        
        // Emit action end event
        this.eventBus.emit('mobile:action-end');
      }
    }
  }
  
  /**
   * Draw a recognized shape overlay
   * @param {Object} result - Recognition result
   */
  showRecognitionResult(result) {
    if (!this.runeContext || !this.runeCanvas) return;
    
    // Draw recognition result overlay
    const ctx = this.runeContext;
    
    // Save original drawing settings
    const originalStrokeStyle = ctx.strokeStyle;
    const originalLineWidth = ctx.lineWidth;
    const originalShadowColor = ctx.shadowColor;
    const originalShadowBlur = ctx.shadowBlur;
    
    // Calculate center and size of the shape
    const { center, radius } = this.getShapeBounds(this.touchPath);
    
    // Draw recognized shape overlay
    if (result.shape === 'circle') {
      // Draw perfect circle overlay
      ctx.strokeStyle = result.confidence > 0.7 ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 165, 0, 0.7)';
      ctx.lineWidth = this.options.runeStrokeWidth * 1.2;
      ctx.shadowColor = result.confidence > 0.7 ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 165, 0, 0.5)';
      ctx.shadowBlur = 20;
      
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Add "Circle" text
      this.drawRecognitionText('Circle', center, result.confidence);
    } 
    else if (result.shape === 'triangle') {
      // Draw perfect triangle overlay
      ctx.strokeStyle = result.confidence > 0.7 ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 165, 0, 0.7)';
      ctx.lineWidth = this.options.runeStrokeWidth * 1.2;
      ctx.shadowColor = result.confidence > 0.7 ? 'rgba(0, 255, 0, 0.5)' : 'rgba(255, 165, 0, 0.5)';
      ctx.shadowBlur = 20;
      
      // Equilateral triangle
      const triangleRadius = radius * 1.2; // Slightly larger
      const height = triangleRadius * Math.sqrt(3);
      
      ctx.beginPath();
      ctx.moveTo(center.x, center.y - triangleRadius * 0.7); // Top
      ctx.lineTo(center.x - triangleRadius, center.y + height/2 - triangleRadius * 0.7); // Bottom left
      ctx.lineTo(center.x + triangleRadius, center.y + height/2 - triangleRadius * 0.7); // Bottom right
      ctx.closePath();
      ctx.stroke();
      
      // Add "Triangle" text
      this.drawRecognitionText('Triangle', center, result.confidence);
    }
    else {
      // Unknown shape
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = this.options.runeStrokeWidth * 0.8;
      ctx.shadowColor = 'rgba(255, 0, 0, 0.3)';
      ctx.shadowBlur = 10;
      
      // Draw "X" mark
      const size = radius * 0.7;
      ctx.beginPath();
      ctx.moveTo(center.x - size, center.y - size);
      ctx.lineTo(center.x + size, center.y + size);
      ctx.moveTo(center.x + size, center.y - size);
      ctx.lineTo(center.x - size, center.y + size);
      ctx.stroke();
      
      // Add "Unknown" text
      this.drawRecognitionText('Unknown Shape', center, result.confidence);
    }
    
    // Restore original drawing settings
    ctx.strokeStyle = originalStrokeStyle;
    ctx.lineWidth = originalLineWidth;
    ctx.shadowColor = originalShadowColor;
    ctx.shadowBlur = originalShadowBlur;
  }
  
  /**
   * Draw recognition result text
   * @param {string} text - Text to display
   * @param {Object} center - Center position
   * @param {number} confidence - Recognition confidence
   */
  drawRecognitionText(text, center, confidence) {
    if (!this.runeContext) return;
    
    const ctx = this.runeContext;
    
    // Save original text settings
    const originalFont = ctx.font;
    const originalFillStyle = ctx.fillStyle;
    const originalTextAlign = ctx.textAlign;
    const originalTextBaseline = ctx.textBaseline;
    
    // Set text properties
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Create background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const textWidth = ctx.measureText(text).width + 20;
    ctx.fillRect(center.x - textWidth/2, center.y + 40, textWidth, 40);
    
    // Draw text with confidence-based color
    if (confidence > 0.7) {
      ctx.fillStyle = 'rgba(0, 255, 0, 0.9)'; // Green for high confidence
    } else if (confidence > 0.4) {
      ctx.fillStyle = 'rgba(255, 165, 0, 0.9)'; // Orange for medium confidence
    } else {
      ctx.fillStyle = 'rgba(255, 0, 0, 0.9)'; // Red for low confidence
    }
    
    ctx.fillText(text, center.x, center.y + 60);
    
    // Restore original text settings
    ctx.font = originalFont;
    ctx.fillStyle = originalFillStyle;
    ctx.textAlign = originalTextAlign;
    ctx.textBaseline = originalTextBaseline;
  }
  
  /**
   * Get shape center and radius from touch path
   * @param {Array} path - Array of touch points
   * @returns {Object} Center and radius
   */
  getShapeBounds(path) {
    if (!path || path.length === 0) {
      return { center: { x: 0, y: 0 }, radius: 0 };
    }
    
    // Find bounds
    let minX = path[0].x;
    let maxX = path[0].x;
    let minY = path[0].y;
    let maxY = path[0].y;
    
    for (const point of path) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    
    // Calculate center
    const center = {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2
    };
    
    // Calculate radius (half of the maximum dimension)
    const radius = Math.max(maxX - minX, maxY - minY) / 2;
    
    return { center, radius };
  }
  
  /**
   * Recognize shape from touch path
   * @param {Array} path - Array of touch points
   * @returns {Object} Recognition result with shape and confidence
   */
  recognizeShape(path) {
    if (path.length < 5) {
      return { shape: 'unknown', confidence: 0 };
    }
    
    // Detect if the shape is closed (start and end points are close)
    const startPoint = path[0];
    const endPoint = path[path.length - 1];
    const distance = Math.sqrt(
      Math.pow(endPoint.x - startPoint.x, 2) + 
      Math.pow(endPoint.y - startPoint.y, 2)
    );
    
    // Get center and radius
    const { center, radius } = this.getShapeBounds(path);
    
    // If radius is too small, it's probably just a tap, not a shape
    if (radius < 20) {
      return { shape: 'unknown', confidence: 0 };
    }
    
    // Check if shape is closed
    const isClosed = distance < radius * 0.3;
    
    // Calculate circularity: how close the points are to the circle's perimeter
    let circularityScore = 0;
    let triangularityScore = 0;
    
    // Calculate distance from each point to center
    const distances = path.map(point => {
      return Math.sqrt(
        Math.pow(point.x - center.x, 2) + 
        Math.pow(point.y - center.y, 2)
      );
    });
    
    // Average distance (ideal radius)
    const avgRadius = distances.reduce((sum, d) => sum + d, 0) / distances.length;
    
    // Circularity: standard deviation of distances relative to average radius
    const variance = distances.reduce((sum, d) => sum + Math.pow(d - avgRadius, 2), 0) / distances.length;
    const stdDev = Math.sqrt(variance);
    circularityScore = 1 - (stdDev / avgRadius);
    
    // Triangularity: check for 3 distinct corners
    // Calculate angle changes along the path
    const angles = [];
    const angleThreshold = 0.6; // Threshold for significant angle change
    
    for (let i = 2; i < path.length; i++) {
      const prev = path[i-2];
      const curr = path[i-1];
      const next = path[i];
      
      // Calculate vectors
      const v1 = { x: curr.x - prev.x, y: curr.y - prev.y };
      const v2 = { x: next.x - curr.x, y: next.y - curr.y };
      
      // Normalize vectors
      const v1mag = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
      const v2mag = Math.sqrt(v2.x * v2.x + v2.y * v2.y);
      
      if (v1mag > 0 && v2mag > 0) {
        const v1norm = { x: v1.x / v1mag, y: v1.y / v1mag };
        const v2norm = { x: v2.x / v2mag, y: v2.y / v2mag };
        
        // Dot product to get angle
        const dotProduct = v1norm.x * v2norm.x + v1norm.y * v2norm.y;
        const angle = Math.acos(Math.max(-1, Math.min(1, dotProduct)));
        
        // Store significant angles
        if (angle > angleThreshold) {
          angles.push({ index: i-1, angle: angle });
        }
      }
    }
    
    // Simplify angles by merging close ones
    const mergedAngles = [];
    const mergeThreshold = path.length * 0.1; // Minimum distance between corners
    
    for (const angle of angles) {
      if (mergedAngles.length === 0 || 
          angle.index - mergedAngles[mergedAngles.length - 1].index > mergeThreshold) {
        mergedAngles.push(angle);
      }
    }
    
    // Triangle has exactly 3 significant angles that are reasonably evenly spaced
    if (mergedAngles.length === 3 && isClosed) {
      // Check if angles are evenly spaced (roughly)
      const totalPoints = path.length;
      const expectedSpacing = totalPoints / 3;
      
      // Calculate actual spacing between angles
      const spacings = [
        mergedAngles[1].index - mergedAngles[0].index,
        mergedAngles[2].index - mergedAngles[1].index,
        totalPoints - (mergedAngles[2].index - mergedAngles[0].index)
      ];
      
      // Calculate how close the spacings are to the expected spacing
      const spacingDeviation = spacings.reduce((sum, spacing) => 
        sum + Math.abs(spacing - expectedSpacing), 0) / (3 * expectedSpacing);
      
      triangularityScore = 1 - spacingDeviation;
    }
    
    // Evaluate the scores with the constraint that the shape is closed
    if (isClosed) {
      if (circularityScore > 0.75 && circularityScore > triangularityScore) {
        return { shape: 'circle', confidence: circularityScore };
      } else if (triangularityScore > 0.6 && triangularityScore > circularityScore) {
        return { shape: 'triangle', confidence: triangularityScore };
      } else if (circularityScore > 0.5) {
        return { shape: 'circle', confidence: circularityScore * 0.8 };
      } else if (triangularityScore > 0.4) {
        return { shape: 'triangle', confidence: triangularityScore * 0.8 };
      }
    }
    
    return { shape: 'unknown', confidence: 0.2 };
  }
  
  /**
   * Dispose touch controller
   */
  dispose() {
    this.disable();
    
    // Remove UI elements
    if (this.controlsContainer && this.controlsContainer.parentNode) {
      this.controlsContainer.parentNode.removeChild(this.controlsContainer);
    }
    
    this.joystickElements = { left: null, right: null, leftIndicator: null, rightIndicator: null };
    this.actionButtonElement = null;
    this.runeCanvas = null;
    this.runeContext = null;
    this.runeModeIndicator = null;
    this.controlsContainer = null;
    this.touchPath = [];
  }
}
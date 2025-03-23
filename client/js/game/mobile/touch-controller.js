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
    
    // Rune mode removed
    
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
      // Rune options removed
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
    // Rune mode event listeners removed
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
    
    // Rune canvas elements removed
    
    // Add elements to container
    container.appendChild(leftJoystick);
    container.appendChild(rightJoystick);
    container.appendChild(actionButton);
    
    // Store references
    this.joystickElements.left = leftJoystick;
    this.joystickElements.right = rightJoystick;
    this.joystickElements.leftIndicator = leftIndicator;
    this.joystickElements.rightIndicator = rightIndicator;
    this.actionButtonElement = actionButton;
    
    // Add container to the element
    this.element.parentElement.appendChild(container);
    this.controlsContainer = container;
    
    // Update canvas size on window resize
    window.addEventListener('resize', updateCanvasSize);
  }
  
  // Rune context and animation methods removed
  
  // Rune canvas functions removed
  
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
  
  // Rune touch handlers removed
  
  /**
   * Handle touch start event
   * @param {TouchEvent} event - Touch event
   */
  onTouchStart(event) {
    // Prevent default to avoid scrolling
    event.preventDefault();
    
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
  
  // Rune shape recognition methods removed
  
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
    this.controlsContainer = null;
  }
}
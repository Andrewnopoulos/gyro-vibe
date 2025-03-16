/**
 * Handles touch input for mobile players
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
    
    this.touchStartHandler = this.onTouchStart.bind(this);
    this.touchMoveHandler = this.onTouchMove.bind(this);
    this.touchEndHandler = this.onTouchEnd.bind(this);
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
    
    console.log('Touch controller enabled');
    
    // Prevent default touch actions (e.g., scrolling)
    this.element.style.touchAction = 'none';
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
    
    console.log('Touch controller disabled');
    
    // Restore default touch actions
    this.element.style.touchAction = '';
  }
  
  /**
   * Handle touch start event
   * @param {TouchEvent} event - Touch event
   */
  onTouchStart(event) {
    // Prevent default to avoid scrolling
    event.preventDefault();
    
    if (event.touches.length === 0) return;
    
    // Get primary touch coordinates and normalize to 0-1 range
    const touch = event.touches[0];
    const rect = this.element.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    
    // Emit touch start event
    this.eventBus.emit('mobile:touch-start', { x, y });
  }
  
  /**
   * Handle touch move event
   * @param {TouchEvent} event - Touch event
   */
  onTouchMove(event) {
    // Prevent default to avoid scrolling
    event.preventDefault();
    
    if (event.touches.length === 0) return;
    
    // Get primary touch coordinates and normalize to 0-1 range
    const touch = event.touches[0];
    const rect = this.element.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    
    // Emit touch move event
    this.eventBus.emit('mobile:touch-move', { x, y });
  }
  
  /**
   * Handle touch end event
   * @param {TouchEvent} event - Touch event
   */
  onTouchEnd(event) {
    // Prevent default
    event.preventDefault();
    
    // Emit touch end event
    this.eventBus.emit('mobile:touch-end');
  }
  
  /**
   * Dispose touch controller
   */
  dispose() {
    this.disable();
  }
}
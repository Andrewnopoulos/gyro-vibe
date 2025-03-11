/**
 * Manages sensor calibration
 */
export class CalibrationManager {
  /**
   * @param {EventBus} eventBus - Application event bus
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.calibrationInProgress = false;
    this.calibrationInstruction = null;
    
    this.setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    this.eventBus.on('calibration:request', () => {
      this.startCalibration();
    });
    
    this.eventBus.on('calibration:complete', () => {
      this.endCalibration();
    });
    
    this.eventBus.on('calibration:failed', () => {
      this.endCalibration();
    });
  }

  /**
   * Start calibration mode
   */
  startCalibration() {
    this.calibrationInProgress = true;
    
    // Add a visual instruction for calibration
    this.calibrationInstruction = document.createElement('div');
    this.calibrationInstruction.style.position = 'fixed';
    this.calibrationInstruction.style.top = '60px';
    this.calibrationInstruction.style.left = '50%';
    this.calibrationInstruction.style.transform = 'translateX(-50%)';
    this.calibrationInstruction.style.backgroundColor = '#17a2b8';
    this.calibrationInstruction.style.color = 'white';
    this.calibrationInstruction.style.padding = '10px 20px';
    this.calibrationInstruction.style.borderRadius = '4px';
    this.calibrationInstruction.style.zIndex = '1000';
    this.calibrationInstruction.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    this.calibrationInstruction.textContent = 'Place device flat on its back (screen facing up) for calibration';
    this.calibrationInstruction.id = 'calibration-instruction';
    document.body.appendChild(this.calibrationInstruction);
  }

  /**
   * End calibration mode
   */
  endCalibration() {
    this.calibrationInProgress = false;
    
    // Remove calibration instruction
    if (this.calibrationInstruction) {
      this.calibrationInstruction.style.opacity = '0';
      this.calibrationInstruction.style.transition = 'opacity 0.5s';
      setTimeout(() => {
        if (this.calibrationInstruction && this.calibrationInstruction.parentNode) {
          this.calibrationInstruction.parentNode.removeChild(this.calibrationInstruction);
        }
        this.calibrationInstruction = null;
      }, 500);
    }
  }

  /**
   * Check if calibration is in progress
   * @returns {boolean} Calibration status
   */
  isCalibrating() {
    return this.calibrationInProgress;
  }
}
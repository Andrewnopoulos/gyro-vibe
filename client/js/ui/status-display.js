/**
 * Handles device status display
 */
export class StatusDisplay {
  /**
   * @param {EventBus} eventBus - Application event bus
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.deviceStatus = document.getElementById('deviceStatus');
    this.calibrateBtn = document.getElementById('calibrateBtn');
    
    this.setupEventListeners();
    this.setStatus('Connecting to server...', 'disconnected');
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    this.eventBus.on('socket:connected', () => {
      this.setStatus('Connected to server, waiting for session...', 'connecting');
    });

    this.eventBus.on('session:created', () => {
      this.setStatus('Waiting for mobile device to connect...', 'disconnected');
    });

    this.eventBus.on('mobile:joined', () => {
      this.setStatus('Mobile connected, establishing WebRTC...', 'connecting');
    });

    this.eventBus.on('mobile:disconnected', () => {
      this.setStatus('Mobile device disconnected', 'disconnected');
      this.setCalibrationButtonState(false);
    });

    this.eventBus.on('webrtc:connected', () => {
      this.setStatus('Mobile device connected via WebRTC', 'connected');
      this.setCalibrationButtonState(true);
    });

    this.eventBus.on('webrtc:disconnected', () => {
      this.setStatus('WebRTC connection lost', 'disconnected');
      this.setCalibrationButtonState(false);
    });

    this.eventBus.on('calibration:started', () => {
      this.setStatus('Calibrating sensors...', 'connecting');
    });

    this.eventBus.on('calibration:complete', () => {
      this.setStatus('Mobile device connected via WebRTC - Calibrated!', 'connected');
      this.showNotification('Sensors calibrated successfully!', 'success');
    });

    this.eventBus.on('calibration:failed', (data) => {
      this.setStatus('Mobile device connected - Calibration failed', 'connected');
      this.showNotification(`Calibration failed: ${data.reason || 'Unknown error'}. Please start sensors on mobile first.`, 'error');
    });
    
    // Set up calibration button
    if (this.calibrateBtn) {
      this.calibrateBtn.addEventListener('click', () => {
        this.eventBus.emit('calibration:request');
      });
    }
  }

  /**
   * Set status text and class
   * @param {string} message - Status message
   * @param {string} className - Status class (connected, connecting, disconnected)
   */
  setStatus(message, className) {
    if (this.deviceStatus) {
      this.deviceStatus.textContent = message;
      this.deviceStatus.className = className;
    }
  }

  /**
   * Set calibration button state
   * @param {boolean} enabled - Whether button should be enabled
   */
  setCalibrationButtonState(enabled) {
    if (this.calibrateBtn) {
      this.calibrateBtn.disabled = !enabled;
    }
  }

  /**
   * Show notification
   * @param {string} message - Notification message
   * @param {string} type - Notification type (success, error, info)
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.padding = '10px 20px';
    notification.style.borderRadius = '4px';
    notification.style.zIndex = '1000';
    notification.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    notification.textContent = message;
    
    // Set color based on type
    if (type === 'success') {
      notification.style.backgroundColor = '#17a2b8';
      notification.style.color = 'white';
    } else if (type === 'error') {
      notification.style.backgroundColor = '#dc3545';
      notification.style.color = 'white';
    } else {
      notification.style.backgroundColor = '#6c757d';
      notification.style.color = 'white';
    }
    
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transition = 'opacity 0.5s';
      setTimeout(() => document.body.removeChild(notification), 500);
    }, 3000);
  }
}
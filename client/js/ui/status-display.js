/**
 * Handles device status display
 */
export class StatusDisplay {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {boolean} isPortalMode - Whether the app is in portal mode
   */
  constructor(eventBus, isPortalMode = false) {
    this.eventBus = eventBus;
    this.isPortalMode = isPortalMode;
    this.deviceStatus = document.getElementById('deviceStatus');
    this.calibrateBtn = document.getElementById('calibrateBtn');
    this.qrcodeElement = document.getElementById('qrcode');
    this.instructionsElement = document.getElementById('instructions');
    this.debugToggleBtn = document.getElementById('debugToggleBtn');
    this.debugSection = document.getElementById('debugSection');
    this.debugShowing = false;
    
    // Check if user is on a mobile device (but not on the /mobile endpoint)
    this.isMobileDevice = this.checkIsMobileDevice();
    
    // In portal mode or on mobile device, hide instructions immediately
    if ((this.isPortalMode || this.isMobileDevice) && this.instructionsElement) {
      this.instructionsElement.style.display = 'none';
    }
    
    // For mobile users, hide the "waiting for mobile" status and set a better message
    if (this.isMobileDevice) {
      const statusOverlay = document.getElementById('status-overlay');
      if (statusOverlay) {
        // Initially hide the status overlay for mobile users
        statusOverlay.style.display = 'none';
      }
      
      if (this.deviceStatus) {
        this.deviceStatus.textContent = 'Ready to play';
        this.deviceStatus.className = 'connected';
      }
    }
    
    this.setupEventListeners();
    
    // Only set the "connecting" status for non-mobile users
    if (!this.isMobileDevice) {
      this.setStatus('Connecting to server...', 'disconnected');
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
   * Set up event listeners
   */
  setupEventListeners() {
    this.eventBus.on('socket:connected', () => {
      this.setStatus('Connected to server, waiting for session...', 'connecting');
    });

    this.eventBus.on('session:created', () => {
      this.setStatus('Waiting for mobile device to connect...', 'disconnected');
      this.showQRCode(true);
    });

    this.eventBus.on('mobile:joined', () => {
      this.setStatus('Mobile connected, establishing WebRTC...', 'connecting');
      this.showQRCode(false); // Hide QR code when mobile device connects
    });

    this.eventBus.on('mobile:disconnected', () => {
      this.setStatus('Mobile device disconnected', 'disconnected');
      this.setCalibrationButtonState(false);
      this.showQRCode(true); // Show QR code when mobile device disconnects
    });

    this.eventBus.on('webrtc:connected', () => {
      this.setStatus('Mobile device connected via WebRTC', 'connected');
      this.setCalibrationButtonState(true);
      this.showQRCode(false); // Hide QR code when WebRTC connection established
    });

    this.eventBus.on('webrtc:disconnected', () => {
      this.setStatus('WebRTC connection lost', 'disconnected');
      this.setCalibrationButtonState(false);
      this.showQRCode(true); // Show QR code when WebRTC connection lost
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
    
    // Multiplayer status updates
    this.eventBus.on('multiplayer:room-created', (data) => {
      this.setStatus(`Room Created: ${data.room.roomName}`, 'connected');
    });
    
    this.eventBus.on('multiplayer:room-joined', (data) => {
      this.setStatus(`Joined Room: ${data.room.roomName}`, 'connected');
    });
    
    this.eventBus.on('multiplayer:room-left', () => {
      this.setStatus('Left multiplayer room', 'disconnected');
    });
    
    this.eventBus.on('multiplayer:player-joined', (data) => {
      this.showNotification(`Player ${data.player.username} joined the room`, 'info');
    });
    
    this.eventBus.on('multiplayer:player-left', (data) => {
      this.showNotification(`Player left the room`, 'info');
    });
    
    // Remote spell casting notifications
    this.eventBus.on('ui:remote-spell-cast', (data) => {
      const { playerId, spellId, spellName } = data;
      
      // Get player username if available
      let playerName = 'A player';
      this.eventBus.emit('multiplayer:get-player', playerId, (player) => {
        if (player && player.username) {
          playerName = player.username;
        }
      });
      
      // Show notification with spell name and player identifier
      this.showNotification(`${playerName} cast ${spellName || 'a spell'}`, 'spell');
    });
    
    // Enemy events
    this.eventBus.on('enemy:death', (data) => {
      if (data.killerPlayerId && data.isNetworked) {
        this.showNotification(`Enemy defeated by another player!`, 'success');
      }
    });
    
    // Set up calibration button
    if (this.calibrateBtn) {
      this.calibrateBtn.addEventListener('click', () => {
        this.eventBus.emit('calibration:request');
      });
    }
    
    // Set up debug toggle button
    if (this.debugToggleBtn) {
      this.debugToggleBtn.addEventListener('click', () => {
        this.toggleDebugSection();
      });
    }
  }

  /**
   * Toggle debug section visibility
   */
  toggleDebugSection() {
    this.debugShowing = !this.debugShowing;
    
    // Toggle the built-in debug section
    if (this.debugSection) {
      this.debugSection.style.display = this.debugShowing ? 'block' : 'none';
    }
    
    // Also toggle the DebugPanel visibility if it exists
    const debugPanel = document.getElementById('debug-panel');
    if (debugPanel) {
      debugPanel.style.display = this.debugShowing ? 'block' : 'none';
    }
    
    // Update button text
    if (this.debugToggleBtn) {
      this.debugToggleBtn.textContent = this.debugShowing ? 'Hide Debug' : 'Show Debug';
    }
  }

  /**
   * Show or hide QR code based on connection status
   * @param {boolean} show - Whether to show QR code
   */
  showQRCode(show) {
    // If on a mobile device (not using /mobile endpoint), don't show QR code
    if (this.isMobileDevice) {
      return;
    }
    
    if (this.qrcodeElement) {
      this.qrcodeElement.style.display = show ? 'block' : 'none';
      
      // Also show/hide instructions panel, but only if not in portal mode and not on mobile
      if (this.instructionsElement && !this.isPortalMode && !this.isMobileDevice) {
        this.instructionsElement.style.display = show ? 'block' : 'none';
      }
      
      // In portal mode, use a different style for QR code and add instruction text
      if (this.isPortalMode && show) {
        this.qrcodeElement.style.top = 'unset';
        this.qrcodeElement.style.left = 'unset';
        this.qrcodeElement.style.bottom = '10px';
        this.qrcodeElement.style.left = '10px';
        this.qrcodeElement.style.transform = 'none';
        this.qrcodeElement.style.padding = '10px';
        this.qrcodeElement.style.maxWidth = '200px';
        
        // Add instruction text if it doesn't exist
        let instructionText = this.qrcodeElement.querySelector('.qr-instruction-text');
        if (!instructionText) {
          instructionText = document.createElement('div');
          instructionText.className = 'qr-instruction-text';
          instructionText.style.textAlign = 'center';
          instructionText.style.marginTop = '8px';
          instructionText.style.fontWeight = 'bold';
          instructionText.style.fontSize = '12px';
          instructionText.style.color = '#000';
          instructionText.textContent = 'SCAN TO USE YOUR DEVICE AS A MOTION CONTROLLER';
          this.qrcodeElement.appendChild(instructionText);
        }
      }
      
      // Ensure z-index is appropriate
      if (show) {
        // Make sure z-index is consistent with our side-by-side layout
        const currentZ = parseInt(getComputedStyle(this.qrcodeElement).zIndex, 10);
        if (currentZ < 20) {
          this.qrcodeElement.style.zIndex = '20';
        }
      }
    }
  }

  /**
   * Set status text and class
   * @param {string} message - Status message
   * @param {string} className - Status class (connected, connecting, disconnected)
   */
  setStatus(message, className) {
    if (this.deviceStatus) {
      // For mobile users, don't show "waiting for mobile device" messages
      if (this.isMobileDevice && (
          message.includes("Waiting for mobile device") || 
          message.includes("No mobile device connected"))) {
        // Either hide the status completely or show a more appropriate message
        this.deviceStatus.textContent = "Ready to play";
        this.deviceStatus.className = "connected";
        
        // Hide the entire status overlay if it's just about waiting for mobile
        const statusOverlay = document.getElementById('status-overlay');
        if (statusOverlay) {
          statusOverlay.style.display = 'none';
        }
      } else {
        this.deviceStatus.textContent = message;
        this.deviceStatus.className = className;
      }
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
    notification.className = 'overlay';
    notification.style.position = 'fixed';
    notification.style.top = '80px';
    notification.style.left = '50%';
    notification.style.transform = 'translateX(-50%)';
    notification.style.padding = '10px 20px';
    notification.style.zIndex = '1000';
    notification.style.textAlign = 'center';
    notification.style.minWidth = '250px';
    notification.textContent = message;
    
    // Set color based on type
    if (type === 'success') {
      notification.style.backgroundColor = 'rgba(23, 162, 184, 0.9)';
    } else if (type === 'error') {
      notification.style.backgroundColor = 'rgba(220, 53, 69, 0.9)';
    } else if (type === 'spell') {
      notification.style.backgroundColor = 'rgba(138, 43, 226, 0.9)'; // Purple for spell casts
    } else {
      notification.style.backgroundColor = 'rgba(108, 117, 125, 0.9)';
    }
    
    // Add to game container
    const gameContainer = document.getElementById('game-container');
    if (gameContainer) {
      gameContainer.appendChild(notification);
    } else {
      document.body.appendChild(notification);
    }
    
    // Animate in
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(-50%) translateY(-20px)';
    
    // Force reflow
    notification.offsetHeight;
    
    // Animate to final position
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(-50%) translateY(0)';
    
    // Remove notification after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => notification.parentNode.removeChild(notification), 500);
    }, 3000);
  }
}
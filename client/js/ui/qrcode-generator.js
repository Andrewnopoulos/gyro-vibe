/**
 * Handles QR code generation for mobile connections
 */
export class QRCodeGenerator {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {SocketManager} socketManager - Socket.IO manager
   * @param {boolean} isPortalMode - Whether the app is in portal mode
   */
  constructor(eventBus, socketManager, isPortalMode = false) {
    this.eventBus = eventBus;
    this.socketManager = socketManager;
    this.isPortalMode = isPortalMode;
    this.qrcodeDisplay = document.getElementById('qrcodeDisplay');
    this.mobileUrl = document.getElementById('mobileUrl');
    
    // In portal mode, hide the URL text immediately
    if (this.isPortalMode && this.mobileUrl) {
      this.mobileUrl.style.display = 'none';
    }
    
    this.setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    this.eventBus.on('session:created', () => {
      this.generateQRCode();
    });
  }

  /**
   * Generate QR code for mobile connection
   */
  generateQRCode() {
    const sessionId = this.socketManager.getSessionId();
    const protocol = window.location.protocol;
    const host = window.location.host;
    const currentUrl = window.location.href;
    const isRailway = currentUrl.includes('railway.app');
    
    if (!sessionId) {
      console.error('Session ID not available for QR code');
      this.qrcodeDisplay.innerHTML = 'Error: Session not created yet';
      return;
    }
    
    let urlToUse;
    let httpUrl;
    let httpsUrl;
    
    // Add session ID to the URL as a query parameter
    if (isRailway) {
      // On Railway, we're already on HTTPS with the correct domain
      urlToUse = `${protocol}//${host}/mobile?session=${sessionId}`;
      // Use the same URL for display
      httpUrl = urlToUse;
      httpsUrl = urlToUse;
    } else {
      let debug_host = host;
    
      if (debug_host.includes('localhost')) {
        debug_host = debug_host.replace('localhost', '192.168.1.127');
      }
    
      // For local development, handle HTTP/HTTPS differences
      // Use current hostname without hardcoding IP
      httpUrl = `http://${debug_host}/mobile?session=${sessionId}`;
      
      // For HTTPS, we need to consider the potential port change (3000 -> 3443)
      let httpsHost = debug_host;
      if (httpsHost.includes(':3000')) {
        httpsHost = httpsHost.replace(':3000', ':3443');
      }
      httpsUrl = `https://${httpsHost}/mobile?session=${sessionId}`;
      
      urlToUse = protocol === 'https:' ? httpsUrl : httpUrl;
    }
    
    // Set the URL text - show appropriate info based on environment
    if (isRailway) {
      this.mobileUrl.innerHTML = `<div><strong>URL:</strong> ${urlToUse}</div>`;
    } else {
      this.mobileUrl.innerHTML = `
        <div><strong>HTTP:</strong> ${httpUrl}</div>
        <div><strong>HTTPS:</strong> ${httpsUrl} (recommended for sensors)</div>`;
    }
    
    // Generate QR code for the most appropriate URL
    try {
      // Create a canvas element first
      const canvas = document.createElement('canvas');
      // In portal mode, make the QR code smaller
      const qrSize = this.isPortalMode ? 150 : 200;
      canvas.width = qrSize;
      canvas.height = qrSize;
      this.qrcodeDisplay.innerHTML = ''; // Clear the container
      this.qrcodeDisplay.appendChild(canvas);
      
      window.QRCodeLib.toCanvas(canvas, urlToUse, {
        width: qrSize,
        margin: 1
      }, function (error) {
        if (error) {
          console.error('Error generating QR code:', error);
          this.qrcodeDisplay.innerHTML = 'Error generating QR code. Please use the URL below.';
        }
      });
    } catch (e) {
      console.error('Exception while generating QR code:', e);
      this.qrcodeDisplay.innerHTML = 'Error generating QR code. Please use the URL below.';
    }
  }
}
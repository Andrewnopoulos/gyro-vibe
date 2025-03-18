import { RTC_CONFIG } from '../config.js';

/**
 * Manages WebRTC connection and data channels
 */
export class WebRTCManager {
  /**
   * @param {EventBus} eventBus - Application event bus
   * @param {SocketManager} socketManager - Socket.IO manager
   */
  constructor(eventBus, socketManager) {
    this.eventBus = eventBus;
    this.socketManager = socketManager;
    this.peerConnection = null;
    this.dataChannel = null;
    this.connectedWithWebRTC = false;
    
    this.setupEventListeners();
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    this.eventBus.on('mobile:joined', (data) => {
      this.initWebRTC();
      this.createOffer();
    });

    this.eventBus.on('mobile:disconnected', () => {
      this.closeConnection();
    });

    this.eventBus.on('webrtc:received-offer', async (data) => {
      await this.handleReceivedOffer(data);
    });

    this.eventBus.on('webrtc:received-answer', async (data) => {
      await this.handleReceivedAnswer(data);
    });

    this.eventBus.on('webrtc:received-ice-candidate', async (data) => {
      await this.handleReceivedICECandidate(data);
    });
    
    this.eventBus.on('calibration:request', () => {
      this.requestCalibration();
    });
    
    // No longer need to forward rune mode events to mobile
  }

  /**
   * Initialize WebRTC peer connection
   */
  initWebRTC() {
    this.peerConnection = new RTCPeerConnection(RTC_CONFIG);
    
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate');
        this.socketManager.emit('webrtc-ice-candidate', {
          targetId: this.socketManager.getMobileSocketId(),
          candidate: event.candidate
        });
      }
    };
    
    this.peerConnection.onconnectionstatechange = () => {
      console.log('WebRTC connection state:', this.peerConnection.connectionState);
      
      if (this.peerConnection.connectionState === 'connected') {
        this.connectedWithWebRTC = true;
        this.eventBus.emit('webrtc:connected');
      } else if (
        this.peerConnection.connectionState === 'disconnected' || 
        this.peerConnection.connectionState === 'failed' ||
        this.peerConnection.connectionState === 'closed'
      ) {
        this.connectedWithWebRTC = false;
        this.eventBus.emit('webrtc:disconnected');
      }
    };
    
    this.peerConnection.ondatachannel = (event) => {
      console.log('Data channel received from peer');
      this.setupDataChannel(event.channel);
    };
    
    console.log('WebRTC peer connection initialized');
    
    // Create the data channel
    this.dataChannel = this.peerConnection.createDataChannel('sensorData', {
      ordered: false,
      maxRetransmits: 0 
    });
    
    this.setupDataChannel(this.dataChannel);
  }

  /**
   * Set up data channel event handlers
   * @param {RTCDataChannel} channel - The data channel
   */
  setupDataChannel(channel) {
    channel.onopen = () => {
      console.log('Data channel is open');
    };
    
    channel.onclose = () => {
      console.log('Data channel closed');
    };
    
    channel.onerror = (error) => {
      console.error('Data channel error:', error);
    };
    
    channel.onmessage = (event) => {
      try {
        // Check if the message is JSON
        if (typeof event.data === 'string' && event.data.startsWith('{')) {
          const jsonData = JSON.parse(event.data);
          
          // Handle different message types
          if (jsonData.type === 'sensor-data') {
            this.eventBus.emit('sensor:data-received', jsonData.data);
          // We've removed rune-related message processing as it's now handled directly on the desktop
          } else if (jsonData.gyro && jsonData.accel) {
            // This is sensor data without a specific type field
            // Convert back to JSON string since VisualizationManager expects a string
            this.eventBus.emit('sensor:data-received', JSON.stringify(jsonData));
          } else {
            // Default handling for other unrecognized types
            this.eventBus.emit('sensor:data-received', event.data);
          }
        } else {
          // Legacy handling for non-JSON data
          console.log('Non-JSON data received, using legacy handling');
          this.eventBus.emit('sensor:data-received', event.data);
        }
      } catch (error) {
        // If parsing fails, treat as plain sensor data
        console.warn('Error parsing data channel message:', error);
        this.eventBus.emit('sensor:data-received', event.data);
      }
    };
  }

  /**
   * Create WebRTC offer
   */
  async createOffer() {
    if (!this.peerConnection) return;
    
    try {
      console.log('Creating WebRTC offer');
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      this.socketManager.emit('webrtc-offer', {
        targetId: this.socketManager.getMobileSocketId(),
        offer: offer
      });
    } catch (e) {
      console.error('Error creating WebRTC offer:', e);
    }
  }

  /**
   * Handle received WebRTC offer
   * @param {Object} data - Offer data
   */
  async handleReceivedOffer(data) {
    console.log('Received WebRTC offer');
    
    if (!this.peerConnection) {
      this.initWebRTC();
    }
    
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      this.socketManager.emit('webrtc-answer', {
        targetId: data.sourceId,
        answer: answer
      });
    } catch (e) {
      console.error('Error handling WebRTC offer:', e);
    }
  }

  /**
   * Handle received WebRTC answer
   * @param {Object} data - Answer data
   */
  async handleReceivedAnswer(data) {
    console.log('Received WebRTC answer');
    
    try {
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    } catch (e) {
      console.error('Error handling WebRTC answer:', e);
    }
  }

  /**
   * Handle received ICE candidate
   * @param {Object} data - ICE candidate data
   */
  async handleReceivedICECandidate(data) {
    console.log('Received ICE candidate');
    
    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
    } catch (e) {
      console.error('Error adding ICE candidate:', e);
    }
  }

  /**
   * Request calibration from mobile device
   */
  requestCalibration() {
    if (this.connectedWithWebRTC && this.dataChannel && this.dataChannel.readyState === 'open') {
      // Send via WebRTC for lower latency
      this.dataChannel.send(JSON.stringify({ type: 'request-calibration' }));
      this.eventBus.emit('calibration:started');
      return true;
    } else if (this.socketManager.isConnected() && this.socketManager.getMobileSocketId()) {
      // Fallback to signaling server if WebRTC not available
      this.socketManager.emit('request-calibration', { 
        targetId: this.socketManager.getMobileSocketId() 
      });
      this.eventBus.emit('calibration:started');
      return true;
    } else {
      console.error('Cannot request calibration: No connection to mobile device');
      return false;
    }
  }

  /**
   * Close WebRTC connection
   */
  closeConnection() {
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    this.connectedWithWebRTC = false;
  }

  // sendRuneModeToggle method removed as we no longer need to communicate rune mode to the mobile device
  
  /**
   * Check if WebRTC is connected
   * @returns {boolean} Connection status
   */
  isConnected() {
    return this.connectedWithWebRTC;
  }
}
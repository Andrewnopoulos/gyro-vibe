import { DataHistory } from './data-history.js';
import { CanvasRenderer } from './canvas-renderer.js';

/**
 * Manages visualizations for sensor data
 */
export class VisualizationManager {
  /**
   * @param {EventBus} eventBus - Application event bus
   */
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.dataHistory = new DataHistory();
    
    // Get DOM elements
    this.gyroData = document.getElementById('gyroData');
    this.accelData = document.getElementById('accelData');
    this.rawData = document.getElementById('rawData');
    this.gyroCanvas = document.getElementById('gyroCanvas');
    this.accelCanvas = document.getElementById('accelCanvas');
    
    // Canvas contexts
    this.gyroCtx = this.gyroCanvas.getContext('2d');
    this.accelCtx = this.accelCanvas.getContext('2d');
    
    // Initialize canvases
    this.initCanvases();
    this.setupEventListeners();
  }

  /**
   * Initialize canvas visualizations
   */
  initCanvases() {
    CanvasRenderer.initCanvas(this.gyroCtx);
    CanvasRenderer.initCanvas(this.accelCtx);
  }

  /**
   * Set up event listeners
   */
  setupEventListeners() {
    this.eventBus.on('sensor:data-received', (dataString) => {
      this.handleSensorData(dataString);
    });
    
    this.eventBus.on('calibration:complete', () => {
      this.resetDataHistory();
    });
  }

  /**
   * Handle incoming sensor data
   * @param {string} dataString - JSON string of sensor data
   */
  handleSensorData(dataString) {
    try {
      const data = JSON.parse(dataString);
      
      // Update raw data display
      this.rawData.textContent = JSON.stringify(data, null, 2);
      
      if (data.gyro) {
        // Update gyroscope data display
        this.gyroData.textContent = `Alpha: ${data.gyro.alpha.toFixed(2)}°
Beta: ${data.gyro.beta.toFixed(2)}°
Gamma: ${data.gyro.gamma.toFixed(2)}°`;
        
        // Add to data history
        this.dataHistory.addDataPoint('gyro', data.gyro);
        
        // Emit gyro data update event
        this.eventBus.emit('sensor:gyro-updated', data.gyro);
      }
      
      if (data.accel) {
        // Update accelerometer data display
        this.accelData.textContent = `X: ${data.accel.x.toFixed(2)}g
Y: ${data.accel.y.toFixed(2)}g
Z: ${data.accel.z.toFixed(2)}g`;
        
        // Add to data history
        this.dataHistory.addDataPoint('accel', data.accel);
        
        // Emit accel data update event
        this.eventBus.emit('sensor:accel-updated', data.accel);
      }
      
      // Update visualizations
      this.updateVisualizations();
    } catch (e) {
      console.error('Error parsing WebRTC sensor data:', e);
    }
  }

  /**
   * Update visualizations
   */
  updateVisualizations() {
    CanvasRenderer.drawData(
      this.gyroCtx, 
      this.dataHistory.getHistory('gyro'), 
      ['red', 'green', 'blue']
    );
    
    CanvasRenderer.drawData(
      this.accelCtx, 
      this.dataHistory.getHistory('accel'), 
      ['purple', 'orange', 'cyan']
    );
  }

  /**
   * Reset data history after calibration
   */
  resetDataHistory() {
    this.dataHistory.clearHistory();
    this.updateVisualizations();
  }
}
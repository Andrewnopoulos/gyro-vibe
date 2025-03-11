import { MAX_DATA_POINTS } from '../config.js';

/**
 * Manages sensor data history for visualization
 */
export class DataHistory {
  constructor() {
    this.data = {
      gyro: {
        alpha: [],
        beta: [],
        gamma: []
      },
      accel: {
        x: [],
        y: [],
        z: []
      }
    };
  }

  /**
   * Add data point to history
   * @param {string} type - Data type ('gyro' or 'accel')
   * @param {Object} data - Sensor data
   */
  addDataPoint(type, data) {
    for (const key in data) {
      if (this.data[type][key]) {
        this.data[type][key].push(data[key]);
        if (this.data[type][key].length > MAX_DATA_POINTS) {
          this.data[type][key].shift();
        }
      }
    }
  }

  /**
   * Clear all data history
   */
  clearHistory() {
    for (const type in this.data) {
      for (const key in this.data[type]) {
        this.data[type][key] = [];
      }
    }
  }

  /**
   * Get data history for a specific type
   * @param {string} type - Data type ('gyro' or 'accel')
   * @returns {Object} Data history
   */
  getHistory(type) {
    return this.data[type];
  }

  /**
   * Get all data history
   * @returns {Object} All data history
   */
  getAllHistory() {
    return this.data;
  }
}
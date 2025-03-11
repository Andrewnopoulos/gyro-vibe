import { MAX_DATA_POINTS } from '../config.js';

/**
 * Handles drawing sensor data on canvas
 */
export class CanvasRenderer {
  /**
   * Initialize canvas with empty data
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   */
  static initCanvas(ctx) {
    this.drawData(ctx, { alpha: [], beta: [], gamma: [] }, ['red', 'green', 'blue']);
  }

  /**
   * Draw data on canvas
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {Object} data - Data to draw
   * @param {Array<string>} colors - Colors for each data series
   */
  static drawData(ctx, data, colors) {
    // Clear canvas
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Draw grid
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 1;
    for (let i = 0; i < ctx.canvas.width; i += 20) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, ctx.canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < ctx.canvas.height; i += 20) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(ctx.canvas.width, i);
      ctx.stroke();
    }
    
    // Draw center line
    ctx.strokeStyle = '#aaa';
    ctx.beginPath();
    ctx.moveTo(0, ctx.canvas.height / 2);
    ctx.lineTo(ctx.canvas.width, ctx.canvas.height / 2);
    ctx.stroke();
    
    // Draw data lines
    const keys = Object.keys(data);
    const step = ctx.canvas.width / (MAX_DATA_POINTS - 1);
    
    keys.forEach((key, index) => {
      const values = data[key];
      if (values.length > 1) {
        ctx.strokeStyle = colors[index];
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        // Start at the oldest data point
        for (let i = 0; i < values.length; i++) {
          const x = i * step;
          // Scale the value to fit within the canvas
          const maxValue = key === 'z' ? 10 : 180;
          const y = ctx.canvas.height / 2 - (values[i] / maxValue) * (ctx.canvas.height / 2);
          
          if (i === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.stroke();
      }
    });
  }
}
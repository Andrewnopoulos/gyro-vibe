// Connect to the Socket.IO server
const socket = io();

// DOM elements
const deviceStatus = document.getElementById('deviceStatus');
const gyroData = document.getElementById('gyroData');
const accelData = document.getElementById('accelData');
const rawData = document.getElementById('rawData');
const qrcodeDisplay = document.getElementById('qrcodeDisplay');
const mobileUrl = document.getElementById('mobileUrl');
const gyroCanvas = document.getElementById('gyroCanvas');
const accelCanvas = document.getElementById('accelCanvas');

// Canvas contexts
const gyroCtx = gyroCanvas.getContext('2d');
const accelCtx = accelCanvas.getContext('2d');

// Data history for visualization
const dataHistory = {
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

const MAX_DATA_POINTS = 50;

// Generate QR code for mobile connection
function generateQRCode() {
  const protocol = window.location.protocol;
  const host = window.location.host;
  const mobileUrlText = `${protocol}//${host}/mobile`;
  
  // Set the URL text
  mobileUrl.textContent = mobileUrlText;
  
  // Generate QR code
  QRCode.toCanvas(qrcodeDisplay, mobileUrlText, {
    width: 200,
    margin: 1
  }, function (error) {
    if (error) console.error('Error generating QR code:', error);
  });
}

// Initialize the visualizations
function initCanvas(ctx) {
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 1;
  
  // Draw grid lines
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
}

// Draw data on the canvas
function drawData(ctx, data, colors) {
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
      
      // Start at the oldest data point (array start)
      for (let i = 0; i < values.length; i++) {
        const x = i * step;
        // Scale the value to fit within the canvas
        // Assuming values range from -180 to 180 for gyro or -10 to 10 for accel
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

// Add data to history and keep only the latest MAX_DATA_POINTS
function addDataPoint(type, data) {
  for (const key in data) {
    if (dataHistory[type][key]) {
      dataHistory[type][key].push(data[key]);
      if (dataHistory[type][key].length > MAX_DATA_POINTS) {
        dataHistory[type][key].shift();
      }
    }
  }
}

// Update visualization
function updateVisualizations() {
  drawData(gyroCtx, dataHistory.gyro, ['red', 'green', 'blue']);
  drawData(accelCtx, dataHistory.accel, ['purple', 'orange', 'cyan']);
}

// Socket.IO event handlers
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
  generateQRCode();
  initCanvas(gyroCtx);
  initCanvas(accelCtx);
});

socket.on('mobile-connected', (socketId) => {
  deviceStatus.textContent = `Mobile device connected (${socketId})`;
  deviceStatus.className = 'connected';
});

socket.on('device-disconnected', (socketId) => {
  deviceStatus.textContent = 'No mobile device connected';
  deviceStatus.className = 'disconnected';
});

socket.on('sensor-data', (data) => {
  // Update raw data display
  rawData.textContent = JSON.stringify(data, null, 2);
  
  if (data.gyro) {
    // Update gyroscope data display
    gyroData.textContent = `Alpha: ${data.gyro.alpha.toFixed(2)}°
Beta: ${data.gyro.beta.toFixed(2)}°
Gamma: ${data.gyro.gamma.toFixed(2)}°`;
    
    // Add to data history
    addDataPoint('gyro', data.gyro);
  }
  
  if (data.accel) {
    // Update accelerometer data display
    accelData.textContent = `X: ${data.accel.x.toFixed(2)}g
Y: ${data.accel.y.toFixed(2)}g
Z: ${data.accel.z.toFixed(2)}g`;
    
    // Add to data history
    addDataPoint('accel', data.accel);
  }
  
  // Update visualizations
  updateVisualizations();
});
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
const phone3dContainer = document.getElementById('phone3d');

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

// Three.js variables
let scene, camera, renderer, phone;
let lastGyroData = { alpha: 0, beta: 0, gamma: 0 };
let animationFrameId = null;

// Calibration button
const calibrateBtn = document.getElementById('calibrateBtn');

// Generate QR code for mobile connection
function generateQRCode() {
  const protocol = window.location.protocol;
  const host = window.location.host;
  const httpUrl = `http://${host}/mobile`;
  
  // For HTTPS, we need to consider the potential port change (3000 -> 3443)
  let httpsHost = host;
  if (host.includes(':3000')) {
    httpsHost = host.replace(':3000', ':3443');
  }
  const httpsUrl = `https://${httpsHost}/mobile`;
  
  const urlToUse = protocol === 'https:' ? httpsUrl : httpUrl;
  
  // Set the URL text - show both options
  mobileUrl.innerHTML = `
    <div><strong>HTTP:</strong> ${httpUrl}</div>
    <div><strong>HTTPS:</strong> ${httpsUrl} (recommended for sensors)</div>
  `;
  
  // Generate QR code for the most appropriate URL
  QRCode.toCanvas(qrcodeDisplay, urlToUse, {
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

// Initialize 3D scene
function init3DScene() {
  // Create scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf0f0f0);

  // Create camera
  camera = new THREE.PerspectiveCamera(75, phone3dContainer.clientWidth / phone3dContainer.clientHeight, 0.1, 1000);
  camera.position.z = 5;

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(phone3dContainer.clientWidth, phone3dContainer.clientHeight);
  phone3dContainer.appendChild(renderer.domElement);

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
  scene.add(ambientLight);

  // Add directional light
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(1, 1, 1);
  scene.add(directionalLight);

  // Create phone model
  createPhoneModel();

  // Add coordinate axes for reference
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);

  // Start animation loop
  animate();

  // Handle window resize
  window.addEventListener('resize', onWindowResize, false);
}

// Create phone model
function createPhoneModel() {
  // Phone dimensions
  const width = 0.8;
  const height = 1.6;
  const depth = 0.1;

  // Create phone body
  const phoneGeometry = new THREE.BoxGeometry(width, height, depth);
  const phoneMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x333333,
    specular: 0x111111,
    shininess: 30
  });
  phone = new THREE.Mesh(phoneGeometry, phoneMaterial);
  scene.add(phone);

  // Add screen to the phone
  const screenGeometry = new THREE.BoxGeometry(width * 0.9, height * 0.9, depth * 0.1);
  const screenMaterial = new THREE.MeshBasicMaterial({ color: 0x3355ff });
  const screen = new THREE.Mesh(screenGeometry, screenMaterial);
  screen.position.z = depth / 2 + 0.01;
  phone.add(screen);

  // Add camera lens
  const lensGeometry = new THREE.CircleGeometry(0.05, 32);
  const lensMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const lens = new THREE.Mesh(lensGeometry, lensMaterial);
  lens.position.set(0, height * 0.35, depth / 2 + 0.01);
  phone.add(lens);
}

// Animation loop
function animate() {
  animationFrameId = requestAnimationFrame(animate);
  renderer.render(scene, camera);
}

// Update phone orientation based on gyroscope data
function updatePhoneOrientation(gyroData) {
  if (!phone) return;

  // Convert degrees to radians
  const degToRad = Math.PI / 180;

  // Apply rotations in the correct order
  phone.rotation.set(0, 0, 0); // Reset rotation
  
  // Apply rotations in ZXY order to match device orientation
  // Alpha is rotation around Z axis (compass direction)
  // Beta is front-to-back tilt
  // Gamma is left-to-right tilt
  
  // First rotate around Y (beta)
  phone.rotateX(gyroData.beta * degToRad);
  
  // Then rotate around X (gamma)
  phone.rotateY(gyroData.gamma * degToRad);
  
  // Finally rotate around Z (alpha)
  phone.rotateZ(-gyroData.alpha * degToRad);
}

// Handle window resize
function onWindowResize() {
  if (camera && renderer) {
    camera.aspect = phone3dContainer.clientWidth / phone3dContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(phone3dContainer.clientWidth, phone3dContainer.clientHeight);
  }
}

// Socket.IO event handlers
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
  generateQRCode();
  initCanvas(gyroCtx);
  initCanvas(accelCtx);
  init3DScene();
});

socket.on('mobile-connected', (socketId) => {
  deviceStatus.textContent = `Mobile device connected (${socketId})`;
  deviceStatus.className = 'connected';
  calibrateBtn.disabled = false;
});

socket.on('device-disconnected', (socketId) => {
  deviceStatus.textContent = 'No mobile device connected';
  deviceStatus.className = 'disconnected';
  calibrateBtn.disabled = true;
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
    
    // Update 3D phone model orientation
    lastGyroData = data.gyro;
    updatePhoneOrientation(lastGyroData);
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

// Handle calibration complete event from mobile
socket.on('calibration-complete', (calibrationData) => {
  deviceStatus.textContent = `Mobile device connected - Calibrated!`;
  deviceStatus.className = 'connected';
  
  // Reset data history after calibration
  dataHistory.gyro.alpha = [];
  dataHistory.gyro.beta = [];
  dataHistory.gyro.gamma = [];
  dataHistory.accel.x = [];
  dataHistory.accel.y = [];
  dataHistory.accel.z = [];
  
  // Show notification
  const notification = document.createElement('div');
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.backgroundColor = '#17a2b8';
  notification.style.color = 'white';
  notification.style.padding = '10px 20px';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '1000';
  notification.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  notification.textContent = 'Sensors calibrated successfully!';
  document.body.appendChild(notification);
  
  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s';
    setTimeout(() => document.body.removeChild(notification), 500);
  }, 3000);
});

// Send calibration request to mobile device
function requestCalibration() {
  if (socket && socket.connected) {
    socket.emit('request-calibration');
    deviceStatus.textContent = 'Calibrating sensors...';
  }
}

// Handle calibration failure
socket.on('calibration-failed', (data) => {
  deviceStatus.textContent = `Mobile device connected - Calibration failed`;
  
  // Show error notification
  const notification = document.createElement('div');
  notification.style.position = 'fixed';
  notification.style.top = '20px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.backgroundColor = '#dc3545';
  notification.style.color = 'white';
  notification.style.padding = '10px 20px';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '1000';
  notification.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  notification.textContent = `Calibration failed: ${data.reason || 'Unknown error'}. Please start sensors on mobile first.`;
  document.body.appendChild(notification);
  
  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s';
    setTimeout(() => document.body.removeChild(notification), 500);
  }, 3000);
});

// Calibrate button event listener
calibrateBtn.addEventListener('click', requestCalibration);
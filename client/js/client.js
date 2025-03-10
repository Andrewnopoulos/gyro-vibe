// Import Three.js modules
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Connect to the Socket.IO server for signaling
const socket = window.SocketIOLib();

// WebRTC variables
let peerConnection = null;
let dataChannel = null;
let sessionId = null;
let mobileSocketId = null;
let connectedWithWebRTC = false;

// RTC configuration with standard STUN servers
const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

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
const defaultCameraPosition = { x: 3, y: 2, z: 3 };
let orbitControls;

// UI buttons
const calibrateBtn = document.getElementById('calibrateBtn');
const resetViewBtn = document.getElementById('resetViewBtn');

// Initialize WebRTC peer connection
function initWebRTC() {
  // Create a new RTCPeerConnection
  peerConnection = new RTCPeerConnection(rtcConfig);
  
  // Set up event handlers for the peer connection
  peerConnection.onicecandidate = handleICECandidate;
  peerConnection.onconnectionstatechange = handleConnectionStateChange;
  peerConnection.ondatachannel = handleDataChannel;
  
  console.log('WebRTC peer connection initialized');
  
  // Create the data channel for sending calibration requests
  dataChannel = peerConnection.createDataChannel('sensorData', {
    ordered: false,  // Use unordered delivery for lower latency
    maxRetransmits: 0 // Don't retransmit lost packets
  });
  
  // Set up data channel event handlers
  setupDataChannel(dataChannel);
}

// Handle ICE candidate events
function handleICECandidate(event) {
  if (event.candidate) {
    console.log('Sending ICE candidate');
    // Send the ICE candidate to the peer via the signaling server
    socket.emit('webrtc-ice-candidate', {
      targetId: mobileSocketId,
      candidate: event.candidate
    });
  }
}

// Handle connection state changes
function handleConnectionStateChange(event) {
  console.log('WebRTC connection state:', peerConnection.connectionState);
  
  if (peerConnection.connectionState === 'connected') {
    connectedWithWebRTC = true;
    deviceStatus.textContent = 'Mobile device connected via WebRTC';
    deviceStatus.className = 'connected';
    calibrateBtn.disabled = false;
    console.log('WebRTC connection established successfully');
  } else if (peerConnection.connectionState === 'disconnected' || 
             peerConnection.connectionState === 'failed' ||
             peerConnection.connectionState === 'closed') {
    connectedWithWebRTC = false;
    deviceStatus.textContent = 'WebRTC connection lost';
    deviceStatus.className = 'disconnected';
    calibrateBtn.disabled = true;
    console.log('WebRTC connection lost');
  }
}

// Handle incoming data channels
function handleDataChannel(event) {
  console.log('Data channel received from peer');
  setupDataChannel(event.channel);
}

// Set up data channel event handlers
function setupDataChannel(channel) {
  channel.onopen = () => {
    console.log('Data channel is open');
    deviceStatus.textContent = 'Mobile device connected via WebRTC';
    deviceStatus.className = 'connected';
    calibrateBtn.disabled = false;
  };
  
  channel.onclose = () => {
    console.log('Data channel closed');
    deviceStatus.textContent = 'WebRTC connection lost';
    deviceStatus.className = 'disconnected';
    calibrateBtn.disabled = true;
  };
  
  channel.onerror = (error) => {
    console.error('Data channel error:', error);
  };
  
  channel.onmessage = (event) => {
    // Handle incoming messages from the mobile device
    handleSensorData(event.data);
  };
}

// Handle incoming sensor data from WebRTC
function handleSensorData(dataString) {
  try {
    const data = JSON.parse(dataString);
    
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
  } catch (e) {
    console.error('Error parsing WebRTC sensor data:', e);
  }
}

// Create WebRTC offer
async function createOffer() {
  if (!peerConnection) return;
  
  try {
    console.log('Creating WebRTC offer');
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    
    // Send the offer to the mobile client through the signaling server
    socket.emit('webrtc-offer', {
      targetId: mobileSocketId,
      offer: offer
    });
  } catch (e) {
    console.error('Error creating WebRTC offer:', e);
  }
}

// Generate QR code for mobile connection
function generateQRCode() {
  const protocol = window.location.protocol;
  const host = window.location.host;
  const currentUrl = window.location.href;
  const isRailway = currentUrl.includes('railway.app');
  
  if (!sessionId) {
    console.error('Session ID not available for QR code');
    qrcodeDisplay.innerHTML = 'Error: Session not created yet';
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
    // For local development, handle HTTP/HTTPS differences
    httpUrl = `http://${host}/mobile?session=${sessionId}`;
    
    // For HTTPS, we need to consider the potential port change (3000 -> 3443)
    let httpsHost = host;
    if (host.includes(':3000')) {
      httpsHost = host.replace(':3000', ':3443');
    }
    httpsUrl = `https://${httpsHost}/mobile?session=${sessionId}`;
    
    urlToUse = protocol === 'https:' ? httpsUrl : httpUrl;
  }
  
  // Set the URL text - show appropriate info based on environment
  if (isRailway) {
    mobileUrl.innerHTML = `<div><strong>URL:</strong> ${urlToUse}</div>`;
  } else {
    mobileUrl.innerHTML = `
      <div><strong>HTTP:</strong> ${httpUrl}</div>
      <div><strong>HTTPS:</strong> ${httpsUrl} (recommended for sensors)</div>`;
  }
  
  // Generate QR code for the most appropriate URL
  // Use the global QRCodeLib variable we defined
  try {
    // Create a canvas element first
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 200;
    qrcodeDisplay.innerHTML = ''; // Clear the container
    qrcodeDisplay.appendChild(canvas);
    
    window.QRCodeLib.toCanvas(canvas, urlToUse, {
      width: 200,
      margin: 1
    }, function (error) {
      if (error) {
        console.error('Error generating QR code:', error);
        qrcodeDisplay.innerHTML = 'Error generating QR code. Please use the URL below.';
      }
    });
  } catch (e) {
    console.error('Exception while generating QR code:', e);
    qrcodeDisplay.innerHTML = 'Error generating QR code. Please use the URL below.';
  }
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
  camera = new THREE.PerspectiveCamera(60, phone3dContainer.clientWidth / phone3dContainer.clientHeight, 0.1, 1000);
  camera.position.set(defaultCameraPosition.x, defaultCameraPosition.y, defaultCameraPosition.z);
  camera.lookAt(0, 0, 0);

  // Create renderer with shadows enabled
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(phone3dContainer.clientWidth, phone3dContainer.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  phone3dContainer.appendChild(renderer.domElement);

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0x404040, 1.5);
  scene.add(ambientLight);

  // Add directional light with shadows
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(5, 5, 5);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  directionalLight.shadow.camera.near = 0.5;
  directionalLight.shadow.camera.far = 20;
  scene.add(directionalLight);

  // Add a subtle hemisphere light for better ambient lighting
  const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x080820, 0.5);
  scene.add(hemisphereLight);

  // Add a grid helper to show the ground plane
  const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0xcccccc);
  scene.add(gridHelper);

  // Add world coordinate axes for reference
  const axesHelper = new THREE.AxesHelper(5);
  scene.add(axesHelper);

  // Create phone model
  createPhoneModel();

  // Add a small info element explaining the colors
  const axisInfoDiv = document.createElement('div');
  axisInfoDiv.style.position = 'absolute';
  axisInfoDiv.style.bottom = '10px';
  axisInfoDiv.style.left = '10px';
  axisInfoDiv.style.backgroundColor = 'rgba(0,0,0,0.5)';
  axisInfoDiv.style.color = 'white';
  axisInfoDiv.style.padding = '5px';
  axisInfoDiv.style.fontSize = '12px';
  axisInfoDiv.style.borderRadius = '3px';
  axisInfoDiv.innerHTML = 'Phone axes: <span style="color:red">X</span>, <span style="color:green">Y</span>, <span style="color:blue">Z</span>';
  phone3dContainer.appendChild(axisInfoDiv);

  // Add orbit controls for interactive viewing
  orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.25;
  orbitControls.screenSpacePanning = false;
  orbitControls.maxPolarAngle = Math.PI;
  orbitControls.minDistance = 2;
  orbitControls.maxDistance = 10;
  
  // Start animation loop
  animate();

  // Handle window resize
  window.addEventListener('resize', onWindowResize, false);
  
  // Add click handler for reset view button
  resetViewBtn.addEventListener('click', resetCameraView);
  
  // Debug message to confirm initialization
  console.log('3D scene initialized successfully');
}

// Create phone model
function createPhoneModel() {
  // Phone dimensions
  const width = 0.8;
  const height = 1.6;
  const depth = 0.1;

  // Create phone group
  phone = new THREE.Group();
  scene.add(phone);

  // Create phone body
  const phoneGeometry = new THREE.BoxGeometry(width, height, depth);
  const phoneMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x333333,
    specular: 0x111111,
    shininess: 30
  });
  const phoneBody = new THREE.Mesh(phoneGeometry, phoneMaterial);
  phone.add(phoneBody);

  // Add screen to the phone (front side)
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
  
  // Add home button at the bottom to indicate orientation
  const homeButtonGeometry = new THREE.CircleGeometry(0.08, 32);
  const homeButtonMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
  const homeButton = new THREE.Mesh(homeButtonGeometry, homeButtonMaterial);
  homeButton.position.set(0, -height * 0.4, depth / 2 + 0.01);
  phone.add(homeButton);
  
  // Add text indicator for front side
  const frontTextGeometry = new THREE.BoxGeometry(width * 0.5, height * 0.1, depth * 0.05);
  const frontTextMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const frontText = new THREE.Mesh(frontTextGeometry, frontTextMaterial);
  frontText.position.set(0, 0, depth / 2 + 0.02);
  phone.add(frontText);
  
  // Add indicator for the top of the phone
  const topIndicatorGeometry = new THREE.BoxGeometry(width * 0.3, height * 0.05, depth * 0.05);
  const topIndicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const topIndicator = new THREE.Mesh(topIndicatorGeometry, topIndicatorMaterial);
  topIndicator.position.set(0, height * 0.45, depth / 2 + 0.02);
  phone.add(topIndicator);

  // Add X, Y, Z axes indicators for better visualization
  const axisLength = 0.4;
  
  // X axis (red) - points right from the phone's perspective
  const xAxisGeometry = new THREE.CylinderGeometry(0.02, 0.02, axisLength, 8);
  const xAxisMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const xAxis = new THREE.Mesh(xAxisGeometry, xAxisMaterial);
  xAxis.rotation.z = Math.PI / 2; // Rotate to point along X axis
  xAxis.position.set(axisLength/2, 0, 0);
  phone.add(xAxis);
  
  // Y axis (green) - points up from the phone's perspective
  const yAxisGeometry = new THREE.CylinderGeometry(0.02, 0.02, axisLength, 8);
  const yAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const yAxis = new THREE.Mesh(yAxisGeometry, yAxisMaterial);
  yAxis.position.set(0, axisLength/2, 0);
  phone.add(yAxis);
  
  // Z axis (blue) - points out from the phone's screen
  const zAxisGeometry = new THREE.CylinderGeometry(0.02, 0.02, axisLength, 8);
  const zAxisMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
  const zAxis = new THREE.Mesh(zAxisGeometry, zAxisMaterial);
  zAxis.rotation.x = Math.PI / 2; // Rotate to point along Z axis
  zAxis.position.set(0, 0, axisLength/2);
  phone.add(zAxis);
  
  console.log('Phone model created successfully');
}

// Animation loop
function animate() {
  animationFrameId = requestAnimationFrame(animate);
  
  // Update orbit controls
  if (orbitControls) {
    orbitControls.update();
  }
  
  renderer.render(scene, camera);
}

// Function to reset camera view to default position
function resetCameraView() {
  if (camera && orbitControls) {
    // Animate the camera back to original position
    const duration = 1000; // Duration in milliseconds
    const startTime = Date.now();
    const startPosition = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    
    function animateReset() {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use easing function for smoother motion
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
      
      // Interpolate position
      camera.position.set(
        startPosition.x + (defaultCameraPosition.x - startPosition.x) * easeProgress,
        startPosition.y + (defaultCameraPosition.y - startPosition.y) * easeProgress,
        startPosition.z + (defaultCameraPosition.z - startPosition.z) * easeProgress
      );
      
      // Look at the center
      camera.lookAt(0, 0, 0);
      
      // Reset orbit controls target and update
      orbitControls.target.set(0, 0, 0);
      orbitControls.update();
      
      // Continue animation if not finished
      if (progress < 1) {
        requestAnimationFrame(animateReset);
      }
    }
    
    // Start animation
    animateReset();
  }
}

const degtorad = Math.PI / 180;

function getQuaternion( alpha, beta, gamma ) {

  var _x = beta  ? beta  * degtorad : 0; // beta value
  var _y = gamma ? gamma * degtorad : 0; // gamma value
  var _z = alpha ? alpha * degtorad : 0; // alpha value

  var cX = Math.cos( _x/2 );
  var cY = Math.cos( _y/2 );
  var cZ = Math.cos( _z/2 );
  var sX = Math.sin( _x/2 );
  var sY = Math.sin( _y/2 );
  var sZ = Math.sin( _z/2 );

  //
  // ZXY quaternion construction.
  //

  var w = cX * cY * cZ - sX * sY * sZ;
  var x = sX * cY * cZ - cX * sY * sZ;
  var y = cX * sY * cZ + sX * cY * sZ;
  var z = cX * cY * sZ + sX * sY * cZ;

  return [ w, x, y, z ];

}

function updatePhoneOrientation(gyroData) {
  if (!phone) return;

  const [w, x, y, z] = getQuaternion(gyroData.alpha, gyroData.beta, gyroData.gamma);

  // Compute the target quaternion
  const targetQuaternion = new THREE.Quaternion(x, y, z, w);

  // Smoothly interpolate from the current to the target quaternion
  phone.quaternion.copy(targetQuaternion);
}

// Handle window resize
function onWindowResize() {
  if (camera && renderer) {
    camera.aspect = phone3dContainer.clientWidth / phone3dContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(phone3dContainer.clientWidth, phone3dContainer.clientHeight);
  }
}

// Socket.IO event handlers for WebRTC signaling
socket.on('connect', () => {
  console.log('Connected to signaling server with ID:', socket.id);
  // Register as a desktop client
  socket.emit('register-desktop');
  // Initialize UI elements
  initCanvas(gyroCtx);
  initCanvas(accelCtx);
  init3DScene();
});

// Receive session ID from server
socket.on('session-created', (data) => {
  sessionId = data.sessionId;
  console.log('Session created with ID:', sessionId);
  // Now we can generate the QR code with the session ID
  generateQRCode();
  
  // Update status
  deviceStatus.textContent = 'Waiting for mobile device to connect...';
  deviceStatus.className = 'disconnected';
});

// Mobile client has joined our session
socket.on('mobile-joined', (data) => {
  console.log('Mobile device joined with socket ID:', data.mobileSocketId);
  mobileSocketId = data.mobileSocketId;
  deviceStatus.textContent = 'Mobile connected, establishing WebRTC...';
  deviceStatus.className = 'connecting';
  
  // Initialize WebRTC
  initWebRTC();
  
  // Create and send offer to mobile
  createOffer();
});

// Mobile client disconnected
socket.on('mobile-disconnected', () => {
  console.log('Mobile device disconnected');
  deviceStatus.textContent = 'Mobile device disconnected';
  deviceStatus.className = 'disconnected';
  calibrateBtn.disabled = true;
  
  // Clean up WebRTC connection
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  if (dataChannel) {
    dataChannel.close();
    dataChannel = null;
  }
  connectedWithWebRTC = false;
});

// WebRTC signaling - handle offer from mobile
socket.on('webrtc-offer', async (data) => {
  console.log('Received WebRTC offer from mobile');
  
  if (!peerConnection) {
    initWebRTC();
  }
  
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    
    socket.emit('webrtc-answer', {
      targetId: data.sourceId,
      answer: answer
    });
  } catch (e) {
    console.error('Error handling WebRTC offer:', e);
  }
});

// WebRTC signaling - handle answer from mobile
socket.on('webrtc-answer', async (data) => {
  console.log('Received WebRTC answer from mobile');
  
  try {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
  } catch (e) {
    console.error('Error handling WebRTC answer:', e);
  }
});

// WebRTC signaling - handle ICE candidates
socket.on('webrtc-ice-candidate', async (data) => {
  console.log('Received ICE candidate from mobile');
  
  try {
    await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
  } catch (e) {
    console.error('Error adding ICE candidate:', e);
  }
});

// Handle calibration complete
socket.on('calibration-complete', (calibrationData) => {
  deviceStatus.textContent = `Mobile device connected via WebRTC - Calibrated!`;
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

// Send calibration request to mobile device via WebRTC
function requestCalibration() {
  if (connectedWithWebRTC && dataChannel && dataChannel.readyState === 'open') {
    // Send via WebRTC for lower latency
    dataChannel.send(JSON.stringify({ type: 'request-calibration' }));
    deviceStatus.textContent = 'Calibrating sensors via WebRTC...';
  } else if (socket && socket.connected && mobileSocketId) {
    // Fallback to signaling server if WebRTC not available
    socket.emit('request-calibration', { targetId: mobileSocketId });
    deviceStatus.textContent = 'Calibrating sensors via signaling...';
  } else {
    console.error('Cannot request calibration: No connection to mobile device');
  }
}

// Calibrate button event listener
calibrateBtn.addEventListener('click', requestCalibration);

// Log initialization to help with debugging
console.log('Client script loaded and initialized');
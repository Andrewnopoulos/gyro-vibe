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

// First-person camera variables
let firstPersonMode = false;
let playerHeight = 1.6; // Player height in units (average human height)
let moveSpeed = 0.25; // Movement speed (increased for faster walking)
let lookSpeed = 0.002; // Look sensitivity
let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;
let velocity = new THREE.Vector3();
let direction = new THREE.Vector3();
let prevTime = performance.now();

// FPS weapon view variables
let weaponPhone = null; // Separate phone model for weapon view
let weaponScene = null; // Separate scene for weapon view
let weaponCamera = null; // Camera for the weapon view
let weaponRenderer = null; // Renderer for the weapon view
let weaponContainer = null; // DOM container for weapon view
let weaponBobbing = { // For realistic weapon bobbing effect
  time: 0,
  intensity: 0.015,
  speed: 4
};

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
    // Connection status is now managed by handleConnectionStateChange
  };
  
  channel.onclose = () => {
    console.log('Data channel closed');
    // Connection status is now managed by handleConnectionStateChange
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
      
      // Store gyro data for camera or phone model updates
      lastGyroData = data.gyro;
      
      // Update 3D phone model orientation if not in first-person mode
      if (!firstPersonMode) {
        updatePhoneOrientation(lastGyroData);
      }
      // Note: In first-person mode, camera rotation is updated in updateFirstPersonControls
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
    let debug_host = host;

    if (debug_host.includes('localhost')) {
      debug_host = debug_host.replace('localhost', '192.168.1.127')
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

// Initialize the visualizations - this is now handled by drawData()
function initCanvas(ctx) {
  drawData(ctx, { alpha: [], beta: [], gamma: [] }, ['red', 'green', 'blue']);
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
  
  // Create camera
  camera = new THREE.PerspectiveCamera(75, phone3dContainer.clientWidth / phone3dContainer.clientHeight, 0.1, 1000);
  camera.position.set(defaultCameraPosition.x, defaultCameraPosition.y, defaultCameraPosition.z);
  camera.lookAt(0, 0, 0);

  // Create renderer with shadows enabled
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(phone3dContainer.clientWidth, phone3dContainer.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  phone3dContainer.appendChild(renderer.domElement);
  
  // Create skybox
  createSkybox();
  
  // Create game environment
  createGameEnvironment();
  
  // Setup game lighting
  setupGameLighting();

  // Create phone model
  createPhoneModel();
  
  // Initialize weapon view for first-person mode
  initWeaponView();

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
  orbitControls.maxDistance = 30;
  
  // Add first-person mode button
  const fpModeBtn = document.createElement('button');
  fpModeBtn.textContent = 'First Person Mode';
  fpModeBtn.style.position = 'absolute';
  fpModeBtn.style.top = '10px';
  fpModeBtn.style.right = '10px';
  fpModeBtn.style.padding = '5px 10px';
  fpModeBtn.style.backgroundColor = '#4CAF50';
  fpModeBtn.style.color = 'white';
  fpModeBtn.style.border = 'none';
  fpModeBtn.style.borderRadius = '4px';
  fpModeBtn.style.cursor = 'pointer';
  fpModeBtn.style.zIndex = '1000';
  fpModeBtn.onclick = toggleFirstPersonMode;
  phone3dContainer.appendChild(fpModeBtn);
  
  // Add controls guide for first-person mode
  const controlsGuide = document.createElement('div');
  controlsGuide.style.position = 'absolute';
  controlsGuide.style.bottom = '10px';
  controlsGuide.style.right = '10px';
  controlsGuide.style.padding = '10px';
  controlsGuide.style.backgroundColor = 'rgba(0,0,0,0.5)';
  controlsGuide.style.color = 'white';
  controlsGuide.style.fontSize = '12px';
  controlsGuide.style.borderRadius = '4px';
  controlsGuide.style.zIndex = '1000';
  controlsGuide.style.display = 'none'; // Hidden by default
  controlsGuide.innerHTML = `
    <strong>Controls:</strong><br>
    W/Arrow Up - Move Forward<br>
    S/Arrow Down - Move Backward<br>
    A/Arrow Left - Move Left<br>
    D/Arrow Right - Move Right<br>
    Mouse - Look Around
  `;
  controlsGuide.id = 'fp-controls-guide';
  phone3dContainer.appendChild(controlsGuide);
  
  // Add keyboard controls event listeners
  document.addEventListener('keydown', onKeyDown, false);
  document.addEventListener('keyup', onKeyUp, false);
  
  // Add mouse movement for first-person camera
  document.addEventListener('mousemove', onMouseMove, false);
  
  // Pointer lock for first-person mode
  phone3dContainer.addEventListener('click', requestPointerLock, false);
  
  // Start animation loop
  animate();

  // Handle window resize
  window.addEventListener('resize', onWindowResize, false);
  
  // Add click handler for reset view button
  resetViewBtn.addEventListener('click', resetCameraView);
  
  // Debug message to confirm initialization
  console.log('3D scene initialized successfully');
}

// Create skybox for game environment
function createSkybox() {
  const skyboxSize = 500;
  const skyboxGeometry = new THREE.BoxGeometry(skyboxSize, skyboxSize, skyboxSize);
  
  // Create skybox materials with gradient colors
  const skyboxMaterials = [
    new THREE.MeshBasicMaterial({ color: 0x0077ff, side: THREE.BackSide }), // Right side
    new THREE.MeshBasicMaterial({ color: 0x0066dd, side: THREE.BackSide }), // Left side
    new THREE.MeshBasicMaterial({ color: 0x0088ff, side: THREE.BackSide }), // Top side
    new THREE.MeshBasicMaterial({ color: 0x005599, side: THREE.BackSide }), // Bottom side
    new THREE.MeshBasicMaterial({ color: 0x0077ee, side: THREE.BackSide }), // Front side
    new THREE.MeshBasicMaterial({ color: 0x0066cc, side: THREE.BackSide })  // Back side
  ];
  
  const skybox = new THREE.Mesh(skyboxGeometry, skyboxMaterials);
  scene.add(skybox);
}

// Create game environment with terrain and decorative elements
function createGameEnvironment() {
  // Create ground plane
  const groundSize = 100;
  const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize, 32, 32);
  const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x3a8c3a, 
    roughness: 0.8,
    metalness: 0.2
  });
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.5;
  ground.receiveShadow = true;
  scene.add(ground);
  
  // Add some random decorative cubes as environment elements
  for (let i = 0; i < 20; i++) {
    const size = Math.random() * 2 + 0.5;
    const cubeGeometry = new THREE.BoxGeometry(size, size, size);
    const cubeMaterial = new THREE.MeshStandardMaterial({
      color: Math.random() > 0.5 ? 0x8a5430 : 0x6a7a8a,
      roughness: 0.7,
      metalness: 0.2
    });
    
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(
      (Math.random() - 0.5) * 40,
      size / 2 - 0.5,
      (Math.random() - 0.5) * 40
    );
    
    cube.castShadow = true;
    cube.receiveShadow = true;
    scene.add(cube);
  }
  
  // Add some larger "buildings" or structures
  for (let i = 0; i < 5; i++) {
    const width = Math.random() * 4 + 2;
    const height = Math.random() * 8 + 4;
    const depth = Math.random() * 4 + 2;
    
    const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
    const buildingMaterial = new THREE.MeshStandardMaterial({
      color: 0x505050 + Math.random() * 0x202020,
      roughness: 0.7,
      metalness: 0.3
    });
    
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.set(
      (Math.random() - 0.5) * 60,
      height / 2 - 0.5,
      (Math.random() - 0.5) * 60
    );
    
    building.castShadow = true;
    building.receiveShadow = true;
    scene.add(building);
  }
}

// Setup game lighting
function setupGameLighting() {
  // Main directional light (sun)
  const sunLight = new THREE.DirectionalLight(0xffffbb, 1.5);
  sunLight.position.set(10, 20, 10);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 50;
  sunLight.shadow.camera.left = -20;
  sunLight.shadow.camera.right = 20;
  sunLight.shadow.camera.top = 20;
  sunLight.shadow.camera.bottom = -20;
  scene.add(sunLight);
  
  // Ambient light for general illumination
  const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
  scene.add(ambientLight);
  
  // Hemisphere light for better sky/ground color transition
  const hemisphereLight = new THREE.HemisphereLight(0x90b0ff, 0x283030, 0.6);
  scene.add(hemisphereLight);
  
  // Add some subtle fog for depth
  scene.fog = new THREE.FogExp2(0x90b0ff, 0.01);
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

// Create weapon phone model for first-person view
function createWeaponPhoneModel() {
  // Phone dimensions - smaller for FPS view
  const width = 0.4;
  const height = 0.8;
  const depth = 0.05;

  // Create weapon phone group
  weaponPhone = new THREE.Group();
  weaponScene.add(weaponPhone);
  
  // Apply a -90 degree rotation around the X axis to the phone model itself
  // This fixes the orientation issue with the model
  weaponPhone.rotateX(-Math.PI / 2);
  
  // Create a container for phone components - this won't get the gyroscope rotation
  // but will maintain the -90 degree correction
  const phoneContainer = new THREE.Group();
  weaponPhone.add(phoneContainer);

  // Create phone body
  const phoneGeometry = new THREE.BoxGeometry(width, height, depth);
  const phoneMaterial = new THREE.MeshPhongMaterial({ 
    color: 0x333333,
    specular: 0x111111,
    shininess: 30
  });
  const phoneBody = new THREE.Mesh(phoneGeometry, phoneMaterial);
  phoneContainer.add(phoneBody);

  // Add screen to the phone (front side)
  const screenGeometry = new THREE.BoxGeometry(width * 0.9, height * 0.9, depth * 0.1);
  const screenMaterial = new THREE.MeshBasicMaterial({ color: 0x22aaff });
  const screen = new THREE.Mesh(screenGeometry, screenMaterial);
  screen.position.z = depth / 2 + 0.01;
  phoneContainer.add(screen);

  // Add camera lens
  const lensGeometry = new THREE.CircleGeometry(0.025, 32);
  const lensMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
  const lens = new THREE.Mesh(lensGeometry, lensMaterial);
  lens.position.set(0, height * 0.35, depth / 2 + 0.01);
  phoneContainer.add(lens);
  
  // Add home button at the bottom to indicate orientation
  const homeButtonGeometry = new THREE.CircleGeometry(0.04, 32);
  const homeButtonMaterial = new THREE.MeshBasicMaterial({ color: 0x555555 });
  const homeButton = new THREE.Mesh(homeButtonGeometry, homeButtonMaterial);
  homeButton.position.set(0, -height * 0.4, depth / 2 + 0.01);
  phoneContainer.add(homeButton);
  
  // Position the phone as a weapon in first-person view
  // This positions the phone in the bottom right portion of the screen
  // like a typical FPS weapon
  weaponPhone.position.set(0.25, -0.2, -0.8);
  
  console.log('Weapon phone model created successfully');
}

// Initialize weapon view for first-person mode
function initWeaponView() {
  // Create a separate container for the weapon view
  weaponContainer = document.createElement('div');
  weaponContainer.style.position = 'absolute';
  weaponContainer.style.top = '0';
  weaponContainer.style.left = '0';
  weaponContainer.style.width = '100%';
  weaponContainer.style.height = '100%';
  weaponContainer.style.pointerEvents = 'none'; // Allow clicks to pass through
  weaponContainer.style.display = 'none'; // Hidden by default
  phone3dContainer.appendChild(weaponContainer);
  
  // Create scene for weapon
  weaponScene = new THREE.Scene();
  
  // Add ambient light to weapon scene
  const ambientLight = new THREE.AmbientLight(0xffffff, 1);
  weaponScene.add(ambientLight);
  
  // Add directional light to weapon scene for better shading
  const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(0, 1, 2);
  weaponScene.add(directionalLight);
  
  // Create camera for weapon view (with wide FOV for dramatic effect)
  weaponCamera = new THREE.PerspectiveCamera(70, phone3dContainer.clientWidth / phone3dContainer.clientHeight, 0.01, 10);
  
  // Create renderer for weapon view with transparent background
  weaponRenderer = new THREE.WebGLRenderer({ 
    antialias: true,
    alpha: true // Transparent background
  });
  weaponRenderer.setSize(phone3dContainer.clientWidth, phone3dContainer.clientHeight);
  weaponRenderer.setClearColor(0x000000, 0); // Transparent
  weaponRenderer.setPixelRatio(window.devicePixelRatio);
  weaponContainer.appendChild(weaponRenderer.domElement);
  
  // Create the weapon phone model
  createWeaponPhoneModel();
  
  console.log('Weapon view initialized successfully');
}

// Animation loop
function animate() {
  animationFrameId = requestAnimationFrame(animate);
  
  const time = performance.now();
  const delta = (time - prevTime) / 1000; // Convert to seconds
  
  if (firstPersonMode) {
    // Update first-person controls
    updateFirstPersonControls(delta);
    
    // First apply the real phone's orientation to the weapon
    if (weaponPhone && lastGyroData) {
      updateWeaponPhoneOrientation(lastGyroData);
    }
    
    // Then apply movement bobbing effect (this keeps position adjustments after orientation)
    updateWeaponBobbing(delta);
    
    // Render the main scene first
    renderer.render(scene, camera);
    
    // Render the weapon view on top
    if (weaponRenderer && weaponScene && weaponCamera) {
      weaponRenderer.render(weaponScene, weaponCamera);
    }
  } else if (orbitControls) {
    // Update orbit controls
    orbitControls.update();
    
    // Render the main scene
    renderer.render(scene, camera);
  }
  
  prevTime = time;
}

// Update weapon bobbing for walking effect
function updateWeaponBobbing(delta) {
  if (!weaponPhone) return;
  
  // Only bob when moving
  const isMoving = moveForward || moveBackward || moveLeft || moveRight;
  
  // Base position for the weapon phone
  const basePosition = { x: 0.25, y: -0.2, z: -0.8 };
  
  if (isMoving) {
    // Increment time for bobbing animation
    weaponBobbing.time += delta * weaponBobbing.speed;
    
    // Calculate very subtle vertical and horizontal bob
    const verticalBob = Math.sin(weaponBobbing.time * 2) * (weaponBobbing.intensity * 0.3);
    const horizontalBob = Math.cos(weaponBobbing.time) * (weaponBobbing.intensity * 0.15);
    
    // Apply subtle bobbing to weapon position
    // Note: The Y and Z axes may be swapped due to the -90 degree rotation we applied
    weaponPhone.position.y = basePosition.y + verticalBob;
    weaponPhone.position.x = basePosition.x + horizontalBob;
    weaponPhone.position.z = basePosition.z;
  } else {
    // Return to the neutral position when not moving
    weaponPhone.position.x = THREE.MathUtils.lerp(weaponPhone.position.x, basePosition.x, delta * 3);
    weaponPhone.position.y = THREE.MathUtils.lerp(weaponPhone.position.y, basePosition.y, delta * 3);
    weaponPhone.position.z = basePosition.z;
  }
}

// Update weapon phone orientation based on real phone gyroscope data
function updateWeaponPhoneOrientation(gyroData) {
  if (!weaponPhone) return;
  
  // Get the base position of the weapon (we'll keep position stable)
  const basePosition = { x: 0.25, y: -0.2, z: -0.8 };
  
  // For 1:1 mapping between real phone and virtual phone, we'll use the quaternion directly
  const [w, x, y, z] = getQuaternion(gyroData.alpha, gyroData.beta, gyroData.gamma);
  const deviceQuaternion = new THREE.Quaternion(x, y, z, w);
  
  // Apply the real phone's orientation directly to our weapon phone
  weaponPhone.quaternion.copy(deviceQuaternion);
  
  // Keep position stable to avoid motion sickness
  weaponPhone.position.set(basePosition.x, basePosition.y, basePosition.z);
}

// Update first-person controls
function updateFirstPersonControls(delta) {
  // Apply damping to slow down movement
  velocity.x -= velocity.x * 10.0 * delta;
  velocity.z -= velocity.z * 10.0 * delta;
  
  // Set movement direction based on key states
  direction.z = Number(moveForward) - Number(moveBackward);
  // Fix left/right direction (invert the values)
  direction.x = Number(moveLeft) - Number(moveRight);
  direction.normalize(); // Normalize for consistent movement speed in all directions
  
  // Move in the direction the camera is facing
  if (moveForward || moveBackward) velocity.z -= direction.z * moveSpeed * delta * 100;
  if (moveLeft || moveRight) velocity.x -= direction.x * moveSpeed * delta * 100;
  
  // Calculate new camera position based on velocity
  const cameraDirection = new THREE.Vector3();
  camera.getWorldDirection(cameraDirection);
  
  // Project movement onto the XZ plane (horizontal movement only)
  const forward = new THREE.Vector3(cameraDirection.x, 0, cameraDirection.z).normalize();
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  
  // Apply movement
  camera.position.add(forward.multiplyScalar(-velocity.z * delta));
  camera.position.add(right.multiplyScalar(velocity.x * delta)); // Fixed by inverting this value
  
  // Maintain player height
  camera.position.y = playerHeight;
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

// Flag to indicate if calibration is in progress
let calibrationInProgress = false;

function updatePhoneOrientation(gyroData) {
  if (!phone) return;

  // Calculate device orientation quaternion
  const [w, x, y, z] = getQuaternion(gyroData.alpha, gyroData.beta, gyroData.gamma);
  const deviceQuaternion = new THREE.Quaternion(x, y, z, w);
  
  if (calibrationInProgress) {
    // During calibration, position the phone flat on its back (screen facing up)
    // This is accomplished with a -90 degree rotation around the X-axis
    const flatQuaternion = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(1, 0, 0), // X-axis
      -Math.PI/2 // -90 degrees rotation
    );
    
    // Apply the flat positioning
    phone.quaternion.copy(flatQuaternion);
  } else {
    // Normal operation - use the device's actual orientation
    phone.quaternion.copy(deviceQuaternion);
  }
}

// Handle window resize
function onWindowResize() {
  if (camera && renderer) {
    camera.aspect = phone3dContainer.clientWidth / phone3dContainer.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(phone3dContainer.clientWidth, phone3dContainer.clientHeight);
    
    // Also update weapon view
    if (weaponCamera && weaponRenderer) {
      weaponCamera.aspect = phone3dContainer.clientWidth / phone3dContainer.clientHeight;
      weaponCamera.updateProjectionMatrix();
      weaponRenderer.setSize(phone3dContainer.clientWidth, phone3dContainer.clientHeight);
    }
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

// Function to end calibration mode
function endCalibrationMode() {
  // Set flag to false to return to normal orientation
  calibrationInProgress = false;
  
  // Remove calibration instruction if it exists
  const instruction = document.getElementById('calibration-instruction');
  if (instruction) {
    instruction.style.opacity = '0';
    instruction.style.transition = 'opacity 0.5s';
    setTimeout(() => instruction.parentNode.removeChild(instruction), 500);
  }
}

// Handle calibration complete
socket.on('calibration-complete', (calibrationData) => {
  deviceStatus.textContent = `Mobile device connected via WebRTC - Calibrated!`;
  deviceStatus.className = 'connected';
  
  // End calibration mode
  endCalibrationMode();
  
  // Reset data history after calibration
  dataHistory.gyro.alpha = [];
  dataHistory.gyro.beta = [];
  dataHistory.gyro.gamma = [];
  dataHistory.accel.x = [];
  dataHistory.accel.y = [];
  dataHistory.accel.z = [];
  
  // Show success notification
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
  
  // End calibration mode
  endCalibrationMode();
  
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
    return;
  }
  
  // Set the calibration flag to show the phone flat on its back
  calibrationInProgress = true;
  
  // Add a visual cue to indicate calibration mode
  const notification = document.createElement('div');
  notification.style.position = 'fixed';
  notification.style.top = '60px';
  notification.style.left = '50%';
  notification.style.transform = 'translateX(-50%)';
  notification.style.backgroundColor = '#17a2b8';
  notification.style.color = 'white';
  notification.style.padding = '10px 20px';
  notification.style.borderRadius = '4px';
  notification.style.zIndex = '1000';
  notification.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  notification.textContent = 'Place device flat on its back (screen facing up) for calibration';
  notification.id = 'calibration-instruction';
  document.body.appendChild(notification);
}

// Calibrate button event listener
calibrateBtn.addEventListener('click', requestCalibration);

// Toggle first-person mode
function toggleFirstPersonMode() {
  firstPersonMode = !firstPersonMode;
  
  // Get UI elements
  const fpModeBtn = document.querySelector('button');
  const controlsGuide = document.getElementById('fp-controls-guide');
  
  if (firstPersonMode) {
    // Switch to first-person mode
    orbitControls.enabled = false;
    
    // Position camera at player height
    camera.position.y = playerHeight;
    
    // Hide regular phone model in first-person mode
    if (phone) {
      phone.visible = false;
    }
    
    // Show weapon phone model
    if (weaponContainer) {
      weaponContainer.style.display = 'block';
    }
    
    // Show controls guide
    if (controlsGuide) {
      controlsGuide.style.display = 'block';
    }
    
    // Update button text
    if (fpModeBtn) {
      fpModeBtn.textContent = 'Exit First Person';
      fpModeBtn.style.backgroundColor = '#dc3545';
    }
    
    // Reset weapon bobbing time
    weaponBobbing.time = 0;
    
    // Request pointer lock for mouse look
    requestPointerLock();
  } else {
    // Switch back to orbit controls
    orbitControls.enabled = true;
    
    // Reset camera position
    resetCameraView();
    
    // Show regular phone model again
    if (phone) {
      phone.visible = true;
    }
    
    // Hide weapon phone model
    if (weaponContainer) {
      weaponContainer.style.display = 'none';
    }
    
    // Hide controls guide
    if (controlsGuide) {
      controlsGuide.style.display = 'none';
    }
    
    // Update button text
    if (fpModeBtn) {
      fpModeBtn.textContent = 'First Person Mode';
      fpModeBtn.style.backgroundColor = '#4CAF50';
    }
    
    // Exit pointer lock
    document.exitPointerLock();
  }
}

// Keyboard event handlers
function onKeyDown(event) {
  if (!firstPersonMode) return;
  
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = true;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = true;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = true;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = true;
      break;
  }
}

function onKeyUp(event) {
  if (!firstPersonMode) return;
  
  switch (event.code) {
    case 'ArrowUp':
    case 'KeyW':
      moveForward = false;
      break;
    case 'ArrowLeft':
    case 'KeyA':
      moveLeft = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      moveBackward = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      moveRight = false;
      break;
  }
}

// Mouse movement handler for first-person camera
function onMouseMove(event) {
  if (!firstPersonMode || !document.pointerLockElement) return;
  
  const movementX = event.movementX || 0;
  const movementY = event.movementY || 0;
  
  // Rotate camera based on mouse movement
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  euler.setFromQuaternion(camera.quaternion);
  
  // Apply pitch (up/down) rotation - limit to avoid flipping
  euler.x -= movementY * lookSpeed;
  euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x));
  
  // Apply yaw (left/right) rotation
  euler.y -= movementX * lookSpeed;
  
  camera.quaternion.setFromEuler(euler);
}

// Request pointer lock for first-person mode
function requestPointerLock() {
  if (!firstPersonMode) return;
  
  phone3dContainer.requestPointerLock = phone3dContainer.requestPointerLock ||
                                       phone3dContainer.mozRequestPointerLock ||
                                       phone3dContainer.webkitRequestPointerLock;
  
  if (phone3dContainer.requestPointerLock) {
    phone3dContainer.requestPointerLock();
  }
}

// Log initialization to help with debugging
console.log('Client script loaded and initialized');
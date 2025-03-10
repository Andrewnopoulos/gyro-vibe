const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Check if running on Railway
const isRailway = !!process.env.RAILWAY_ENVIRONMENT;

// Get local IP address (only used for local development)
function getLocalIpAddress() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const LOCAL_IP = getLocalIpAddress();

// The public URL of the application (for Railway)
const PUBLIC_URL = isRailway ? 'gyro-vibe-production.up.railway.app' : LOCAL_IP;

// Express app setup
const app = express();

// HTTP Server
const httpServer = http.createServer(app);

// HTTPS Server (for mobile sensor access)
let httpsServer;
let httpsAvailable = false;

try {
  // Load SSL certificates
  const privateKey = fs.readFileSync(path.join(__dirname, 'certificates/key.pem'), 'utf8');
  const certificate = fs.readFileSync(path.join(__dirname, 'certificates/cert.pem'), 'utf8');
  const credentials = { key: privateKey, cert: certificate };
  
  // Create HTTPS server
  httpsServer = https.createServer(credentials, app);
  httpsAvailable = true;
} catch (err) {
  console.error('Failed to load SSL certificates:', err);
  console.log('Running in HTTP mode only (sensors might not work on mobile devices)');
}

// Socket.IO setup - now used for signaling only
let io;

if (isRailway) {
  // On Railway, we need to create the io instance with cors options
  io = new Server({ 
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  // And attach it to the HTTP server
  io.attach(httpServer);
} else {
  // Local development setup
  if (httpsAvailable) {
    io = new Server({ 
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    io.attach(httpServer);
    io.attach(httpsServer);
  } else {
    io = new Server(httpServer);
  }
}

// Store active sessions for WebRTC signaling
const sessions = new Map();
const desktopClients = new Map();
const mobileClients = new Map();

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

// Route for PC client
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Route for mobile client with session ID
app.get('/mobile', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/mobile.html'));
});

// Socket.IO connection handling - Now serves as WebRTC signaling server
io.on('connection', (socket) => {
  console.log('A client connected for signaling:', socket.id);
  
  // Desktop client registers
  socket.on('register-desktop', () => {
    console.log('Desktop client registered:', socket.id);
    const sessionId = uuidv4();
    desktopClients.set(socket.id, { sessionId, mobileSocketId: null });
    
    // Send the desktop client its session ID
    socket.emit('session-created', { sessionId });
    console.log(`Created session ${sessionId} for desktop ${socket.id}`);
  });
  
  // Mobile client connects with a session ID
  socket.on('join-session', (data) => {
    const { sessionId } = data;
    console.log(`Mobile ${socket.id} attempting to join session ${sessionId}`);
    
    // Find the desktop client with this session ID
    let desktopSocketId = null;
    for (const [id, client] of desktopClients.entries()) {
      if (client.sessionId === sessionId) {
        desktopSocketId = id;
        // Update the desktop client with the mobile client's socket ID
        desktopClients.get(id).mobileSocketId = socket.id;
        break;
      }
    }
    
    if (desktopSocketId) {
      // Store the mobile client info
      mobileClients.set(socket.id, { sessionId, desktopSocketId });
      
      // Notify both clients that they can start WebRTC connection
      socket.emit('session-joined', { desktopSocketId });
      io.to(desktopSocketId).emit('mobile-joined', { mobileSocketId: socket.id });
      
      console.log(`Mobile ${socket.id} joined session ${sessionId} with desktop ${desktopSocketId}`);
    } else {
      socket.emit('session-error', { error: 'Session not found' });
      console.log(`Session ${sessionId} not found for mobile ${socket.id}`);
    }
  });
  
  // WebRTC Signaling - pass messages between peers
  
  // Handle WebRTC offer from either client
  socket.on('webrtc-offer', (data) => {
    const { targetId, offer } = data;
    console.log(`Relaying WebRTC offer from ${socket.id} to ${targetId}`);
    io.to(targetId).emit('webrtc-offer', { sourceId: socket.id, offer });
  });
  
  // Handle WebRTC answer
  socket.on('webrtc-answer', (data) => {
    const { targetId, answer } = data;
    console.log(`Relaying WebRTC answer from ${socket.id} to ${targetId}`);
    io.to(targetId).emit('webrtc-answer', { sourceId: socket.id, answer });
  });
  
  // Handle ICE candidates
  socket.on('webrtc-ice-candidate', (data) => {
    const { targetId, candidate } = data;
    console.log(`Relaying ICE candidate from ${socket.id} to ${targetId}`);
    io.to(targetId).emit('webrtc-ice-candidate', { sourceId: socket.id, candidate });
  });
  
  // Handle calibration request (still using signaling server for this control message)
  socket.on('request-calibration', (data) => {
    const { targetId } = data;
    console.log(`Calibration requested for ${targetId} by ${socket.id}`);
    io.to(targetId).emit('request-calibration');
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Check if it was a desktop client
    if (desktopClients.has(socket.id)) {
      const { sessionId, mobileSocketId } = desktopClients.get(socket.id);
      
      // Notify the connected mobile client if there is one
      if (mobileSocketId) {
        io.to(mobileSocketId).emit('desktop-disconnected');
      }
      
      desktopClients.delete(socket.id);
      console.log(`Removed desktop client ${socket.id} with session ${sessionId}`);
    }
    
    // Check if it was a mobile client
    if (mobileClients.has(socket.id)) {
      const { sessionId, desktopSocketId } = mobileClients.get(socket.id);
      
      // Notify the connected desktop client
      if (desktopSocketId) {
        io.to(desktopSocketId).emit('mobile-disconnected');
      }
      
      mobileClients.delete(socket.id);
      console.log(`Removed mobile client ${socket.id} from session ${sessionId}`);
    }
  });
});

// Start servers based on environment
if (isRailway) {
  // On Railway, we only need to start the HTTP server
  // Railway handles HTTPS for us
  const PORT = process.env.PORT || 3000;
  httpServer.listen(PORT, () => {
    console.log(`Signaling server running on Railway on port ${PORT}`);
    console.log(`Application available at https://${PUBLIC_URL}`);
    console.log(`Mobile client available at https://${PUBLIC_URL}/mobile`);
  });
} else {
  // Local development - start both HTTP and HTTPS servers if available
  const HTTP_PORT = process.env.PORT || 3000;
  httpServer.listen(HTTP_PORT, () => {
    console.log(`HTTP signaling server running on http://${LOCAL_IP}:${HTTP_PORT}`);
    console.log(`Mobile client available at http://${LOCAL_IP}:${HTTP_PORT}/mobile`);
  });
  
  // Start HTTPS server if available
  if (httpsAvailable) {
    const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
    httpsServer.listen(HTTPS_PORT, () => {
      console.log(`HTTPS signaling server running on https://${LOCAL_IP}:${HTTPS_PORT}`);
      console.log(`Mobile client available at https://${LOCAL_IP}:${HTTPS_PORT}/mobile (recommended for sensors)`);
    });
  }
}
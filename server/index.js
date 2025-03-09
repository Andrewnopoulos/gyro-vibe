const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

// Get local IP address
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

// Socket.IO setup
const io = new Server(httpsAvailable ? 
  { 
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  } : httpServer);

// If HTTPS is available, attach Socket.IO to both servers
if (httpsAvailable) {
  io.attach(httpServer);
  io.attach(httpsServer);
}

// Serve static files from the client directory
app.use(express.static(path.join(__dirname, '../client')));

// Route for PC client
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Route for mobile client
app.get('/mobile', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/mobile.html'));
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  
  // When a mobile device identifies itself
  socket.on('mobile-connect', () => {
    console.log('Mobile device connected:', socket.id);
    // Notify PC clients that a mobile device is connected
    io.emit('mobile-connected', socket.id);
  });
  
  // When sensor data is received from a mobile device
  socket.on('sensor-data', (data) => {
    // Broadcast the data to all PC clients
    socket.broadcast.emit('sensor-data', {
      socketId: socket.id,
      ...data
    });
  });
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    io.emit('device-disconnected', socket.id);
  });
});

// Start HTTP server
const HTTP_PORT = process.env.PORT || 3000;
httpServer.listen(HTTP_PORT, () => {
  console.log(`HTTP server running on http://${LOCAL_IP}:${HTTP_PORT}`);
  console.log(`Mobile client available at http://${LOCAL_IP}:${HTTP_PORT}/mobile`);
});

// Start HTTPS server if available
if (httpsAvailable) {
  const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`HTTPS server running on https://${LOCAL_IP}:${HTTPS_PORT}`);
    console.log(`Mobile client available at https://${LOCAL_IP}:${HTTPS_PORT}/mobile (recommended for sensors)`);
  });
}
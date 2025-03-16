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
// Create io instance with common configuration
const io = new Server({ 
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Attach to appropriate servers
io.attach(httpServer);
if (!isRailway && httpsAvailable) {
  io.attach(httpsServer);
}

// Store active clients for WebRTC signaling
const desktopClients = new Map();
const mobileClients = new Map();

// Multiplayer game state
const gameRooms = new Map();
const MAX_PLAYERS_PER_ROOM = 8;
const GAME_STATE_BROADCAST_INTERVAL = 50; // 20Hz update rate

// Middleware setup

/**
 * Check if the user agent is a mobile device
 * Enhanced with more comprehensive detection patterns
 * @param {string} userAgent - The user agent string
 * @returns {boolean} True if the device is mobile
 */
function isMobileDevice(userAgent) {
  if (!userAgent) return false;
  
  // First check common mobile keywords - expanded with more patterns
  const mobileKeywords = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet|Mobi|PlayBook|Silk|Kindle|Symbian|webmate|Nexus|Pixel|Nokia|SAMSUNG|SM-|GT-|LG-|HTC/i;
  
  // Also check for specific device patterns
  const mobilePatterns = [
    // iOS/macOS devices (includes iPadOS & modern iPad user agents that report as Mac)
    /iPhone|iPad|iPod|iOS|CFNetwork|Darwin/i,
    // Android devices (more comprehensive)
    /Android|Samsung|Galaxy|SM-|GT-|Pixel|Nexus|LG-|Motorola|HTC|Xiaomi|OnePlus|OPPO|vivo/i,
    // Windows Phone
    /Windows Phone|Windows Mobile|IEMobile|WPDesktop/i,
    // Mobile browsers
    /Mobile|CriOS|Coast|Instagram|FBIOS|FB_IAB|FBAN|FBAV|Pinterest|Snapchat|Twitter|WhatsApp|Line/i,
    // Generic patterns for mobile viewport
    /Mobile.*Safari|Android.*Chrome|Instagram|WhatsApp|Snapchat|TikTok/i,
    // Tablet patterns
    /Tablet|PlayBook|Silk|iPad|Nexus (7|9|10)/i,
    // Samsung browser and other vendor-specific browsers
    /SamsungBrowser|MiuiBrowser|SAMSUNG|SM-|UCBrowser|OPR\/[0-9]+/i,
    // Devices that don't self-identify as mobile but are
    /Macintosh.*Mobile/i, // New iPads with iPadOS may report as Mac
  ];
  
  // Touch detection phrases that appear in some mobile UAs
  const touchPatterns = /Touch|Multitouch|webTouch/i;
  
  // Check for common mobile screen resolution pattern (more comprehensive)
  const screenPattern = /[0-9]{3,4}x[0-9]{3,4}|WVGA|resolution\s*\(\s*\d+\s*x\s*\d+\s*\)/i;
  
  // WebView patterns seen on mobile devices
  const webViewPatterns = /; wv\)|FBAV\/|Instagram|Snapchat|TikTok|discord|Twitter|WhatsApp|WeChat|Line/i;
  
  if (mobileKeywords.test(userAgent)) {
    return true;
  }
  
  for (const pattern of mobilePatterns) {
    if (pattern.test(userAgent)) {
      return true;
    }
  }
  
  // Check for touch support in UA
  if (touchPatterns.test(userAgent)) {
    return true;
  }
  
  // Some mobile UAs contain screen resolution
  if (screenPattern.test(userAgent)) {
    return true;
  }
  
  // Check for webview patterns common on mobile
  if (webViewPatterns.test(userAgent)) {
    return true;
  }
  
  return false;
}

// Define all routes first - before static file middleware

// Route for the main entry point - detects device type and routes accordingly
app.get('/', (req, res) => {
  const userAgent = req.headers['user-agent'];
  
  // If accessing from a mobile device, redirect to the mobile play page
  if (isMobileDevice(userAgent)) {
    return res.redirect('/play');
  } else {
    // Desktop experience
    res.sendFile(path.join(__dirname, '../client/index.html'));
  }
});

// Route for direct mobile play experience
app.get('/play', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/play.html'));
});

// Route for mobile client with session ID (used for QR code scanning)
app.get('/mobile', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/mobile.html'));
});

// Serve static files from the client directory - AFTER routes
app.use(express.static(path.join(__dirname, '../client')));

/**
 * Generate a random room code
 * @returns {string} 4-character room code
 */
function generateRoomCode() {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Omitting characters that look similar: 0/O, 1/I
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Determine if a socket connection is from a mobile device 
 * Using multiple detection methods for reliability
 * @param {Socket} socket - The socket.io socket object
 * @returns {boolean} True if the socket is from a mobile device
 */
function isMobileSocket(socket) {
  const userAgent = socket.handshake.headers['user-agent'] || '';
  const referer = socket.handshake.headers.referer || '';
  const requestPath = socket.handshake.headers[':path'] || '';
  
  // Several ways to detect if this is a mobile client:
  // 1. Check if accessed through play.html or mobile.html (referer)
  const isPlayOrMobileHtml = referer.includes('/play') || referer.includes('/mobile');
  
  // 2. Check if direct request to /play or /mobile endpoint (path)
  const accessingMobileUrl = requestPath.includes('/play') || requestPath.includes('/mobile');
  
  // 3. Check user agent for mobile signatures
  const hasMobileUserAgent = isMobileDevice(userAgent);
  
  // 4. Check if the client explicitly identified itself as mobile 
  // (can be set through player-update messages)
  const clientData = socket.data || {};
  const hasExplicitMobileFlag = clientData.isMobileDevice === true;
  
  return isPlayOrMobileHtml || accessingMobileUrl || hasMobileUserAgent || hasExplicitMobileFlag;
}

/**
 * Create a new player object with default values
 * @param {string} socketId - Socket ID of the player
 * @param {string} username - Player's username
 * @param {Socket} socket - The socket.io socket object
 * @param {string} devicePairId - ID of paired device (if applicable)
 * @returns {Object} New player object
 */
function createPlayer(socketId, username, socket, devicePairId = null) {
  // Determine device type using our enhanced detection
  const isMobile = isMobileSocket(socket);
  
  // Create base player object
  const player = {
    id: socketId,
    username: username || `Player_${socketId.substring(0, 5)}`,
    role: isMobile ? 'mobile' : 'desktop',
    isMobileDevice: isMobile,
    deviceType: isMobile ? detectMobileDeviceType(socket.handshake.headers['user-agent'] || '') : 'desktop',
    isConnected: true,
    devicePairId: devicePairId,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 0 },
    phoneOrientation: { x: 0, y: 0, z: 0, w: 1 }, // Default identity quaternion
    lastUpdate: Date.now()
  };
  
  // Store the device type in the socket data for future reference
  socket.data = socket.data || {};
  socket.data.isMobileDevice = isMobile;
  socket.data.deviceType = player.deviceType;
  
  console.log(`Created player ${socketId} with device type: ${player.deviceType}, role: ${player.role}`);
  
  return player;
}

/**
 * Detect specific mobile device type for better handling
 * @param {string} userAgent - The user agent string
 * @returns {string} Device type category
 */
function detectMobileDeviceType(userAgent) {
  if (!userAgent) return 'unknown-mobile';
  
  // iOS detection
  if (/iPhone|iPad|iPod|iOS/i.test(userAgent)) {
    if (/iPad/i.test(userAgent) || (
      /Macintosh/i.test(userAgent) && 
      typeof navigator !== 'undefined' && 
      navigator.maxTouchPoints > 1
    )) {
      return 'ipad';
    }
    return 'iphone';
  }
  
  // Android detection
  if (/Android/i.test(userAgent)) {
    if (/tablet|sm-t|gt-p/i.test(userAgent)) {
      return 'android-tablet';
    }
    return 'android-phone';
  }
  
  // Windows mobile
  if (/Windows Phone|IEMobile/i.test(userAgent)) {
    return 'windows-mobile';
  }
  
  // Fallback for other mobile devices
  return 'other-mobile';
}

/**
 * Create a new game room
 * @param {string} hostId - Socket ID of the host
 * @param {string} roomName - Optional custom room name
 * @returns {Object} New game room object
 */
function createGameRoom(hostId, roomName = null) {
  // Generate a unique room code
  let roomCode = generateRoomCode();
  while (Array.from(gameRooms.values()).some(room => room.roomCode === roomCode)) {
    roomCode = generateRoomCode();
  }

  const roomId = uuidv4();
  const room = {
    roomId: roomId,
    roomCode: roomCode,
    roomName: roomName || `Game Room ${roomCode}`,
    hostId: hostId,
    players: new Map(),
    gameMode: 'freeplay',
    gameObjects: [],
    startTime: Date.now(),
    lastUpdate: Date.now()
  };

  gameRooms.set(roomId, room);
  return room;
}

/**
 * Get a sanitized version of room data safe for sending to clients
 * @param {Object} room - Room object
 * @returns {Object} Sanitized room data
 */
function getSanitizedRoomData(room) {
  return {
    roomId: room.roomId,
    roomCode: room.roomCode,
    roomName: room.roomName,
    hostId: room.hostId,
    playerCount: room.players.size,
    maxPlayers: MAX_PLAYERS_PER_ROOM,
    gameMode: room.gameMode
  };
}

/**
 * Get a sanitized version of player data safe for sending to clients
 * @param {Object} player - Player object
 * @returns {Object} Sanitized player data
 */
function getSanitizedPlayerData(player) {
  // Check if this is a mobile player
  const isMobilePlayer = player.role === 'mobile' || player.isMobileDevice === true;
  
  return {
    id: player.id,
    username: player.username,
    role: player.role,
    isConnected: player.isConnected,
    position: player.position,
    rotation: player.rotation,
    phoneOrientation: player.phoneOrientation,
    isMobilePlayer: isMobilePlayer, // Flag to indicate if this is a mobile player
    deviceType: player.deviceType || (isMobilePlayer ? 'mobile' : 'desktop'), // Device type for UI/UX adaptation
    lastUpdate: player.lastUpdate // Allow clients to implement their own timeout detection
  };
}

/**
 * Broadcast game state to all players in a room
 * @param {string} roomId - ID of the room
 */
function broadcastGameState(roomId) {
  const room = gameRooms.get(roomId);
  if (!room) return;
  
  const sanitizedPlayers = Array.from(room.players.values()).map(getSanitizedPlayerData);
  
  // Send state to all clients in room
  io.to(roomId).emit('game-state-update', {
    players: sanitizedPlayers,
    gameObjects: room.gameObjects,
    timestamp: Date.now()
  });
}

/**
 * Remove a player from a room
 * @param {string} socketId - Socket ID of the player to remove
 * @param {string} roomId - ID of the room
 */
function removePlayerFromRoom(socketId, roomId) {
  const room = gameRooms.get(roomId);
  if (!room) return;

  // Remove player from room
  room.players.delete(socketId);

  // Notify other players
  io.to(roomId).emit('player-left', { playerId: socketId });

  // If room is now empty, clean it up
  if (room.players.size === 0) {
    console.log(`Room ${roomId} is empty, cleaning up`);
    gameRooms.delete(roomId);
    return;
  }

  // If the host left, assign a new host
  if (room.hostId === socketId) {
    const newHostId = room.players.keys().next().value;
    room.hostId = newHostId;
    io.to(roomId).emit('host-changed', { newHostId });
  }
}

// Socket.IO connection handling
io.on('connection', (socket) => {
  // Use our enhanced mobile detection
  const isMobile = isMobileSocket(socket);
  const deviceType = isMobile ? detectMobileDeviceType(socket.handshake.headers['user-agent'] || '') : 'Desktop';
  
  // Store device information in socket data for future reference
  socket.data = socket.data || {};
  socket.data.isMobileDevice = isMobile;
  socket.data.deviceType = deviceType;
  
  console.log(`A ${deviceType} client connected:`, socket.id);
  let currentRoomId = null;
  
  // ==================== DESKTOP/MOBILE PAIRING ====================
  
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
    
    // Create a lookup index: Find desktop client by session ID
    const matchingDesktop = Array.from(desktopClients.entries())
      .find(([_, client]) => client.sessionId === sessionId);
    
    if (matchingDesktop) {
      const [desktopSocketId, client] = matchingDesktop;
      // Update the desktop client with the mobile client's socket ID
      client.mobileSocketId = socket.id;
      
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
  
  // ==================== MULTIPLAYER ROOM MANAGEMENT ====================
  
  // List available game rooms
  socket.on('list-rooms', () => {
    const roomsList = Array.from(gameRooms.values())
      .filter(room => room.players.size < MAX_PLAYERS_PER_ROOM) // Only include rooms with space
      .map(getSanitizedRoomData);
    
    socket.emit('rooms-list', { rooms: roomsList });
  });
  
  // Create a new game room
  socket.on('create-room', (data) => {
    const { username, roomName } = data;
    
    // Create new room with this socket as host
    const room = createGameRoom(socket.id, roomName);
    
    // Join the room's socket.io room
    socket.join(room.roomId);
    
    // Use our enhanced player creation with automatic device detection
    room.players.set(socket.id, createPlayer(socket.id, username, socket));
    
    // Track the current room for this socket
    currentRoomId = room.roomId;
    
    // Send room details back to client
    socket.emit('room-created', {
      room: getSanitizedRoomData(room),
      playerId: socket.id
    });
    
    console.log(`Room ${room.roomCode} created by ${socket.id}`);
  });
  
  // Join an existing room
  socket.on('join-room', (data) => {
    const { roomCode, username } = data;
    
    // Find room with matching code
    const room = Array.from(gameRooms.values()).find(r => r.roomCode === roomCode);
    
    if (!room) {
      socket.emit('room-error', { error: 'Room not found' });
      return;
    }
    
    if (room.players.size >= MAX_PLAYERS_PER_ROOM) {
      socket.emit('room-error', { error: 'Room is full' });
      return;
    }
    
    // Join the room's socket.io room
    socket.join(room.roomId);
    
    // Use our enhanced player creation with automatic device detection
    room.players.set(socket.id, createPlayer(socket.id, username, socket));
    
    // Track the current room for this socket
    currentRoomId = room.roomId;
    
    // Send room details and existing players back to client
    socket.emit('room-joined', {
      room: getSanitizedRoomData(room),
      players: Array.from(room.players.values()).map(getSanitizedPlayerData),
      playerId: socket.id
    });
    
    // Notify other players in the room
    socket.to(room.roomId).emit('player-joined', { 
      player: getSanitizedPlayerData(room.players.get(socket.id)) 
    });
    
    console.log(`Player ${socket.id} joined room ${room.roomCode}`);
  });
  
  // Leave current room
  socket.on('leave-room', () => {
    if (currentRoomId) {
      // Remove player from room
      removePlayerFromRoom(socket.id, currentRoomId);
      
      // Leave the socket.io room
      socket.leave(currentRoomId);
      
      console.log(`Player ${socket.id} left room ${currentRoomId}`);
      currentRoomId = null;
      
      socket.emit('room-left');
    }
  });
  
  // Update player state (position, rotation, etc.)
  socket.on('player-update', (data) => {
    if (!currentRoomId) return;
    
    const room = gameRooms.get(currentRoomId);
    if (!room) return;
    
    const player = room.players.get(socket.id);
    if (!player) return;
    
    // Update player data
    if (data.position) player.position = data.position;
    if (data.rotation) player.rotation = data.rotation;
    
    if (data.phoneOrientation) {
      player.phoneOrientation = data.phoneOrientation;
    }
    
    // Update mobile player flag if provided (ensures role persists across reconnects)
    if (data.isMobilePlayer !== undefined) {
      player.role = data.isMobilePlayer ? 'mobile' : 'desktop';
      player.isMobileDevice = data.isMobilePlayer;
      
      // Update socket data for future reference
      socket.data = socket.data || {};
      socket.data.isMobileDevice = data.isMobilePlayer;
    }
    
    // Update device type if provided
    if (data.deviceType) {
      player.deviceType = data.deviceType;
      
      // Update socket data
      socket.data = socket.data || {};
      socket.data.deviceType = data.deviceType;
    }
    
    player.lastUpdate = Date.now();
    
    // We don't need to broadcast here as we have a game loop that broadcasts state regularly
  });
  
  // ==================== DISCONNECT HANDLING ====================
  
  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    
    // Handle multiplayer room cleanup
    if (currentRoomId) {
      removePlayerFromRoom(socket.id, currentRoomId);
      socket.leave(currentRoomId);
    }
    
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
  
  // Handle ping for connection quality measurement
  socket.on('ping', (data) => {
    // Echo back the timestamp for ping calculation
    socket.emit('pong', { timestamp: data.timestamp });
  });
});

// Start servers based on environment
const HTTP_PORT = process.env.PORT || 3000;

// Set up game state broadcast interval
setInterval(() => {
  gameRooms.forEach((room, roomId) => {
    broadcastGameState(roomId);
  });
}, GAME_STATE_BROADCAST_INTERVAL);

// Start HTTP server (required for both Railway and local)
httpServer.listen(HTTP_PORT, () => {
  if (isRailway) {
    console.log(`Signaling server running on Railway on port ${HTTP_PORT}`);
    console.log(`Application available at https://${PUBLIC_URL}`);
    console.log(`Mobile direct play available at https://${PUBLIC_URL}/play`);
    console.log(`Mobile controller client available at https://${PUBLIC_URL}/mobile`);
  } else {
    console.log(`HTTP signaling server running on http://${LOCAL_IP}:${HTTP_PORT}`);
    console.log(`Mobile direct play available at http://${LOCAL_IP}:${HTTP_PORT}/play`);
    console.log(`Mobile controller client available at http://${LOCAL_IP}:${HTTP_PORT}/mobile`);
  }
});

// Start HTTPS server for local development (if available)
if (!isRailway && httpsAvailable) {
  const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`HTTPS signaling server running on https://${LOCAL_IP}:${HTTPS_PORT}`);
    console.log(`Mobile direct play available at https://${LOCAL_IP}:${HTTPS_PORT}/play (recommended for sensors)`);
    console.log(`Mobile controller client available at https://${LOCAL_IP}:${HTTPS_PORT}/mobile (recommended for sensors)`);
  });
}
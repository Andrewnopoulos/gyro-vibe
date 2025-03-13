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
 * Create a new player object with default values
 * @param {string} socketId - Socket ID of the player
 * @param {string} username - Player's username
 * @param {string} role - Player's role (desktop or mobile)
 * @param {string} devicePairId - ID of paired device (if applicable)
 * @returns {Object} New player object
 */
function createPlayer(socketId, username, role, devicePairId = null) {
  return {
    id: socketId,
    username: username || `Player_${socketId.substring(0, 5)}`,
    role: role,
    isConnected: true,
    devicePairId: devicePairId,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0, w: 0 },
    phoneOrientation: { x: 0, y: 0, z: 0, w: 1 }, // Default identity quaternion
    lastUpdate: Date.now()
  };
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
  return {
    id: player.id,
    username: player.username,
    role: player.role,
    isConnected: player.isConnected,
    position: player.position,
    rotation: player.rotation,
    phoneOrientation: player.phoneOrientation
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
  console.log('A client connected:', socket.id);
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
    
    // Add player to the room
    room.players.set(socket.id, createPlayer(socket.id, username, 'desktop'));
    
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
    
    // Add player to the room
    room.players.set(socket.id, createPlayer(socket.id, username, 'desktop'));
    
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
    console.log(`Mobile client available at https://${PUBLIC_URL}/mobile`);
  } else {
    console.log(`HTTP signaling server running on http://${LOCAL_IP}:${HTTP_PORT}`);
    console.log(`Mobile client available at http://${LOCAL_IP}:${HTTP_PORT}/mobile`);
  }
});

// Start HTTPS server for local development (if available)
if (!isRailway && httpsAvailable) {
  const HTTPS_PORT = process.env.HTTPS_PORT || 3443;
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`HTTPS signaling server running on https://${LOCAL_IP}:${HTTPS_PORT}`);
    console.log(`Mobile client available at https://${LOCAL_IP}:${HTTPS_PORT}/mobile (recommended for sensors)`);
  });
}
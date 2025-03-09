const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Mobile client available at http://localhost:${PORT}/mobile`);
});
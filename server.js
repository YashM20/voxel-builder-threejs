// server/server.js
const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const http = require('http');

// Express server for static files
const app = express();
const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 8080;

// Serve static files
app.use(express.static(__dirname));

// Create HTTP server
const server = http.createServer(app);

// WebSocket server
const wss = new WebSocket.Server({ 
  server: server, // Attach to same server
  // If you want a separate WebSocket server, use:
  // port: WS_PORT
});

const connectedClients = new Set();

// --- World State ---
const WORLD_WIDTH = 16;
const WORLD_HEIGHT = 16; // Increased height for better building
const WORLD_DEPTH = 16;
// Simple 3D array: world[x][y][z] = blockType (0 for empty, 1+ for different block types)
let world = initializeWorld();

function initializeWorld() {
  console.log("Initializing world...");
  const newWorld = new Array(WORLD_WIDTH).fill(0).map(() =>
    new Array(WORLD_HEIGHT).fill(0).map(() =>
      new Array(WORLD_DEPTH).fill(0)
    )
  );
  // Add a base layer for easier starting
  for (let x = 0; x < WORLD_WIDTH; x++) {
    for (let z = 0; z < WORLD_DEPTH; z++) {
      newWorld[x][0][z] = 1; // Add block at y=0 (ground)
    }
  }
  // Add some random blocks for visual interest
  for (let i = 0; i < 20; i++) {
    const x = Math.floor(Math.random() * WORLD_WIDTH);
    const y = 1 + Math.floor(Math.random() * 3); // 1-3 blocks high
    const z = Math.floor(Math.random() * WORLD_DEPTH);
    newWorld[x][y][z] = 2; // Different block type
  }
  console.log("World initialized.");
  return newWorld;
}

function isValidPosition(x, y, z) {
  return x >= 0 && x < WORLD_WIDTH &&
    y >= 0 && y < WORLD_HEIGHT &&
    z >= 0 && z < WORLD_DEPTH;
}

function broadcast(messageData, sender) {
  const messageString = JSON.stringify(messageData);
  connectedClients.forEach(client => {
    // Broadcast to everyone including sender
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageString);
    }
  });
}

// Client tracking with user info
const clients = new Map(); // Stores client info with WebSocket as key
let nextClientId = 1;

wss.on('connection', (ws, req) => {
  const clientId = nextClientId++;
  const clientIp = req.socket.remoteAddress;
  console.log(`Client #${clientId} connected from ${clientIp}`);
  
  // Store client info
  clients.set(ws, {
    id: clientId,
    ip: clientIp,
    color: getRandomColor()
  });
  
  connectedClients.add(ws);

  // 1. Send the current world state to the newly connected client
  ws.send(JSON.stringify({
    type: 'init_world',
    payload: { 
      world: world,
      clientId: clientId,
      clientColor: clients.get(ws).color
    }
  }));

  // 2. Notify everyone about the new user
  broadcast({
    type: 'user_joined',
    payload: {
      clientId: clientId,
      clients: Array.from(clients.values())
    }
  }, null);

  // 3. Handle messages from this client
  ws.on('message', (message) => {
    try {
      const parsedMessage = JSON.parse(message);
      console.log('Received:', parsedMessage.type);

      if (parsedMessage.type === 'update_voxel') {
        const { pos, blockType } = parsedMessage.payload;
        const [x, y, z] = pos;

        if (isValidPosition(x, y, z)) {
          // Update server's world state
          world[x][y][z] = blockType;

          // Add client info to the broadcast
          parsedMessage.payload.clientId = clients.get(ws).id;
          parsedMessage.payload.clientColor = clients.get(ws).color;

          // Broadcast the change to all clients
          broadcast(parsedMessage, null);
        } else {
          console.warn(`Invalid position received: ${pos}`);
        }
      }
      // Add more message types here if needed

    } catch (error) {
      console.error('Failed to parse message or invalid message format:', error);
    }
  });

  // 4. Handle client disconnection
  ws.on('close', () => {
    console.log(`Client #${clients.get(ws)?.id} disconnected`);
    
    // Broadcast disconnect event
    if (clients.has(ws)) {
      broadcast({
        type: 'user_left',
        payload: {
          clientId: clients.get(ws).id
        }
      }, null);
      
      // Clean up client tracking
      clients.delete(ws);
    }
    
    connectedClients.delete(ws);
  });

  // 5. Handle errors
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    connectedClients.delete(ws);
    clients.delete(ws);
  });
});

// Helper for random user colors
function getRandomColor() {
  const colors = [
    '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2',
    '#EF476F', '#FFC43D', '#1B9AAA', '#6A4C93', '#F72585'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Start the server
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`WebSocket server available at ws://localhost:${PORT}`);
});
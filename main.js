// client/main.js
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// --- Constants ---
const SERVER_URL = `ws://${window.location.hostname}:${window.location.port}`; // Adjust this based on your server setup
const BLOCK_SIZE = 1; // Size of one voxel cube

// --- DOM Elements ---
const statusMessage = document.getElementById('status-message');
const usersList = document.getElementById('users-list');
const blockButtons = document.querySelectorAll('.block-btn');

// --- Application State ---
let selectedBlockType = 1; // Default block type
let myClientId = null;
let myClientColor = '#FF6B6B';
const connectedUsers = new Map(); // Track connected users

// --- Three.js Setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1e293b); // Dark blue background

// Camera with wider field of view for better overview
const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(16, 16, 24); // Position for a nice overview of the default world size

// Renderer with antialiasing for smoother edges
const renderer = new THREE.WebGLRenderer({
  canvas: document.querySelector('#bg'),
  antialias: true,
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;

// Add a crosshair to the center of the screen
const crosshair = document.createElement('div');
crosshair.className = 'crosshair';
document.body.appendChild(crosshair);

// --- Lighting ---
// Ambient light for global illumination
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// Main directional light (sun) with shadows
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 15);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
scene.add(directionalLight);

// Additional point light for more dynamic lighting
const pointLight = new THREE.PointLight(0xfcba03, 0.5, 30);
pointLight.position.set(8, 10, 8);
scene.add(pointLight);

// --- Controls ---
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.1;
controls.screenSpacePanning = false;
controls.minDistance = 5;
controls.maxDistance = 100;
controls.maxPolarAngle = Math.PI / 2; // Prevent going below the horizon

// --- Voxel Management ---
const voxelMeshes = {}; // Store meshes keyed by "x,y,z"

// Block type materials
const blockMaterials = {
  1: new THREE.MeshStandardMaterial({ color: 0x8bc34a }), // Green
  2: new THREE.MeshStandardMaterial({ color: 0x2196f3 }), // Blue
  3: new THREE.MeshStandardMaterial({ color: 0xf44336 }), // Red
  4: new THREE.MeshStandardMaterial({ color: 0xffeb3b }), // Yellow
  5: new THREE.MeshStandardMaterial({ color: 0x9c27b0 }), // Purple
  6: new THREE.MeshStandardMaterial({ color: 0xe91e63 })  // Pink
};

// Create reusable geometry
const voxelGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

// Grid Helper
const gridSize = 16;
const gridHelper = new THREE.GridHelper(gridSize, gridSize, 0x888888, 0x444444);
gridHelper.position.y = 0.01; // Slightly above ground to prevent z-fighting
scene.add(gridHelper);

// Axes Helper
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

// World border for better visual reference
function createWorldBorders(width, height, depth) {
  const borderMaterial = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.3 });
  const borderGeometry = new THREE.BoxGeometry(width, height, depth);
  const borderEdges = new THREE.EdgesGeometry(borderGeometry);
  const borderLines = new THREE.LineSegments(borderEdges, borderMaterial);
  borderLines.position.set(width/2 - 0.5, height/2 - 0.5, depth/2 - 0.5);
  scene.add(borderLines);
}
createWorldBorders(16, 16, 16); // Match world dimensions

// Simple animation helper
class Tween {
  constructor(object, duration = 300) {
    this.object = object;
    this.duration = duration;
    this.startTime = null;
    this.startValues = {};
    this.endValues = {};
    this.onCompleteCallback = null;
  }

  to(properties) {
    this.endValues = properties;
    return this;
  }

  start() {
    this.startTime = Date.now();
    // Save initial values
    Object.keys(this.endValues).forEach(key => {
      this.startValues[key] = this.object[key];
    });
    
    // Add to animation queue
    if (!Tween.tweens.includes(this)) {
      Tween.tweens.push(this);
    }
    return this;
  }
  
  onComplete(callback) {
    this.onCompleteCallback = callback;
    return this;
  }
  
  update() {
    if (!this.startTime) return true;
    
    const elapsed = Date.now() - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);
    
    // Easing function (ease-out)
    const eased = 1 - Math.pow(1 - progress, 2);
    
    // Update values
    Object.keys(this.endValues).forEach(key => {
      if (this.object[key] !== undefined) {
        const start = this.startValues[key];
        const end = this.endValues[key];
        this.object[key] = start + (end - start) * eased;
      }
    });
    
    // Check if complete
    if (progress >= 1) {
      if (this.onCompleteCallback) this.onCompleteCallback();
      return false; // Remove from queue
    }
    
    return true; // Keep updating
  }
  
  // Static method to update all tweens
  static updateTweens() {
    if (Tween.tweens.length === 0) return;
    
    let i = Tween.tweens.length;
    while (i--) {
      if (!Tween.tweens[i].update()) {
        Tween.tweens.splice(i, 1);
      }
    }
  }
}

// Static array to store all active tweens
Tween.tweens = [];

// Function to add a visual voxel cube to the scene
function addVoxelMesh(x, y, z, blockType, clientColor = null) {
  if (blockType === 0) return removeVoxelMesh(x, y, z); // Remove if empty

  const key = `${x},${y},${z}`;
  
  // Remove existing voxel if present
  removeVoxelMesh(x, y, z);
  
  // Select material based on block type
  const material = blockMaterials[blockType] || blockMaterials[1];
  
  // If clientColor is provided, this lets us customize the appearance
  // (useful for showing who placed what)
  if (clientColor) {
    // Clone material to avoid affecting other blocks
    const customMaterial = material.clone();
    customMaterial.emissive = new THREE.Color(clientColor);
    customMaterial.emissiveIntensity = 0.15; // Subtle glow effect
    
    const mesh = new THREE.Mesh(voxelGeometry, customMaterial);
    mesh.position.set(
      x * BLOCK_SIZE + BLOCK_SIZE / 2,
      y * BLOCK_SIZE + BLOCK_SIZE / 2,
      z * BLOCK_SIZE + BLOCK_SIZE / 2
    );
    mesh.userData = { x, y, z, blockType, isVoxel: true };
    
    // Add subtle animation for new blocks
    mesh.scale.set(0, 0, 0);
    scene.add(mesh);
    
    new Tween(mesh.scale, 200)
      .to({ x: 1, y: 1, z: 1 })
      .start();
    
    voxelMeshes[key] = mesh;
    return mesh;
  } else {
    // Regular block without animation
    const mesh = new THREE.Mesh(voxelGeometry, material);
    mesh.position.set(
      x * BLOCK_SIZE + BLOCK_SIZE / 2,
      y * BLOCK_SIZE + BLOCK_SIZE / 2,
      z * BLOCK_SIZE + BLOCK_SIZE / 2
    );
    mesh.userData = { x, y, z, blockType, isVoxel: true };
    
    scene.add(mesh);
    voxelMeshes[key] = mesh;
    return mesh;
  }
}

// Function to remove a visual voxel cube from the scene
function removeVoxelMesh(x, y, z) {
  const key = `${x},${y},${z}`;
  const mesh = voxelMeshes[key];
  if (mesh) {
    // Optional: Add removal animation
    new Tween(mesh.scale, 150)
      .to({ x: 0, y: 0, z: 0 })
      .onComplete(() => {
        scene.remove(mesh);
        delete voxelMeshes[key];
      })
      .start();
    return true;
  }
  return false;
}

// --- WebSocket Connection ---
let socket;
function connectToServer() {
  showStatus("Connecting to server...");
  
  socket = new WebSocket(SERVER_URL);

  socket.addEventListener('open', (event) => {
    console.log('WebSocket Connected to server');
    showStatus("Connected!", 2000);
  });

  socket.addEventListener('close', (event) => {
    console.log('WebSocket Disconnected from server');
    showStatus("Connection lost. Reconnecting...");
    // Try to reconnect after a short delay
    setTimeout(connectToServer, 3000);
  });

  socket.addEventListener('error', (event) => {
    console.error('WebSocket Error:', event);
    showStatus("Connection error!", 3000);
  });

  // Handle messages received from the server
  socket.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data);
      handleServerMessage(message);
    } catch (error) {
      console.error('Failed to parse server message:', error);
    }
  });
}

// Handle different message types from server
function handleServerMessage(message) {
  switch (message.type) {
    case 'init_world':
      handleInitWorld(message.payload);
      break;
    case 'update_voxel':
      handleVoxelUpdate(message.payload);
      break;
    case 'user_joined':
      handleUserJoined(message.payload);
      break;
    case 'user_left':
      handleUserLeft(message.payload);
      break;
    default:
      console.log('Unknown message type:', message.type);
  }
}

// Initialize world from server data
function handleInitWorld(payload) {
  // Clear existing scene
  Object.keys(voxelMeshes).forEach(key => {
    scene.remove(voxelMeshes[key]);
  });
  Object.keys(voxelMeshes).length = 0;

  // Store my client info
  myClientId = payload.clientId;
  myClientColor = payload.clientColor;
  showStatus(`You are player #${myClientId}`, 3000);

  // Populate scene based on server state
  const world = payload.world;
  for (let x = 0; x < world.length; x++) {
    for (let y = 0; y < world[x].length; y++) {
      for (let z = 0; z < world[x][y].length; z++) {
        if (world[x][y][z] !== 0) {
          addVoxelMesh(x, y, z, world[x][y][z]);
        }
      }
    }
  }
  console.log("World initialized from server state.");
}

// Handle voxel updates from server
function handleVoxelUpdate(payload) {
  const { pos, blockType, clientId, clientColor } = payload;
  const [x, y, z] = pos;

  // Always remove existing mesh first
  removeVoxelMesh(x, y, z);

  // Add new block if not empty
  if (blockType !== 0) {
    addVoxelMesh(x, y, z, blockType, clientColor);
    
    // Show notification if someone else placed a block
    if (clientId && clientId !== myClientId) {
      const userName = `Player #${clientId}`;
      showStatus(`${userName} placed a block`, 1500);
    }
  }
}

// Handle a user joining
function handleUserJoined(payload) {
  const { clientId, clients } = payload;
  
  // Update connected users list
  if (Array.isArray(clients)) {
    connectedUsers.clear();
    clients.forEach(client => {
      if (client.id !== myClientId) {
        connectedUsers.set(client.id, client);
      }
    });
  }
  
  // Show notification
  if (clientId !== myClientId) {
    showStatus(`Player #${clientId} joined`, 2000);
  }
  
  // Update UI
  updateUsersList();
}

// Handle a user leaving
function handleUserLeft(payload) {
  const { clientId } = payload;
  
  if (connectedUsers.has(clientId)) {
    showStatus(`Player #${clientId} left`, 2000);
    connectedUsers.delete(clientId);
    updateUsersList();
  }
}

// Update the users list in the UI
function updateUsersList() {
  usersList.innerHTML = '';
  
  // Add myself first
  const myItem = document.createElement('li');
  myItem.className = 'py-1 font-bold';
  myItem.innerHTML = `<span class="user-dot" style="background-color: ${myClientColor}"></span>You (Player #${myClientId})`;
  usersList.appendChild(myItem);
  
  // Add other users
  connectedUsers.forEach(user => {
    const userItem = document.createElement('li');
    userItem.className = 'py-1';
    userItem.innerHTML = `<span class="user-dot" style="background-color: ${user.color}"></span>Player #${user.id}`;
    usersList.appendChild(userItem);
  });
}

// Show a status message briefly
function showStatus(message, duration = 0) {
  statusMessage.textContent = message;
  statusMessage.classList.remove('hidden', 'fade-out');
  
  if (duration > 0) {
    setTimeout(() => {
      statusMessage.classList.add('fade-out');
      setTimeout(() => {
        statusMessage.classList.add('hidden');
      }, 1500);
    }, duration);
  }
}

// Send a voxel update to the server
function sendVoxelUpdate(x, y, z, blockType) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    const message = {
      type: 'update_voxel',
      payload: {
        pos: [x, y, z],
        blockType: blockType
      }
    };
    socket.send(JSON.stringify(message));
  } else {
    console.warn("WebSocket is not open. Cannot send update.");
    showStatus("Not connected to server", 2000);
  }
}

// --- UI Interaction ---
// Block selection
blockButtons.forEach(button => {
  button.addEventListener('click', () => {
    // Update active state
    blockButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    // Update selected block type
    selectedBlockType = parseInt(button.dataset.type);
    showStatus(`Selected block type: ${selectedBlockType}`, 1000);
  });
});

// --- User Interaction (Mouse Clicks) ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseClick(event) {
  // Calculate mouse position in normalized device coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

  // Update the picking ray
  raycaster.setFromCamera(mouse, camera);

  // Calculate objects intersecting the ray
  const intersects = raycaster.intersectObjects(scene.children);

  // Find the closest voxel or grid intersected
  for (const intersect of intersects) {
    const object = intersect.object;
    
    if (object.userData.isVoxel) {
      // Clicked on a voxel
      if (event.button === 0) { // Left click: Place block
        // Calculate position adjacent to the clicked face
        const normal = intersect.face.normal;
        const placePos = {
          x: object.userData.x + normal.x,
          y: object.userData.y + normal.y,
          z: object.userData.z + normal.z,
        };
        
        // Check if position is within world bounds
        if (placePos.x >= 0 && placePos.x < 16 && 
            placePos.y >= 0 && placePos.y < 16 && 
            placePos.z >= 0 && placePos.z < 16) {
          sendVoxelUpdate(placePos.x, placePos.y, placePos.z, selectedBlockType);
        } else {
          showStatus("Can't place block outside world boundaries", 1500);
        }
        
      } else if (event.button === 2) { // Right click: Remove block
        sendVoxelUpdate(object.userData.x, object.userData.y, object.userData.z, 0);
      }
      return; // Stop after handling first voxel
    } else if (object === gridHelper) {
      // Clicked on the grid - place block on top
      if (event.button === 0) { // Left click only
        // Convert intersection point to grid position
        const point = intersect.point.add(new THREE.Vector3(0, 0.5, 0)); // Move slightly up from grid
        const x = Math.floor(point.x + 0.5);
        const y = Math.floor(point.y + 0.5); // Should be 0 or 1
        const z = Math.floor(point.z + 0.5);
        
        // Check if position is within world bounds
        if (x >= 0 && x < 16 && y >= 0 && y < 16 && z >= 0 && z < 16) {
          sendVoxelUpdate(x, y, z, selectedBlockType);
        }
      }
      return;
    }
  }
}

// Add mouse event listeners
window.addEventListener('contextmenu', (event) => event.preventDefault());
window.addEventListener('mousedown', onMouseClick);

// --- Window Resize Handling ---
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', onWindowResize);

// --- Animation Loop ---
function animate() {
  requestAnimationFrame(animate);
  
  // Update tweens
  Tween.updateTweens();
  
  controls.update();
  renderer.render(scene, camera);
}

// Start the application
connectToServer();
animate();
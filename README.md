# Collaborative Real-time Voxel Builder

A browser-based collaborative 3D voxel building application that allows multiple users to create and modify a shared 3D space in real-time.

![Voxel Builder Screenshot](https://i.imgur.com/sample-image.jpg)

## Features

- Real-time collaborative building with multiple users
- Different colored blocks to choose from
- User presence indicators and notifications
- Responsive 3D environment with intuitive controls
- Cross-browser compatibility
- Automatic reconnection if server connection is lost

## Technology Stack

- **Frontend**: Three.js, HTML5 Canvas, Tailwind CSS
- **Backend**: Node.js, Express, WebSockets (ws)
- **Communication**: Real-time WebSocket protocol for instant updates

## Getting Started

### Prerequisites

- Node.js (v12.0.0 or higher)
- NPM (v6.0.0 or higher)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/voxel-builder.git
   cd voxel-builder
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## How to Use

1. **Building Blocks**: Left-click to place a block on an existing surface
2. **Removing Blocks**: Right-click to remove a block
3. **Selecting Block Types**: Click on a block type in the palette on the right
4. **Navigation**:
   - Mouse wheel: Zoom in/out
   - Middle mouse button + drag: Rotate the camera
   - Left/right arrow keys: Rotate left/right
   - WASD keys: Move the camera

## Project Structure

```
vox/
├── server.js         # Node.js server with WebSocket implementation
├── index.html        # Main HTML file with UI structure
├── main.js           # Three.js client-side logic
├── style.css         # CSS styling (with Tailwind)
├── package.json      # Project dependencies
└── README.md         # This file
```

## Extending the Project

### Adding New Block Types

1. Add a new button in the `index.html` file with a unique `data-type` attribute
2. Add a corresponding material in the `blockMaterials` object in `main.js`
3. Style the new button in `style.css` or with Tailwind classes

### Increasing World Size

Modify the constants in `server.js`:
```javascript
const WORLD_WIDTH = 32;  // Default is 16
const WORLD_HEIGHT = 32; // Default is 16
const WORLD_DEPTH = 32;  // Default is 16
```

Don't forget to update the corresponding references in `main.js` and adjust the grid and world borders.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Inspired by Minecraft and other voxel-based building games
- Three.js for the amazing 3D rendering capabilities
- The WebSocket protocol for enabling real-time collaboration

---

Made with ❤️ for creative builders everywhere 
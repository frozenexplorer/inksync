# InkSync - Real-Time Collaborative Whiteboard

A real-time collaborative whiteboard where multiple users can draw, erase, and add text on a shared canvas with instant synchronization.

## Features

- **Real-time Collaboration**: Multiple users can draw simultaneously with instant sync
- **Drawing Tools**: Pen, Eraser, and Text tools
- **Customization**: Multiple colors and brush sizes
- **Room-based**: Create or join rooms via unique Room IDs
- **Easy Sharing**: Share via invite link or room code
- **User Roles**: Host (first user) can clear the board; participants can draw
- **Presence Indicators**: See who's in the room with color-coded avatars
- **Late Joiner Support**: New users receive the full board state on join

## Tech Stack

### Frontend
- **Next.js 14+** (App Router)
- **React** with HTML5 Canvas API
- **Tailwind CSS** for styling
- **Zustand** for state management
- **Framer Motion** for animations
- **Socket.io Client** for real-time communication

### Backend
- **Node.js** with **Express.js**
- **Socket.io** for WebSocket connections
- **In-memory state** (no database required)

## Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### Installation

1. **Clone the repository**

2. **Install Backend Dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   ```

### Running the Application

1. **Start the Backend Server**
   ```bash
   cd backend
   npm run dev
   ```
   The server will start on http://localhost:3001

2. **Start the Frontend**
   ```bash
   cd frontend
   npm run dev
   ```
   The app will be available at http://localhost:3000

## Usage

1. Open http://localhost:3000 in your browser
2. Click "Create Room" and enter your name to create a new whiteboard
3. **Share with others** using one of these methods:
   - Click the **Share** button in the header to get the invite link
   - Copy the room code and share it (others can join from the home page)
   - Share the direct invite link: `http://localhost:3000/join/ROOM_ID`
4. Use the toolbar on the left to:
   - **Pen**: Draw on the canvas
   - **Eraser**: Remove strokes
   - **Text**: Add text to the canvas
5. The host (first user) can clear the entire board

## Architecture

```
Client (Next.js + Canvas)
        ↓
Local optimistic rendering
        ↓
Real-time sync via Socket.io
        ↓
Broadcast to all connected clients
```

### Sync Philosophy
- Draw locally for instant feedback
- On stroke completion (pointerup), push to shared state
- Canvas re-renders based on shared state changes
- Late joiners receive full state snapshot

## Project Structure

```
├── frontend/
│   ├── src/
│   │   ├── app/              # Next.js pages
│   │   ├── components/       # React components
│   │   ├── lib/              # Utilities & socket
│   │   └── store/            # Zustand store
│   └── package.json
│
└── backend/
    ├── src/
    │   ├── index.ts          # Server entry
    │   ├── socket/           # Socket handlers
    │   └── rooms/            # Room management
    └── package.json
```

## One-Minute Pitch

> "We use Next.js for UI and HTML5 Canvas for drawing. WebSockets via Socket.io keep a single shared whiteboard state in sync across users. Drawing is rendered optimistically on the client, while finalized actions are synchronized in real time."

## License

MIT

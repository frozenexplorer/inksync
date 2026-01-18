import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocketHandlers } from './socket/handlers';
import { nanoid } from 'nanoid';
import { getRoom } from './rooms/manager';

const app = express();
const httpServer = createServer(app);

// Configure CORS
const allowedOrigins: string[] = [
  'http://localhost:3000',
  'http://localhost:3001',
  process.env.FRONTEND_URL
].filter((origin): origin is string => Boolean(origin));

app.use(cors({
  origin: allowedOrigins,
  credentials: true
}));

app.use(express.json());

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Setup socket handlers
setupSocketHandlers(io);

// REST API endpoints
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Create a new room
app.post('/api/rooms', (req, res) => {
  const roomId = nanoid(8);
  res.json({ roomId });
});

// Check if room exists
app.get('/api/rooms/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = getRoom(roomId);
  res.json({ roomId, exists: !!room });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready`);
});

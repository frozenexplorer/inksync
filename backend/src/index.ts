import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocketHandlers } from './socket/handlers';
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

type NanoidModule = { nanoid: (size?: number) => string };

let nanoidPromise: Promise<NanoidModule> | null = null;

function loadNanoid(): Promise<NanoidModule> {
  if (!nanoidPromise) {
    // Dynamic import keeps nanoid (ESM) working with our CJS build output.
    const importer = new Function("return import('nanoid')") as () => Promise<NanoidModule>;
    nanoidPromise = importer();
  }
  return nanoidPromise;
}

async function createRoomId(): Promise<string> {
  const { nanoid } = await loadNanoid();
  return nanoid(8);
}

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
app.post('/api/rooms', async (req, res) => {
  try {
    const roomId = await createRoomId();
    res.json({ roomId });
  } catch (error) {
    console.error('Failed to create room ID', error);
    res.status(500).json({ error: 'ROOM_ID_FAILED' });
  }
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

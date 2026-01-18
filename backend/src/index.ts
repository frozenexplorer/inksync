import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { setupSocketHandlers } from './socket/handlers';
import { getRoom } from './rooms/manager';

const app = express();
const httpServer = createServer(app);

// Configure CORS
const isAllowedOrigin = (origin: string | undefined): boolean => {
  if (!origin) return false;
  
  // Allow localhost for development
  if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
    return true;
  }
  
  // Allow Vercel preview and production URLs
  if (origin.includes('.vercel.app') || origin.includes('vercel.app')) {
    return true;
  }
  
  // Allow explicitly configured frontend URL
  if (process.env.FRONTEND_URL && origin === process.env.FRONTEND_URL) {
    return true;
  }
  
  return false;
};

app.use(cors({
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
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
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
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
  console.log(`🌐 CORS configured for:`);
  console.log(`   - Localhost (development)`);
  console.log(`   - All Vercel preview URLs (*.vercel.app)`);
  if (process.env.FRONTEND_URL) {
    console.log(`   - Frontend URL: ${process.env.FRONTEND_URL}`);
  }
});

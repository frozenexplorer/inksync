import { io, Socket } from 'socket.io-client';

const normalizeUrl = (value?: string): string | null => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('localhost') || value.startsWith('127.0.0.1')) {
    return `http://${value}`;
  }
  return `https://${value}`;
};

const SOCKET_URL =
  normalizeUrl(process.env.NEXT_PUBLIC_SOCKET_URL) ||
  normalizeUrl(process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:3001';

if (typeof window !== 'undefined' && SOCKET_URL.includes('localhost') && window.location.hostname !== 'localhost') {
  console.warn('Socket URL points to localhost in a non-local environment. Set NEXT_PUBLIC_SOCKET_URL or NEXT_PUBLIC_API_URL.');
}

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket(): void {
  if (socket?.connected) {
    socket.disconnect();
  }
}

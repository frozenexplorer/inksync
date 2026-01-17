import { Room, WhiteboardState, Stroke, TextItem, User } from '../types';

// In-memory room storage
const rooms = new Map<string, Room>();

// Generate random color for users
const USER_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
  '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
];

function getRandomColor(): string {
  return USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
}

function createEmptyState(): WhiteboardState {
  return {
    strokes: {},
    texts: {},
    users: {}
  };
}

export function createRoom(roomId: string): Room {
  const room: Room = {
    id: roomId,
    state: createEmptyState(),
    hostId: null
  };
  rooms.set(roomId, room);
  return room;
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

export function getOrCreateRoom(roomId: string): Room {
  let room = rooms.get(roomId);
  if (!room) {
    room = createRoom(roomId);
  }
  return room;
}

export function addUserToRoom(
  roomId: string, 
  userId: string, 
  userName: string
): { user: User; isHost: boolean } {
  const room = getOrCreateRoom(roomId);
  const isHost = room.hostId === null;
  
  if (isHost) {
    room.hostId = userId;
  }

  const user: User = {
    userId,
    role: isHost ? 'host' : 'participant',
    color: getRandomColor(),
    name: userName
  };

  room.state.users[userId] = user;
  return { user, isHost };
}

export function removeUserFromRoom(roomId: string, userId: string): User | null {
  const room = rooms.get(roomId);
  if (!room) return null;

  const user = room.state.users[userId];
  if (!user) return null;

  delete room.state.users[userId];

  // Transfer host to next user if host left
  if (room.hostId === userId) {
    const remainingUsers = Object.keys(room.state.users);
    if (remainingUsers.length > 0) {
      room.hostId = remainingUsers[0];
      room.state.users[remainingUsers[0]].role = 'host';
    } else {
      room.hostId = null;
      // Clean up empty room after a delay
      setTimeout(() => {
        const currentRoom = rooms.get(roomId);
        if (currentRoom && Object.keys(currentRoom.state.users).length === 0) {
          rooms.delete(roomId);
        }
      }, 60000); // 1 minute
    }
  }

  return user;
}

export function addStroke(roomId: string, stroke: Stroke): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  room.state.strokes[stroke.id] = stroke;
  return true;
}

export function removeStrokes(roomId: string, strokeIds: string[]): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  
  for (const id of strokeIds) {
    delete room.state.strokes[id];
  }
  return true;
}

export function addText(roomId: string, text: TextItem): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  room.state.texts[text.id] = text;
  return true;
}

export function clearBoard(roomId: string, userId: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;
  
  // Only host can clear the board
  if (room.hostId !== userId) return false;
  
  room.state.strokes = {};
  room.state.texts = {};
  return true;
}

export function isHost(roomId: string, userId: string): boolean {
  const room = rooms.get(roomId);
  return room?.hostId === userId;
}

export function getNewHostId(roomId: string): string | null {
  const room = rooms.get(roomId);
  if (!room) return null;
  return room.hostId;
}

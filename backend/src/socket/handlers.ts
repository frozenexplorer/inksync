import { Server, Socket } from 'socket.io';
import {
  addUserToRoom,
  removeUserFromRoom,
  getRoom,
  addStroke,
  removeStrokes,
  addText,
  updateText,
  removeText,
  addShape,
  updateShape,
  removeShape,
  addChatMessage,
  clearBoard,
  getNewHostId,
  getRoomExpiryInfo,
  touchRoom
} from '../rooms/manager';
import { Stroke, TextItem, ShapeItem, JoinRoomPayload, CursorUpdate, Point, ChatMessage } from '../types';

interface SocketData {
  userId: string;
  roomId: string;
  userName: string;
  clerkUserId: string | null;
}

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);

    let socketData: SocketData | null = null;

    // Join room
    socket.on('room:join', (payload: JoinRoomPayload & { clerkUserId?: string }) => {
      const { roomId, userName, isCreating = false, clerkUserId } = payload;
      const userId = socket.id;

      // Validate room ID format (basic check)
      if (!roomId || roomId.length < 4 || roomId.length > 20) {
        socket.emit('room:error', {
          code: 'INVALID_ROOM_ID',
          message: 'Invalid room ID format'
        });
        return;
      }

      socketData = { userId, roomId, userName, clerkUserId: clerkUserId || null };

      // Join the socket room
      socket.join(roomId);

      // Add user to room state (pass Clerk user ID for ownership tracking)
      // This will create the room if it doesn't exist (via getOrCreateRoom)
      const { user } = addUserToRoom(roomId, userId, userName, clerkUserId || null);

      // Get current room state
      const room = getRoom(roomId);
      if (!room) {
        socket.emit('room:error', {
          code: 'ROOM_CREATION_FAILED',
          message: 'Failed to create or access room'
        });
        return;
      }

      // Get room expiry info
      const expiryInfo = getRoomExpiryInfo(roomId);

      // Send full state to the joining user
      socket.emit('room:state', {
        state: room.state,
        userId,
        role: user.role,
        userColor: user.color,
        expiresAt: expiryInfo?.expiresAt || null,
        isGuest: expiryInfo?.isGuest || false
      });

      // Broadcast to others that a new user joined
      socket.to(roomId).emit('user:joined', user);

      const authStatus = clerkUserId ? 'authenticated' : 'guest';
      console.log(`User ${userName} (${userId}) joined room ${roomId} as ${user.role} [${authStatus}]`);
    });

    // New stroke added
    socket.on('stroke:add', (stroke: Stroke) => {
      if (!socketData) return;
      const { roomId } = socketData;

      if (addStroke(roomId, stroke)) {
        // Broadcast to other clients only (not back to sender)
        socket.to(roomId).emit('stroke:added', stroke);
      }
    });

    // Strokes erased
    socket.on('erase:strokes', (strokeIds: string[]) => {
      if (!socketData) return;
      const { roomId } = socketData;

      if (removeStrokes(roomId, strokeIds)) {
        // Broadcast to other clients only (not back to sender)
        socket.to(roomId).emit('strokes:erased', strokeIds);
      }
    });

    // Text added
    socket.on('text:add', (text: TextItem) => {
      if (!socketData) return;
      const { roomId } = socketData;

      if (addText(roomId, text)) {
        // Broadcast to other clients only (not back to sender)
        socket.to(roomId).emit('text:added', text);
      }
    });

    socket.on('text:update', (text: TextItem) => {
      if (!socketData) return;
      const { roomId } = socketData;

      if (updateText(roomId, text)) {
        socket.to(roomId).emit('text:updated', text);
      }
    });

    socket.on('text:remove', (textId: string) => {
      if (!socketData) return;
      const { roomId } = socketData;

      if (removeText(roomId, textId)) {
        socket.to(roomId).emit('text:removed', textId);
      }
    });

    // Shape added
    socket.on('shape:add', (shape: ShapeItem) => {
      if (!socketData) return;
      const { roomId } = socketData;

      if (addShape(roomId, shape)) {
        socket.to(roomId).emit('shape:added', shape);
      }
    });

    // Shape updated
    socket.on('shape:update', (shape: ShapeItem) => {
      if (!socketData) return;
      const { roomId } = socketData;

      if (updateShape(roomId, shape)) {
        socket.to(roomId).emit('shape:updated', shape);
      }
    });

    // Shape removed
    socket.on('shape:remove', (shapeId: string) => {
      if (!socketData) return;
      const { roomId } = socketData;

      if (removeShape(roomId, shapeId)) {
        socket.to(roomId).emit('shape:removed', shapeId);
      }
    });

    // Chat message sent
    socket.on('chat:send', (payload: { content: string }) => {
      if (!socketData) return;
      const { roomId, userId } = socketData;

      const room = getRoom(roomId);
      if (!room) return;

      const user = room.state.users[userId];
      if (!user) return;

      const trimmed = (payload?.content || '').trim();
      if (!trimmed) return;

      const message: ChatMessage = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        userName: user.name,
        userColor: user.color,
        content: trimmed.slice(0, 500),
        timestamp: Date.now(),
      };

      if (addChatMessage(roomId, message)) {
        io.to(roomId).emit('chat:new', message);
      }
    });

    // Clear board (host only)
    socket.on('board:clear', () => {
      if (!socketData) return;
      const { roomId, userId } = socketData;

      if (clearBoard(roomId, userId)) {
        io.to(roomId).emit('board:cleared');
      }
    });

    // Cursor position update
    socket.on('cursor:move', (data: { position: Point; isActive: boolean }) => {
      if (!socketData) return;
      const { roomId, userId, userName } = socketData;

      const room = getRoom(roomId);
      if (!room) return;

      const user = room.state.users[userId];
      if (!user) return;

      const cursorUpdate: CursorUpdate = {
        userId,
        userName,
        userColor: user.color,
        position: data.position,
        isActive: data.isActive,
      };

      // Broadcast to others (not back to sender)
      socket.to(roomId).emit('cursor:update', cursorUpdate);
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (!socketData) return;
      const { roomId, userId } = socketData;

      const user = removeUserFromRoom(roomId, userId);
      if (user) {
        socket.to(roomId).emit('user:left', userId);

        // If host left, notify about new host
        const newHostId = getNewHostId(roomId);
        if (newHostId && newHostId !== userId) {
          io.to(roomId).emit('host:changed', newHostId);
        }
      }

      console.log('Client disconnected:', socket.id);
    });
  });
}

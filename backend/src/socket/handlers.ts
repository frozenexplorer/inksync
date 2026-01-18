import { Server, Socket } from 'socket.io';
import { 
  addUserToRoom, 
  removeUserFromRoom, 
  getRoom, 
  addStroke, 
  removeStrokes,
  addText,
  addChatMessage,
  clearBoard,
  getNewHostId
} from '../rooms/manager';
import { Stroke, TextItem, JoinRoomPayload, CursorUpdate, Point, ChatMessage } from '../types';

interface SocketData {
  userId: string;
  roomId: string;
  userName: string;
}

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log('Client connected:', socket.id);
    
    let socketData: SocketData | null = null;

    // Join room
    socket.on('room:join', (payload: JoinRoomPayload) => {
      const { roomId, userName, isCreating = false } = payload;
      const userId = socket.id;
      
      // Check if room exists when joining (not creating)
      const existingRoom = getRoom(roomId);
      if (!isCreating && !existingRoom) {
        // Room doesn't exist and user is trying to join
        socket.emit('room:error', {
          code: 'ROOM_NOT_FOUND',
          message: `Room "${roomId}" doesn't exist`
        });
        console.log(`User ${userName} tried to join non-existent room ${roomId}`);
        return;
      }
      
      socketData = { userId, roomId, userName };
      
      // Join the socket room
      socket.join(roomId);
      
      // Add user to room state
      const { user } = addUserToRoom(roomId, userId, userName);
      
      // Get current room state
      const room = getRoom(roomId);
      if (!room) return;

      // Send full state to the joining user
      socket.emit('room:state', {
        state: room.state,
        userId,
        role: user.role,
        userColor: user.color
      });

      // Broadcast to others that a new user joined
      socket.to(roomId).emit('user:joined', user);
      
      console.log(`User ${userName} (${userId}) joined room ${roomId} as ${user.role}`);
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

// Shared types for whiteboard collaboration

export type Point = {
  x: number;
  y: number;
};

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  thickness: number;
  authorId: string;
}

export interface TextItem {
  id: string;
  position: Point;
  content: string;
  fontSize: number;
  fontFamily?: string;
  rotation?: number;
  color: string;
  authorId: string;
}

export interface User {
  userId: string;
  role: 'host' | 'participant';
  color: string;
  name: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  content: string;
  timestamp: number;
}

export type ShapeType = 'rectangle' | 'ellipse' | 'line' | 'arrow';

export interface ShapeItem {
  id: string;
  type: ShapeType;
  start: Point;
  end: Point;
  color: string;
  thickness: number;
  authorId: string;
}

export interface StickyNote {
  id: string;
  position: Point;
  content: string;
  color: string;
  width: number;
  height: number;
  authorId: string;
}

export interface WhiteboardState {
  strokes: Record<string, Stroke>;
  texts: Record<string, TextItem>;
  shapes: Record<string, ShapeItem>;
  stickies: Record<string, StickyNote>;
  users: Record<string, User>;
  messages: ChatMessage[];
}

export interface Room {
  id: string;
  state: WhiteboardState;
  hostId: string | null;
}

// Socket event payloads
export interface JoinRoomPayload {
  roomId: string;
  userName: string;
  isCreating?: boolean; // true if creating a new room, false if joining existing
}

export interface RoomErrorPayload {
  code: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'UNKNOWN';
  message: string;
}

export interface RoomStatePayload {
  state: WhiteboardState;
  userId: string;
  role: 'host' | 'participant';
  userColor: string;
}

export interface CreateRoomResponse {
  roomId: string;
}

export interface CursorUpdate {
  userId: string;
  userName: string;
  userColor: string;
  position: Point;
  isActive: boolean;
}

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
  color: string;
  authorId: string;
}

export interface User {
  userId: string;
  role: 'host' | 'participant';
  color: string;
  name: string;
}

export interface WhiteboardState {
  strokes: Record<string, Stroke>;
  texts: Record<string, TextItem>;
  users: Record<string, User>;
}

export type Tool = 'pen' | 'eraser' | 'text';

export type EraserMode = 'stroke' | 'pixel';

export interface CursorPosition {
  userId: string;
  userName: string;
  userColor: string;
  position: Point;
  isActive: boolean; // true when user is actively drawing
  timestamp: number;
}

export interface RoomStatePayload {
  state: WhiteboardState;
  userId: string;
  role: 'host' | 'participant';
  userColor: string;
}

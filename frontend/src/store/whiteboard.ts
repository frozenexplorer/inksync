import { create } from 'zustand';
import { Stroke, TextItem, User, WhiteboardState, Tool, Point } from '@/lib/types';

interface LocalStroke {
  id: string;
  points: Point[];
  color: string;
  thickness: number;
}

interface WhiteboardStore {
  // Connection state
  isConnected: boolean;
  roomId: string | null;
  
  // User state
  userId: string | null;
  userName: string;
  userColor: string;
  role: 'host' | 'participant' | null;
  
  // Whiteboard state (synced)
  strokes: Record<string, Stroke>;
  texts: Record<string, TextItem>;
  users: Record<string, User>;
  
  // Local drawing state
  currentStroke: LocalStroke | null;
  
  // Tool state
  tool: Tool;
  penColor: string;
  penThickness: number;
  fontSize: number;
  
  // Text input state
  textInputPosition: Point | null;
  
  // Actions
  setConnected: (connected: boolean) => void;
  setRoomId: (roomId: string | null) => void;
  setUserInfo: (userId: string, role: 'host' | 'participant', userColor: string) => void;
  setUserName: (name: string) => void;
  
  // Sync actions
  hydrateState: (state: WhiteboardState) => void;
  addStroke: (stroke: Stroke) => void;
  removeStrokes: (strokeIds: string[]) => void;
  addText: (text: TextItem) => void;
  clearBoard: () => void;
  addUser: (user: User) => void;
  removeUser: (userId: string) => void;
  setHostChanged: (newHostId: string) => void;
  
  // Local drawing
  startStroke: (id: string, point: Point) => void;
  extendStroke: (point: Point) => void;
  finishStroke: () => LocalStroke | null;
  
  // Tool actions
  setTool: (tool: Tool) => void;
  setPenColor: (color: string) => void;
  setPenThickness: (thickness: number) => void;
  setFontSize: (size: number) => void;
  
  // Text input
  setTextInputPosition: (position: Point | null) => void;
  
  // Reset
  reset: () => void;
}

const initialState = {
  isConnected: false,
  roomId: null,
  userId: null,
  userName: '',
  userColor: '#4ECDC4',
  role: null as 'host' | 'participant' | null,
  strokes: {},
  texts: {},
  users: {},
  currentStroke: null,
  tool: 'pen' as Tool,
  penColor: '#000000',
  penThickness: 3,
  fontSize: 16,
  textInputPosition: null,
};

export const useWhiteboardStore = create<WhiteboardStore>((set, get) => ({
  ...initialState,
  
  setConnected: (connected) => set({ isConnected: connected }),
  setRoomId: (roomId) => set({ roomId }),
  setUserInfo: (userId, role, userColor) => set({ userId, role, userColor }),
  setUserName: (userName) => set({ userName }),
  
  hydrateState: (state) => set({
    strokes: state.strokes,
    texts: state.texts,
    users: state.users,
  }),
  
  addStroke: (stroke) => set((state) => ({
    strokes: { ...state.strokes, [stroke.id]: stroke }
  })),
  
  removeStrokes: (strokeIds) => set((state) => {
    const newStrokes = { ...state.strokes };
    for (const id of strokeIds) {
      delete newStrokes[id];
    }
    return { strokes: newStrokes };
  }),
  
  addText: (text) => set((state) => ({
    texts: { ...state.texts, [text.id]: text }
  })),
  
  clearBoard: () => set({ strokes: {}, texts: {} }),
  
  addUser: (user) => set((state) => ({
    users: { ...state.users, [user.userId]: user }
  })),
  
  removeUser: (userId) => set((state) => {
    const newUsers = { ...state.users };
    delete newUsers[userId];
    return { users: newUsers };
  }),
  
  setHostChanged: (newHostId) => set((state) => {
    const newUsers = { ...state.users };
    // Update roles
    for (const userId in newUsers) {
      newUsers[userId] = {
        ...newUsers[userId],
        role: userId === newHostId ? 'host' : 'participant'
      };
    }
    // Update own role if applicable
    const newRole = state.userId === newHostId ? 'host' : state.role;
    return { users: newUsers, role: newRole };
  }),
  
  startStroke: (id, point) => set({
    currentStroke: {
      id,
      points: [point],
      color: get().penColor,
      thickness: get().penThickness,
    }
  }),
  
  extendStroke: (point) => set((state) => {
    if (!state.currentStroke) return {};
    return {
      currentStroke: {
        ...state.currentStroke,
        points: [...state.currentStroke.points, point],
      }
    };
  }),
  
  finishStroke: () => {
    const stroke = get().currentStroke;
    set({ currentStroke: null });
    return stroke;
  },
  
  setTool: (tool) => set({ tool, textInputPosition: null }),
  setPenColor: (penColor) => set({ penColor }),
  setPenThickness: (penThickness) => set({ penThickness }),
  setFontSize: (fontSize) => set({ fontSize }),
  
  setTextInputPosition: (textInputPosition) => set({ textInputPosition }),
  
  reset: () => set(initialState),
}));

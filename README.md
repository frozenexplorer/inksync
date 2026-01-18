# InkSync - Real-Time Collaborative Whiteboard

A real-time collaborative whiteboard where multiple users can draw, erase, and add text on a shared canvas with instant synchronization.

## Features

- **Real-time Collaboration**: Multiple users can draw simultaneously with instant sync
- **Drawing Tools**: Pen, Eraser, and Text tools with customizable options
- **Customization**: 
  - Multiple colors (11 color palette)
  - Adjustable brush sizes (2px - 16px)
  - Text tool with font family selection and size control
  - Eraser with stroke and pixel modes
- **Room-based**: Create or join rooms via unique Room IDs
- **Easy Sharing**: Share via invite link or room code
- **User Roles**: Host (first user) can clear the board; participants can draw
- **Presence Indicators**: See who's in the room with color-coded avatars
- **Late Joiner Support**: New users receive the full board state on join
- **Authentication**: Optional sign-in with Clerk (Google, GitHub, Email)
- **Room Persistence**: 
  - Guest rooms expire after 24 hours of inactivity
  - Authenticated user rooms persist indefinitely
- **Real-time Chat**: Built-in chat panel for collaboration
- **Remote Cursors**: See other users' cursor positions in real-time
- **Smart Text Input**: Text overlay automatically adjusts position to stay within canvas bounds

## Tech Stack

### Frontend
- **Next.js 16+** (App Router)
- **React 19** with HTML5 Canvas API
- **Tailwind CSS 4** for styling
- **Zustand** for state management
- **Framer Motion** for animations
- **Socket.io Client** for real-time communication
- **Clerk** for authentication (Google, GitHub, Email)
- **ResizeObserver API** for responsive canvas sizing

### Backend
- **Node.js** with **Express.js**
- **Socket.io** for WebSocket connections
- **In-memory state** (no database required)
- **CORS** configured for Vercel deployments
- **Room expiration** logic for guest rooms

## Getting Started

### Prerequisites
- Node.js 18+ installed
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd inksync
   ```

2. **Set up Git Hooks** (required for contributors)
   ```bash
   npm run setup
   # Or manually: git config core.hooksPath .githooks
   ```

3. **Install All Dependencies**
   ```bash
   npm run install:all
   ```
   
   Or install separately:
   ```bash
   # Backend
   cd backend
   npm install
   
   # Frontend
   cd ../frontend
   npm install
   ```

4. **Set up Environment Variables**

   **Frontend** (`frontend/.env.local`):
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
   CLERK_SECRET_KEY=sk_test_...
   ```

   **Backend** (`backend/.env`):
   ```env
   PORT=3001
   FRONTEND_URL=http://localhost:3000
   ```

   > **Note**: Get Clerk keys from [clerk.com](https://clerk.com). Authentication is optional - the app works without it for guest users.

### Running the Application

1. **Start the Backend Server**
   ```bash
   cd backend
   npm run dev
   ```
   The server will start on http://localhost:3001

2. **Start the Frontend**
   ```bash
   cd frontend
   npm run dev
   ```
   The app will be available at http://localhost:3000

## Usage

### Getting Started

1. Open http://localhost:3000 in your browser
2. **Choose your access method**:
   - **Guest Mode**: Enter your name and create/join a room (no sign-up required)
   - **Signed In**: Sign in with Clerk for persistent boards and saved sessions
3. **Create or Join a Room**:
   - Click "Create Room" to start a new whiteboard
   - Or enter a room code to join an existing session
4. **Share with others**:
   - Click the **Share** button in the header to get the invite link
   - Copy the room code and share it
   - Share the direct invite link: `http://localhost:3000/join/ROOM_ID`

### Drawing Tools

Use the toolbar on the left:

- **Pen Tool**: Draw on the canvas with customizable colors and brush sizes
- **Eraser Tool**: 
  - **Stroke Mode**: Erase entire strokes at once
  - **Pixel Mode**: Erase parts of strokes with adjustable size
- **Text Tool**: 
  - Click on canvas to add text
  - Choose from multiple font families
  - Adjustable text size
  - Text input automatically positions to stay within canvas bounds

### Features

- **Color Palette**: 11 predefined colors + custom selection
- **Brush Sizes**: 5 size options (2px - 16px)
- **Clear Board**: Host can clear the entire board (with confirmation modal)
- **Real-time Chat**: Open the chat panel to communicate with other users
- **Remote Cursors**: See where other users are pointing/drawing
- **Settings**: Toggle cursor count display and other preferences

## Architecture

```
Client (Next.js + Canvas)
        ↓
Local optimistic rendering (immediate feedback)
        ↓
Real-time sync via Socket.io WebSockets
        ↓
Backend (Express + Socket.io)
        ↓
Broadcast to all connected clients (excluding sender)
```

### Sync Philosophy
- **Optimistic Rendering**: Draw locally for instant feedback
- **Event Broadcasting**: On stroke completion (pointerup), push to shared state
- **No Echo**: Server broadcasts to other clients only (prevents flickering)
- **State Hydration**: Canvas re-renders based on shared state changes
- **Late Joiner Support**: New users receive full board state snapshot on join

### Room Management
- **Guest Rooms**: Created by anonymous users, expire after 24 hours of inactivity
- **Authenticated Rooms**: Created by signed-in users, persist indefinitely
- **Room Ownership**: First authenticated user to join a guest room becomes owner
- **Automatic Cleanup**: Empty guest rooms are cleaned up after 1 minute

## Project Structure

```
├── frontend/
│   ├── src/
│   │   ├── app/                    # Next.js pages
│   │   │   ├── page.tsx           # Landing page with Clerk auth
│   │   │   ├── room/[roomId]/     # Room page with canvas
│   │   │   ├── join/[roomId]/     # Join room page
│   │   │   └── layout.tsx         # Root layout with ClerkProvider
│   │   ├── components/            # React components
│   │   │   ├── Canvas.tsx         # Main drawing canvas (ResizeObserver)
│   │   │   ├── Toolbar.tsx        # Drawing tools sidebar
│   │   │   ├── TextOverlay.tsx    # Smart text input overlay
│   │   │   ├── ChatPanel.tsx      # Real-time chat panel
│   │   │   ├── ClearBoardModal.tsx # Clear board confirmation
│   │   │   ├── ShareModal.tsx     # Share room modal
│   │   │   ├── PresenceBar.tsx    # User presence indicators
│   │   │   ├── CursorTooltips.tsx # Remote cursor tooltips
│   │   │   └── Toast.tsx          # Toast notifications
│   │   ├── lib/                   # Utilities & socket
│   │   │   ├── socket.ts          # Socket.io client setup
│   │   │   ├── types.ts           # Shared TypeScript types
│   │   │   └── typography.ts      # Text font definitions
│   │   ├── store/                 # Zustand store
│   │   │   └── whiteboard.ts      # Main state management
│   │   └── proxy.ts                # Clerk middleware (Next.js 16)
│   └── package.json
│
└── backend/
    ├── src/
    │   ├── index.ts                # Server entry & CORS config
    │   ├── socket/                 # Socket handlers
    │   │   └── handlers.ts        # All Socket.io event handlers
    │   ├── rooms/                  # Room management
    │   │   └── manager.ts          # Room state & expiration logic
    │   └── types.ts                # Shared TypeScript types
    ├── railway.json                # Railway deployment config
    ├── Procfile                    # Heroku deployment config
    └── package.json
```

## Deployment

### Frontend (Vercel)

1. Connect your GitHub repository to Vercel
2. Set **Root Directory** to `frontend`
3. Add environment variables:
   - `NEXT_PUBLIC_API_URL` - Your backend URL
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - From Clerk dashboard
   - `CLERK_SECRET_KEY` - From Clerk dashboard
4. Deploy

### Backend (Railway)

See `backend/RAILWAY_DEPLOY.md` for detailed instructions.

**Quick Steps:**
1. Install Railway CLI: `npm i -g @railway/cli`
2. Login: `railway login`
3. Initialize: `cd backend && railway init`
4. Set environment variables:
   - `FRONTEND_URL` - Your Vercel frontend URL
5. Deploy: `railway up`

**Alternative Platforms**: Render, Fly.io, Heroku, DigitalOcean (see `backend/DEPLOYMENT.md`)

### Environment Variables Reference

#### Frontend (`.env.local`)
| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NEXT_PUBLIC_API_URL` | Backend server URL | Yes (production) | `http://localhost:3001` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key | No (optional) | - |
| `CLERK_SECRET_KEY` | Clerk secret key | No (optional) | - |

#### Backend (`.env`)
| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | `3001` |
| `FRONTEND_URL` | Frontend URL for CORS | Yes (production) | - |

## Troubleshooting

### Canvas Issues
- **Black screen**: Ensure canvas dimensions are set correctly. Check browser console for errors.
- **Text input off-screen**: Text overlay should auto-adjust. If not, check viewport dimensions.

### Connection Issues
- **CORS errors**: Verify `FRONTEND_URL` matches your frontend URL exactly (including `https://`)
- **WebSocket connection fails**: Check that backend URL is correct in `NEXT_PUBLIC_API_URL`
- **Room not found**: Verify backend is running and room ID is correct

### Authentication Issues
- **Clerk not working**: Ensure environment variables are set correctly
- **Guest mode**: App works without Clerk - authentication is optional

### Deployment Issues
- **Vercel build fails**: Check that Root Directory is set to `frontend`
- **Railway deployment fails**: Verify `railway.json` and build commands are correct
- **Backend won't start**: Check that `dist/` folder exists after build

## Recent Updates

### v2.0 - Major Updates

- ✅ **Clerk Authentication**: Replaced NextAuth with Clerk for simpler auth flow
- ✅ **Room Persistence**: Guest rooms expire after 24h; authenticated rooms persist
- ✅ **Canvas Improvements**: 
  - ResizeObserver for reliable canvas resizing
  - Local stroke rendering to prevent flickering
  - Smart text overlay positioning
- ✅ **UI Enhancements**:
  - Custom clear board confirmation modal
  - Improved toolbar icon alignment
  - Standard text tool icon (industry practice)
- ✅ **CORS Configuration**: Enhanced for Vercel preview deployments
- ✅ **Deployment Guides**: Complete Railway deployment documentation

### Technical Improvements

- **Performance**: Optimized rendering with ResizeObserver
- **UX**: Text input stays within canvas bounds automatically
- **Reliability**: No stroke flickering (server excludes sender from broadcasts)
- **Scalability**: Room expiration prevents memory leaks

## Contributing

### Branch Naming Convention

Direct commits to `main` and `master` branches are **not allowed**. Please create a feature branch and submit a pull request.

Branch names must follow this pattern:
```
(feature|bugfix|update|release|hotfix)/[a-z0-9._-]+
```

**Examples:**
- `feature/add-user-auth`
- `bugfix/fix-login-error`
- `update/upgrade-dependencies`
- `release/v1.0.0`
- `hotfix/critical-security-fix`

### Git Hooks

This project uses pre-commit hooks to enforce branch naming conventions. Run `npm run setup` after cloning to enable them.

## License

MIT

# SyncBoard — Real-Time Collaborative Whiteboard

A full-stack multi-user collaborative whiteboard with real-time drawing, shape tools, in-room chat, and live participant tracking.

## Tech Stack
- **Frontend:** React 19, Vite, React Router, Socket.IO Client, HTML5 Canvas
- **Backend:** Node.js, Express, Socket.IO, UUID

## Quick Start

### 1. Backend
```bash
cd backend
npm install
npm run dev
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — create a room, share the code, and draw together!

## Features
- ✏️ Drawing tools: Pencil, Line, Rectangle, Eraser
- 🎨 Color palette + adjustable brush size
- 🔄 Real-time canvas sync via WebSockets
- 💬 In-room chat with message history
- 👥 Live participant tracking
- 🏠 Room-based sessions with shareable codes
- ↩️ Undo & Clear canvas

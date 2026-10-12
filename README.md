# SyncBoard — a live whiteboard for tutoring

SyncBoard is a real-time collaborative whiteboard built for tutors and their students: draw and explain on an infinite canvas, talk over built-in voice/video, drop in lesson templates and LaTeX equations, leave pinned comments, and come back to every board later with full version history.

## Features

**Whiteboard** (powered by [Excalidraw](https://github.com/excalidraw/excalidraw))

- Infinite canvas with pan/zoom, select/move/resize, shapes, arrows, text, sticky notes, images, freehand, laser pointer
- Per-user undo/redo — undoing never reverts someone else's work
- Graph-paper grid per board, light/dark themes
- Export to PNG/SVG/clipboard and **PDF handouts**

**Tutoring tools**

- Lesson templates: coordinate plane, number line, fraction bars, practice problems, lesson plan, Cornell notes, Venn diagram, homework tracker
- **LaTeX equation tool** (MathJax) that places crisp, resizable equations on the board
- **Voice & video calls** inside the board (WebRTC mesh, designed for a tutor plus a few students)
- **Follow mode** — click a participant's avatar to mirror their view (students follow the tutor)

**Collaboration**

- Live cursors, selections and presence
- Roles: owner, editor, viewer; "anyone with the link can view/edit"; optional board password; expiring invite links
- Pinned comment threads with replies and resolve
- Chat with history, owner moderation (delete, mute)
- Version history: automatic snapshots + named versions, preview and restore
- Offline-tolerant: edits made while disconnected sync on reconnect

**Accounts**

- Email/password and Google sign-in
- Short-lived access tokens + rotating httpOnly refresh cookies with reuse detection
- Email verification, password reset, change password, sign out everywhere, delete account
- Profile stats: boards created/joined, messages sent, time on boards

## Architecture

```
┌──────────────┐  REST /api (JWT)   ┌──────────────────────────┐
│  React 19 +  │ ─────────────────▶ │  Express 5 (TypeScript)  │──▶ MongoDB
│  Excalidraw  │  Socket.IO (JWT)   │  Socket.IO               │     boards, elements (1 doc each),
│  (Vite)      │ ◀────────────────▶ │  ├ scene sync            │     files, versions, chat, comments,
└──────────────┘  WebRTC (P2P A/V)  │  ├ presence / chat       │     sessions
        ▲  ▲─────────────────────── │  └ WebRTC signalling     │──▶ Redis (optional, multi-instance)
        └─── other participants     └──────────────────────────┘
```

- `shared/` — types, typed socket events, zod schemas and the reconciliation rule used by both sides.
- `backend/` — API + realtime server. Stateless: scene state lives in MongoDB, so instances scale horizontally behind the Socket.IO Redis adapter.
- `frontend/` — React app. The board route (Excalidraw) and MathJax are lazy-loaded.
- `e2e/` — Playwright tests driving two browsers on one board.

**How sync works.** Every element carries a `version` and random `versionNonce`. Clients send only elements whose version moved past what the server is known to have. The server applies each element with a version-conditional upsert (last writer wins; ties go to the lower nonce — the same rule Excalidraw uses), relays accepted elements to the room, and sends back the winning copy of anything stale. Remote updates are merged with Excalidraw's `reconcileElements` without entering the local undo stack. On reconnect the client re-joins, reconciles the server snapshot with its local scene and pushes anything newer.

## Getting started

Requirements: Node 22+ and MongoDB (local, Atlas, or the bundled in-memory dev database).

```bash
npm install                        # installs all workspaces and builds shared/
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# No MongoDB installed? Run a persistent local one (data in backend/.dev-db):
npm run dev:memory-db -w @syncboard/backend

npm run dev                        # API on :5000, web on :5173
```

Open http://localhost:5173. In development, Vite proxies `/api` and `/socket.io` to the API, so cookies are same-origin. Verification and reset emails are printed to the API log until `SMTP_URL` is set.

### Scripts

| Command                                                 | What it does                                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run dev`                                           | API + web with hot reload                                                                 |
| `npm test`                                              | Unit/integration tests in every workspace (backend uses an in-memory MongoDB)             |
| `npm run test:e2e`                                      | Playwright end-to-end tests (run `npm run install-browsers -w @syncboard/e2e-tests` once) |
| `npm run lint` / `npm run typecheck` / `npm run format` | Code quality                                                                              |
| `npm run build`                                         | Production builds of shared, backend and frontend                                         |
| `npm run migrate:rooms -w @syncboard/backend`           | Dry-run migration of v1 `rooms` data (add `-- --apply` to write)                          |

## Configuration

See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example) for every option. The important ones:

| Variable                                     | Where    | Notes                                                                                     |
| -------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| `JWT_ACCESS_SECRET`                          | backend  | **Required in production**, 32+ random characters (the server refuses to start otherwise) |
| `MONGODB_URI`                                | backend  |                                                                                           |
| `CORS_ORIGIN`, `APP_URL`                     | backend  | Allowed web origins; base URL for email links                                             |
| `COOKIE_SAMESITE`, `COOKIE_SECURE`           | backend  | See deployment below                                                                      |
| `REDIS_URL`                                  | backend  | Enables multi-instance scaling                                                            |
| `SMTP_URL`, `MAIL_FROM`                      | backend  | Email delivery                                                                            |
| `SENTRY_DSN`, `METRICS_TOKEN`                | backend  | Error tracking; bearer token for `/metrics`                                               |
| `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID` | both     | Google sign-in (optional)                                                                 |
| `VITE_API_BASE_URL`, `VITE_SOCKET_URL`       | frontend | Where the API lives (defaults: same origin)                                               |
| `VITE_ICE_SERVERS`                           | frontend | STUN/TURN servers for calls. Add a TURN server for school/corporate networks              |

## Deployment

**API** (Render, Railway, Fly, a VM…): build with `npm ci && npm run build -w @syncboard/shared && npm run build -w @syncboard/backend` from the repo root and start with `npm start -w @syncboard/backend`. Set `NODE_ENV=production`, `TRUST_PROXY=1` behind a load balancer, and the variables above. Health checks: `GET /api/health` (liveness) and `GET /api/health/ready` (MongoDB/Redis).

**Web** (Vercel, Netlify…): project root `frontend`, build `npm run build`, output `dist`. The repo-root install builds `shared/` automatically via `postinstall`.

**Cookies.** The refresh token is an httpOnly cookie scoped to `/api/auth`. Two setups work:

1. _Recommended:_ serve the API under the web app's domain — e.g. add a Vercel rewrite `{"source": "/api/:path*", "destination": "https://your-api.example.com/api/:path*"}` to `frontend/vercel.json` — and keep `COOKIE_SAMESITE=lax`. Set `VITE_SOCKET_URL` to the API's own URL (static hosts can't proxy WebSockets; sockets authenticate with the access token, not the cookie).
2. Cross-site API: set `VITE_API_BASE_URL=https://your-api.example.com/api`, `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`. Browsers that block third-party cookies (Safari) will sign users out on reload, so prefer option 1.

**Scaling.** Run several API instances with `REDIS_URL` set and either sticky sessions or WebSocket-only transport. Scene writes are conditional upserts in MongoDB and auto-snapshots claim boards atomically, so instances don't need to coordinate. Rate limits are per instance.

**Observability.** Structured JSON logs (pino) with request ids, Prometheus metrics at `/metrics` (HTTP latency, socket connections, socket events, scene element outcomes), optional Sentry on both API and web.

## Upgrading from v1

v1 kept each room's canvas inside the room document and closed rooms 30 seconds after they emptied. v2 stores boards permanently. To bring over v1 drawings:

```bash
npm run migrate:rooms -w @syncboard/backend            # preview
npm run migrate:rooms -w @syncboard/backend -- --apply # migrate
```

Pencil, line and rectangle strokes are converted to Excalidraw elements; v1 eraser strokes and anonymous chat history can't be carried over. Existing users must sign in again once, because sessions moved from localStorage tokens to refresh cookies.

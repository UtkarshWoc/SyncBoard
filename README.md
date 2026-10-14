# SyncBoard — a live whiteboard for tutoring

SyncBoard is a real-time collaborative whiteboard built for tutors and their students: draw and explain on an infinite canvas, talk over built-in voice/video, drop in lesson templates and LaTeX equations, leave pinned comments, and come back to every board later with full version history.

|                                              |                                          |
| -------------------------------------------- | ---------------------------------------- |
| ![Dashboard](screenshots/dashboard-dark.png) | ![Board](screenshots/board-dark.png)     |
| ![Sign in](screenshots/auth-dark.png)        | ![Profile](screenshots/profile-dark.png) |

## Contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Access control](#access-control)
- [REST API reference](#rest-api-reference)
- [Realtime (Socket.IO) reference](#realtime-socketio-reference)
- [Data model](#data-model)
- [Security](#security)
- [Testing and CI](#testing-and-ci)
- [Deployment](#deployment)
- [Observability](#observability)
- [Upgrading from v1](#upgrading-from-v1)

## Features

**Whiteboard** (powered by [Excalidraw](https://github.com/excalidraw/excalidraw))

- Infinite canvas with pan/zoom, select/move/resize, shapes, arrows, text, sticky notes, images, freehand, laser pointer
- Per-user undo/redo — undoing never reverts someone else's work
- Graph-paper grid per board, light/dark themes
- Export to PNG/SVG/clipboard and **PDF handouts** (single A4 page sized to the content)

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

## Tech stack

| Layer    | Technology                                                                                                                   |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Frontend | React 19, React Router, Vite, [Excalidraw](https://github.com/excalidraw/excalidraw) 0.18, MathJax, jsPDF, Sentry (optional) |
| Backend  | Node 22+, Express 5, Socket.IO 4, Mongoose 9 (MongoDB), optional Redis adapter, zod, pino, prom-client, helmet               |
| Auth     | JWT access tokens, rotating refresh tokens in httpOnly cookies, bcryptjs, Google Sign-In (`google-auth-library`)             |
| Realtime | Socket.IO for scene/presence/chat/comments, WebRTC (peer-to-peer mesh) for audio/video                                       |
| Tooling  | TypeScript 5.9 (strict, npm workspaces), ESLint 9, Prettier, Vitest, Playwright, GitHub Actions                              |

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

**Calls.** Audio/video is a WebRTC mesh: each participant connects directly to every other participant in the call. The server only relays signalling (`rtc:*` events) and tracks who is in the call. A mesh is fine for a tutor plus a few students; it is not designed for large rooms.

**Version history.** A background job (every 60 s per instance) snapshots boards that were edited since their last snapshot, at most once per `SNAPSHOT_INTERVAL_MINUTES`. Instances claim boards atomically, so running several is safe. Only the newest `SNAPSHOT_KEEP_AUTO` automatic (and pre-restore) snapshots per board are kept; named versions are never pruned. Restoring a version first saves a `pre-restore` snapshot, so a restore can be undone.

## Project structure

```
SyncBoard/
├── shared/                 Code shared by client and server (built to dist/ on install)
│   └── src/                constants (LIMITS), types, events, zod schemas, reconcile
├── backend/
│   ├── src/
│   │   ├── server.ts       Entry point: HTTP + Socket.IO + snapshot job
│   │   ├── app.ts          Express app factory (middleware, routers)
│   │   ├── config/         env (zod-validated), MongoDB, Redis
│   │   ├── http/           routes/ (auth, boards, profile, health), middleware/, cookies
│   │   ├── socket/         Socket.IO server, event handlers, presence, rate limiting
│   │   ├── services/       Business logic: auth, board, scene, chat, comment, version, user
│   │   ├── models/         Mongoose models
│   │   ├── jobs/           Auto-snapshot job
│   │   └── lib/            logger, mailer, metrics, tokens, crypto, errors
│   ├── scripts/            memory-db.ts (local dev database), migrate-legacy-rooms.ts
│   └── test/               Vitest integration tests (in-memory MongoDB)
├── frontend/
│   └── src/
│       ├── pages/          Auth, Dashboard, Board, Invite, Profile, account pages
│       ├── board/          Workspace, sync, call, chat, comments, equations, export,
│       │                   share, templates, versions
│       ├── context/        Auth, Socket, Theme, Toast providers
│       ├── components/     Header, route guards, error boundary, UI primitives
│       ├── lib/            API client, socket client, env, utils
│       └── styles/         Design tokens and per-area CSS
├── e2e/                    Playwright specs (collaboration, voice/video call)
├── screenshots/            Images used in this README
└── .github/workflows/      CI (lint, format, typecheck, unit tests, build, e2e)
```

Frontend routes: `/auth`, `/forgot-password`, `/reset-password`, `/verify-email`, `/` (dashboard), `/profile`, `/board/:boardId`, `/invite/:token`.

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

Run from the repository root unless noted.

| Command                                                 | What it does                                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run dev`                                           | API + web with hot reload                                                                 |
| `npm test`                                              | Unit/integration tests in every workspace (backend uses an in-memory MongoDB)             |
| `npm run test:e2e`                                      | Playwright end-to-end tests (run `npm run install-browsers -w @syncboard/e2e-tests` once) |
| `npm run lint` / `npm run typecheck` / `npm run format` | Code quality (`npm run format:check` verifies without writing)                            |
| `npm run build`                                         | Production builds of shared, backend and frontend                                         |
| `npm start -w @syncboard/backend`                       | Run the built API (`dist/server.js`)                                                      |
| `npm run migrate:rooms -w @syncboard/backend`           | Dry-run migration of v1 `rooms` data (add `-- --apply` to write)                          |

## Configuration

Every option is documented in [`backend/.env.example`](backend/.env.example) and [`frontend/.env.example`](frontend/.env.example). The backend validates its environment with zod at startup and exits with a readable list of problems if something is invalid.

### Backend (`backend/.env`)

| Variable                                      | Default                                       | Notes                                                                                                                                 |
| --------------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                    | `development`                                 | `development`, `test` or `production`                                                                                                 |
| `PORT`                                        | `5000`                                        |                                                                                                                                       |
| `LOG_LEVEL`                                   | `debug` (dev), `info` (prod), `silent` (test) | pino level                                                                                                                            |
| `CORS_ORIGIN`                                 | `http://localhost:5173`                       | Comma-separated list of allowed web origins                                                                                           |
| `APP_URL`                                     | first `CORS_ORIGIN`                           | Public web URL used in email links                                                                                                    |
| `TRUST_PROXY`                                 | off                                           | Express `trust proxy`; set `1` behind one load balancer so rate limits see real IPs                                                   |
| `MONGODB_URI`                                 | `mongodb://127.0.0.1:27017/syncboard`         |                                                                                                                                       |
| `REDIS_URL`                                   | unset                                         | Enables the Socket.IO Redis adapter for multi-instance scaling                                                                        |
| `JWT_ACCESS_SECRET`                           | dev-only fallback                             | **Required in production**, 32+ random characters (the server refuses to start otherwise). `JWT_SECRET` is accepted as a legacy alias |
| `ACCESS_TOKEN_TTL_SECONDS`                    | `900`                                         | Minimum 60                                                                                                                            |
| `REFRESH_TOKEN_TTL_DAYS`                      | `30`                                          |                                                                                                                                       |
| `COOKIE_SAMESITE`                             | `lax`                                         | `lax`, `strict` or `none` (`none` requires `COOKIE_SECURE=true`)                                                                      |
| `COOKIE_SECURE`                               | `true` in production                          |                                                                                                                                       |
| `COOKIE_DOMAIN`                               | unset                                         |                                                                                                                                       |
| `GOOGLE_CLIENT_ID`                            | unset                                         | Enables Google sign-in                                                                                                                |
| `SMTP_URL`                                    | unset                                         | e.g. `smtps://user:pass@smtp.example.com:465`. Without it, emails are written to the log                                              |
| `MAIL_FROM`                                   | `SyncBoard <no-reply@syncboard.local>`        |                                                                                                                                       |
| `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`     | unset, `0`                                    | Error tracking                                                                                                                        |
| `METRICS_TOKEN`                               | unset                                         | Bearer token for `GET /metrics`; without it `/metrics` is disabled in production                                                      |
| `SOCKET_PING_TIMEOUT`, `SOCKET_PING_INTERVAL` | `20000`, `25000`                              | Milliseconds                                                                                                                          |
| `SNAPSHOT_INTERVAL_MINUTES`                   | `10`                                          | Minimum time between automatic snapshots of an edited board                                                                           |
| `SNAPSHOT_KEEP_AUTO`                          | `30`                                          | Automatic snapshots retained per board                                                                                                |

### Frontend (`frontend/.env`)

| Variable                | Default                 | Notes                                                                                                     |
| ----------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`     | same-origin `/api`      | Full API URL when the API is on another host                                                              |
| `VITE_SOCKET_URL`       | current origin          | Socket.IO server. Set in production when the API is on another host (static hosts can't proxy WebSockets) |
| `VITE_DEV_API_TARGET`   | `http://localhost:5000` | Dev only: where the Vite proxy forwards                                                                   |
| `VITE_APP_NAME`         | `SyncBoard`             |                                                                                                           |
| `VITE_GOOGLE_CLIENT_ID` | unset                   | Must match the backend's `GOOGLE_CLIENT_ID`                                                               |
| `VITE_ICE_SERVERS`      | public STUN             | JSON array of `RTCIceServer`. Add a TURN server for school/corporate networks                             |
| `VITE_SENTRY_DSN`       | unset                   |                                                                                                           |

## Access control

A user's role on a board is resolved in this order: **owner** → explicit **member** (editor or viewer) → the board's **general access** setting (`restricted`, `viewer` or `editor`). If general access applies but the board has a password, the user must unlock it first (`POST /api/boards/:id/unlock` or the password on `board:join`). Boards can also be shared through expiring invite links that grant a fixed role.

| Action                                             | Viewer | Editor | Owner |
| -------------------------------------------------- | :----: | :----: | :---: |
| Open the board, see live cursors and presence      |   ✓    |   ✓    |   ✓   |
| Chat, create/reply/resolve comments, join the call |   ✓    |   ✓    |   ✓   |
| Draw, upload images, set thumbnail                 |        |   ✓    |   ✓   |
| Create named versions, restore versions            |        |   ✓    |   ✓   |
| Rename, change access/password/background, delete  |        |        |   ✓   |
| Manage members and invite links                    |        |        |   ✓   |
| Mute users, delete any chat message or comment     |        |        |   ✓   |

Members may remove themselves from a board. Users can delete their own chat messages and comment threads. Role changes and removals are pushed to connected sockets immediately (`board:role-changed`, `board:removed`); a socket re-checks its role every few seconds so changes made on another API instance also apply promptly.

## REST API reference

Base path `/api`. Bodies are JSON and validated with the zod schemas in [`shared/src/schemas.ts`](shared/src/schemas.ts). Authenticated routes need `Authorization: Bearer <accessToken>`.

Errors are returned as `{ "error": { "code", "message", "details?" } }` with one of the stable codes: `BAD_REQUEST`, `VALIDATION`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `PASSWORD_REQUIRED`, `INVALID_PASSWORD`, `NOT_JOINED`, `MUTED`, `LIMIT_EXCEEDED`, `EMAIL_NOT_VERIFIED`, `INTERNAL`.

### Auth — `/api/auth`

| Method & path               | Auth   | Description                                                                                           |
| --------------------------- | ------ | ----------------------------------------------------------------------------------------------------- |
| `POST /register`            | –      | Create an account; returns `{ accessToken, expiresIn, user }` and sets the refresh cookie             |
| `POST /login`               | –      | Email + password sign-in                                                                              |
| `POST /google`              | –      | Sign in with a Google ID token                                                                        |
| `POST /refresh`             | cookie | Rotate the refresh token and return a new access token. Requires header `X-Requested-With: syncboard` |
| `POST /logout`              | cookie | Revoke the current session (same required header)                                                     |
| `POST /logout-all`          | Bearer | Revoke every session of the user                                                                      |
| `GET /me`                   | Bearer | Current user                                                                                          |
| `POST /verify-email`        | –      | Confirm an email token                                                                                |
| `POST /resend-verification` | Bearer | Send a new verification email                                                                         |
| `POST /forgot-password`     | –      | Send a password-reset email                                                                           |
| `POST /reset-password`      | –      | Set a new password with a reset token                                                                 |
| `POST /change-password`     | Bearer | Change password                                                                                       |

### Profile — `/api/profile`

| Method & path | Description                                               |
| ------------- | --------------------------------------------------------- |
| `GET /`       | Profile and stats (boards created/joined, messages, time) |
| `PATCH /`     | Update display name                                       |
| `DELETE /`    | Delete the account                                        |

### Boards — `/api/boards` (all require Bearer auth)

| Method & path                           | Min. role                         | Description                                                                                   |
| --------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------- |
| `GET /`                                 | –                                 | `{ owned, shared, public }` board lists                                                       |
| `POST /`                                | –                                 | Create a board (201)                                                                          |
| `GET /:id`                              | viewer                            | Board details (members, muted users; invites for the owner). `403 PASSWORD_REQUIRED` if gated |
| `POST /:id/unlock`                      | –                                 | Unlock a password-protected board; returns `{ role }`                                         |
| `PATCH /:id`                            | owner                             | Update name, access, password, listing, background                                            |
| `DELETE /:id`                           | owner                             | Delete the board and its data                                                                 |
| `PUT /:id/thumbnail`                    | editor                            | Set the dashboard thumbnail (data URL, ≤ 300 KB)                                              |
| `PATCH /:id/members/:userId`            | owner                             | Change a member's role                                                                        |
| `DELETE /:id/members/:userId`           | owner (viewer to remove yourself) | Remove a member or leave                                                                      |
| `POST /:id/invites`                     | owner                             | Create an invite link `{ role, expiresInDays? }` → `{ token }`                                |
| `DELETE /:id/invites/:token`            | owner                             | Revoke an invite link                                                                         |
| `POST /:id/files`                       | editor                            | Upload an image (≤ 5 MB decoded); idempotent by file id                                       |
| `GET /:id/files/:fileId`                | viewer                            | Fetch an image (immutable, long-cached)                                                       |
| `GET /:id/versions`                     | viewer                            | List versions                                                                                 |
| `POST /:id/versions`                    | editor                            | Create a named version                                                                        |
| `GET /:id/versions/:versionId`          | viewer                            | Version with its elements                                                                     |
| `POST /:id/versions/:versionId/restore` | editor                            | Restore a version (a `pre-restore` snapshot is taken first)                                   |

### Invites — `/api/invites` (Bearer auth)

| Method & path         | Description                                 |
| --------------------- | ------------------------------------------- |
| `GET /:token`         | Preview an invite (board name, role, owner) |
| `POST /:token/accept` | Join the board with the invite's role       |

### Health and metrics

| Method & path           | Description                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET /api/health`       | Liveness                                                                                                  |
| `GET /api/health/ready` | Readiness (checks MongoDB and, if configured, Redis)                                                      |
| `GET /metrics`          | Prometheus metrics; needs `Authorization: Bearer $METRICS_TOKEN` (disabled in production without a token) |

### Rate limits (per instance)

| Limiter | Window / limit  | Applies to                                                                 |
| ------- | --------------- | -------------------------------------------------------------------------- |
| API     | 300 / minute    | Everything under `/api`                                                    |
| Auth    | 30 / 15 minutes | Login, register, Google, token-based verify/reset, change password, unlock |
| Email   | 10 / hour       | Resend verification, forgot password                                       |
| Upload  | 60 / minute     | Image and thumbnail uploads                                                |

Exceeding a limit returns `429` with code `RATE_LIMITED`. Body limits: 100 KB by default, 1 MB for thumbnails and versions, 8 MB for file uploads.

## Realtime (Socket.IO) reference

Connect to the API origin (path `/socket.io`) authenticating with the access token. Event names and payloads are typed in [`shared/src/events.ts`](shared/src/events.ts). Events with an `ack` reply with `{ ok, … }` / an error result.

### Client → server

| Event                                                                     | Min. role                        | Description                                                                                                      |
| ------------------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `board:join` `{ boardId, password? }`                                     | per access                       | Join a board room; ack returns board, role, participants, elements, file ids, comments, recent chat, muted users |
| `board:leave`                                                             | –                                | Leave the room                                                                                                   |
| `scene:update` `{ elements }`                                             | editor                           | Push changed elements (≤ 500 per message); ack returns `{ accepted, rejected }`                                  |
| `presence:update` `{ pointer?, button?, selectedElementIds?, viewport? }` | viewer                           | Cursor / selection / viewport (used by follow mode)                                                              |
| `chat:send` `{ text }`, `chat:history` `{ before? }`                      | viewer                           | Send a message (≤ 2000 chars) / page through history (50 per page)                                               |
| `chat:delete` `{ messageId }`                                             | author or owner                  | Delete a message                                                                                                 |
| `chat:mute` `{ userId, muted }`                                           | owner                            | Mute or unmute a participant                                                                                     |
| `comment:create` / `comment:reply` / `comment:resolve` / `comment:delete` | viewer (delete: author or owner) | Pinned comment threads                                                                                           |
| `rtc:join` / `rtc:leave` / `rtc:media` / `rtc:signal`                     | viewer                           | Join the call, update mic/camera state, relay WebRTC offers/answers/ICE                                          |

### Server → client

| Event                                                                 | Description                                                                   |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `scene:update`, `files:added`                                         | Accepted element changes / new image ids to fetch                             |
| `presence:update`, `participants`                                     | Cursors and the participant list                                              |
| `board:updated`, `board:role-changed`, `board:removed`, `board:muted` | Board settings, role, removal (`deleted` / `access-revoked`) and mute changes |
| `versions:updated`                                                    | Version history changed                                                       |
| `chat:message`, `chat:deleted`                                        | Chat changes                                                                  |
| `comments:upsert`, `comments:remove`                                  | Comment changes                                                               |
| `rtc:peer-joined`, `rtc:peer-left`, `rtc:media`, `rtc:signal`         | Call signalling                                                               |
| `notice`                                                              | Info / warning / error toast                                                  |

### Socket rate limits

Each socket has a token bucket per category (capacity, refill per second): join `10, 0.5` · scene `120, 40` · presence `80, 40` · chat `8, 1` · comment `10, 1` · rtc `300, 60` · misc `30, 5`. The maximum payload is 8 MB.

### Limits

Defined once in [`shared/src/constants.ts`](shared/src/constants.ts) and enforced on both client and server: board name 60 chars, display name 40, password 8–128, board password ≤ 64, chat message 2000, comment 2000 (≤ 200 replies), version label 80, 500 elements per update, 256 KB per element, 50 000 elements per board, 5 MB per image. Board codes are 8 characters from an alphabet without look-alike characters.

## Data model

MongoDB collections (Mongoose models in [`backend/src/models`](backend/src/models)):

| Collection       | Purpose                                                                                                    |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| `users`          | Account, optional password hash and Google id, verification flag, usage stats                              |
| `sessions`       | Hashed refresh tokens grouped by rotation family; TTL-expired; reuse of a rotated token revokes the family |
| `authtokens`     | Hashed one-time email-verification and password-reset tokens (TTL-expired)                                 |
| `boards`         | Board code (`_id`), owner, members, invites, general access, password hash, background, snapshot markers   |
| `boardelements`  | One document per Excalidraw element, unique on `(boardId, elementId)`, with `version` and `versionNonce`   |
| `boardfiles`     | Uploaded images (binary), unique on `(boardId, fileId)`                                                    |
| `boardversions`  | Gzipped scene snapshots of kind `auto`, `manual` or `pre-restore`                                          |
| `chatmessages`   | Chat history with soft deletion                                                                            |
| `commentthreads` | Pinned threads with their replies and resolved state                                                       |

## Security

- Passwords hashed with bcrypt; secrets, refresh tokens and email tokens are stored only as hashes.
- Access tokens are short-lived (15 min by default); refresh tokens live in an httpOnly cookie scoped to `/api/auth`, rotate on every use, and a replayed token revokes the whole session family.
- `/api/auth/refresh` and `/logout` require an `X-Requested-With: syncboard` header as a CSRF guard.
- `helmet`, CORS allow-list, request-size limits, per-route rate limits and per-socket token buckets.
- Every request body and socket payload is validated with zod; socket handlers re-check the caller's role on each action.
- The server refuses to start in production with a weak or default `JWT_ACCESS_SECRET`, or with `SameSite=None` cookies that are not `Secure`.
- Frontend API paths are URL-encoded per segment.

## Testing and CI

| Suite       | Where                  | Notes                                                                                                                                                                                                |
| ----------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | `shared/`, `frontend/` | Vitest (frontend runs in jsdom): reconciliation, API client, utilities, templates, auth page                                                                                                         |
| Integration | `backend/test/`        | Vitest against an in-memory MongoDB (or set `TEST_MONGODB_URI`): auth, boards, scene sync, sockets, security, migration                                                                              |
| End-to-end  | `e2e/`                 | Playwright + Chromium; boots its own MongoDB, API (`:5099`) and web (`:5199`); covers two-browser collaboration and a WebRTC call with fake media. Set `E2E_MONGODB_URI` to use an external database |

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on pushes to `main` and `feature/**` and on pull requests: lint, format check, typecheck, unit/integration tests and build against a MongoDB 7 service, followed by the Playwright job (report uploaded on failure).

Before opening a pull request run `npm run lint && npm run format:check && npm run typecheck && npm test`.

## Deployment

**API** (Render, Railway, Fly, a VM…): build with `npm ci && npm run build -w @syncboard/shared && npm run build -w @syncboard/backend` from the repo root and start with `npm start -w @syncboard/backend`. Set `NODE_ENV=production`, `TRUST_PROXY=1` behind a load balancer, and the variables above. Health checks: `GET /api/health` (liveness) and `GET /api/health/ready` (MongoDB/Redis).

**Web** (Vercel, Netlify…): project root `frontend`, build `npm run build`, output `dist`. The repo-root install builds `shared/` automatically via `postinstall`. [`frontend/vercel.json`](frontend/vercel.json) provides the SPA fallback and long-term caching for hashed assets.

**Cookies.** The refresh token is an httpOnly cookie scoped to `/api/auth`. Two setups work:

1. _Recommended:_ serve the API under the web app's domain — e.g. add a Vercel rewrite `{"source": "/api/:path*", "destination": "https://your-api.example.com/api/:path*"}` to `frontend/vercel.json` — and keep `COOKIE_SAMESITE=lax`. Set `VITE_SOCKET_URL` to the API's own URL (static hosts can't proxy WebSockets; sockets authenticate with the access token, not the cookie).
2. Cross-site API: set `VITE_API_BASE_URL=https://your-api.example.com/api`, `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`. Browsers that block third-party cookies (Safari) will sign users out on reload, so prefer option 1.

**Scaling.** Run several API instances with `REDIS_URL` set and either sticky sessions or WebSocket-only transport. Scene writes are conditional upserts in MongoDB and auto-snapshots claim boards atomically, so instances don't need to coordinate. Rate limits are per instance.

**Calls behind strict networks.** The default ICE configuration only uses public STUN. Provide a TURN server through `VITE_ICE_SERVERS` for users on school or corporate networks.

## Observability

Structured JSON logs (pino) with a request id on every request (`X-Request-Id` is honoured or generated), Prometheus metrics at `/metrics` (HTTP latency by route pattern, socket connections, socket events, scene element outcomes), and optional Sentry on both API and web.

## Upgrading from v1

v1 kept each room's canvas inside the room document and closed rooms 30 seconds after they emptied. v2 stores boards permanently. To bring over v1 drawings:

```bash
npm run migrate:rooms -w @syncboard/backend            # preview
npm run migrate:rooms -w @syncboard/backend -- --apply # migrate
```

Pencil, line and rectangle strokes are converted to Excalidraw elements; v1 eraser strokes and anonymous chat history can't be carried over. Existing users must sign in again once, because sessions moved from localStorage tokens to refresh cookies.

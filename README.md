# SyncBoard — Real-Time Collaborative Whiteboard for Tutoring

[![Node.js Version](https://img.shields.io/badge/Node.js-%3E%3D22.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socket.io&logoColor=white)](https://socket.io/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%2F%209.0-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![Excalidraw](https://img.shields.io/badge/Canvas-Excalidraw-6965DB)](https://excalidraw.com/)
[![Playwright](https://img.shields.io/badge/E2E-Playwright-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev/)
[![Vitest](https://img.shields.io/badge/Tests-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**SyncBoard** is an end-to-end, high-performance collaborative whiteboard platform designed specifically for **online tutoring, remote teaching, and STEM instruction**.

Unlike generic whiteboard products or screen-sharing tools, SyncBoard integrates an **infinite mathematical canvas**, **native peer-to-peer audio and video calling**, **MathJax-powered LaTeX equation insertion**, **structured lesson templates**, **per-user independent undo/redo**, and **granular classroom session controls** into a fast, unified web experience.

---

|             Dashboard & Board Management             |        Infinite Canvas & Lesson Templates        |
| :--------------------------------------------------: | :----------------------------------------------: |
| ![Dashboard Preview](screenshots/dashboard-dark.png) |   ![Board Preview](screenshots/board-dark.png)   |
|     **Secure Authentication & Session Rotation**     |      **Student & Tutor Profile Analytics**       |
|      ![Auth Preview](screenshots/auth-dark.png)      | ![Profile Preview](screenshots/profile-dark.png) |

---

## Table of Contents

- [Core Features](#core-features)
  - [Whiteboard & Canvas Engine](#whiteboard--canvas-engine)
  - [STEM Tutoring Tools](#stem-tutoring-tools)
  - [Realtime Collaboration & Classroom Management](#realtime-collaboration--classroom-management)
  - [Built-In Voice & Video Calls](#built-in-voice--video-calls)
  - [User Accounts & Security](#user-accounts--security)
- [System Architecture](#system-architecture)
  - [High-Level Topology](#high-level-topology)
  - [Monorepo Structure](#monorepo-structure)
  - [Deep Dive: Real-Time Synchronization Engine](#deep-dive-real-time-synchronization-engine)
  - [Deep Dive: WebRTC Voice & Video Mesh](#deep-dive-webrtc-voice--video-mesh)
  - [Deep Dive: Dual-Tier Version History & Background Snapshots](#deep-dive-dual-tier-version-history--background-snapshots)
  - [Deep Dive: Authentication & Token Family Revocation](#deep-dive-authentication--token-family-revocation)
- [Data Model & Database Schema](#data-model--database-schema)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Step-by-Step Installation](#step-by-step-installation)
  - [Zero-Config Local Database](#zero-config-local-database)
  - [Available Scripts](#available-scripts)
- [Configuration Reference](#configuration-reference)
  - [Backend Environment Variables (`backend/.env`)](#backend-environment-variables-backendenv)
  - [Frontend Environment Variables (`frontend/.env`)](#frontend-environment-variables-frontendenv)
- [Access Control & Permissions](#access-control--permissions)
  - [Permission Matrix](#permission-matrix)
  - [Access Levels & Protection](#access-levels--protection)
- [REST API Reference](#rest-api-reference)
  - [Authentication Endpoints (`/api/auth`)](#authentication-endpoints-apiauth)
  - [User Profile Endpoints (`/api/profile`)](#user-profile-endpoints-apiprofile)
  - [Board Management Endpoints (`/api/boards`)](#board-management-endpoints-apiboards)
  - [Invite Link Endpoints (`/api/invites`)](#invite-link-endpoints-apiinvites)
  - [Health & Observability Endpoints](#health--observability-endpoints)
  - [HTTP Rate Limits](#http-rate-limits)
- [Realtime (Socket.IO) Reference](#realtime-socketio-reference)
  - [Client to Server Events](#client-to-server-events)
  - [Server to Client Events](#server-to-client-events)
  - [Socket Rate Limiting Token Buckets](#socket-rate-limiting-token-buckets)
  - [Global Platform Enforced Limits](#global-platform-enforced-limits)
- [Testing & Quality Assurance](#testing--quality-assurance)
- [Production Deployment Playbook](#production-deployment-playbook)
  - [Option A: Modern Cloud Hosting (Vercel + Render / Railway)](#option-a-modern-cloud-hosting-vercel--render--railway)
  - [Option B: Self-Hosted VPS (Nginx + PM2)](#option-b-self-hosted-vps-nginx--pm2)
  - [Production Cookie & Cross-Origin Guidelines](#production-cookie--cross-origin-guidelines)
  - [Multi-Instance Horizontal Scaling](#multi-instance-horizontal-scaling)
  - [TURN Server Setup for Strict Networks](#turn-server-setup-for-strict-networks)
- [Observability & Monitoring](#observability--monitoring)
- [Upgrading & Legacy Data Migration](#upgrading--legacy-data-migration)
- [License](#license)

---

## Core Features

### Whiteboard & Canvas Engine

- **Infinite Canvas powered by Excalidraw 0.18**: Ultra-smooth pan, zoom, freehand pencil drawing, geometric shapes, arrows, connectors, sticky notes, typography, and uploaded images.
- **Per-User Independent Undo/Redo**: Pressing `Ctrl+Z` / `Cmd+Z` rolls back only your own actions. Undoing never destroys or overwrites a student's or co-tutor's concurrent drawing.
- **Graph-Paper Grid & Themes**: Toggle between a plain backdrop and an aligned graph-paper grid on a per-board basis. Full support for dark and light UI themes.
- **Single-Page PDF Handout Export**: One-click vector PDF generation that computes content bounding boxes and resizes the entire lesson's work into a clean, printable single-page A4 handout.
- **Image & Asset Support**: Paste or upload PNG, JPEG, SVG, and WebP graphics up to 5 MB per file. Assets are deduplicated and served with immutable long-term caching.

### STEM Tutoring Tools

- **LaTeX Formula & Equation Generator**: Powered by client-side MathJax. Type any standard LaTeX expression and insert it onto the board as a transparent, high-DPI vector graphic element. Includes quick-select templates:
  - _Quadratic Formula_ (`x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}`)
  - _Pythagorean Theorem_ (`a^2 + b^2 = c^2`)
  - _Derivatives & Integrals_ (`\frac{d}{dx}(x^n) = n x^{n-1}`, `\int_0^1 x^2\,dx = \tfrac{1}{3}`)
  - _Summations & Matrices_ (`\sum_{k=1}^n k = \frac{n(n+1)}{2}`, `\begin{pmatrix} a & b \\ c & d \end{pmatrix}`)
- **Pre-Built Lesson Templates**: Instant structured layouts that center in the user's viewport upon insertion:
  - **Coordinate Plane**: $x/y$ axes from $-10$ to $10$ with subtle gridlines and tick marks.
  - **Number Line**: Centered integer axis spanning $-10$ to $+10$.
  - **Fraction Bars**: Stacked comparison bars representing wholes, halves, thirds, quarters, sixths, and eighths.
  - **Practice Problems**: Four segregated workspaces with dedicated scratchpads and answer lines.
  - **Cornell Notes**: Standard academic format with cue column, notes area, and bottom summary box.
  - **Venn Diagram**: Overlapping labeled sets for visual comparisons.
  - **Lesson Plan**: Objective, warm-up, direct instruction, guided practice, and exit ticket sections.
  - **Homework Tracker**: Agile-style status columns (_To Do_, _Working on it_, _Done_).
- **Follow Mode (Screen Mirroring)**: Click any participant's avatar in the footer to lock your canvas viewport to theirs. When the tutor pans or zooms to explain a diagram, all following students' viewports track smoothly in real time.

### Realtime Collaboration & Classroom Management

- **Live Presence & Cursors**: High-frequency cursor position broadcasting, active tool selection indicators, and viewport tracking rendered with low latency and socket rate limiting.
- **Pinned Comment Threads**: Drop comment pins directly over equations or sketches. Participants can post threaded replies, mark questions as resolved, and toggle resolved pins to keep the board tidy.
- **In-Board Moderation & Chat**: Real-time room chat with markdown support, soft-deletion for authors and tutors, and an owner toggle to mute disruptive users.
- **Exit & Session Lifecycle Control**:
  - **Participants**: Dedicated **Exit** action with confirmation to disconnect from calls and return to their dashboard cleanly.
  - **Tutors / Owners**: Dedicated **End meeting** action with two distinct choices:
    1. _End meeting for all_: Dismisses all participants, terminates ongoing WebRTC calls, closes the session, and redirects everyone to the dashboard.
    2. _Just leave room_: Steps out of the room while keeping the whiteboard accessible for independent student study.
- **Active Public Discovery**: The dashboard's public lobby dynamically queries real-time room counts to display only boards with active participants (`liveCount > 0`), automatically filtering out abandoned, empty, or stale test rooms.

### Built-In Voice & Video Calls

- **WebRTC Peer-to-Peer Mesh**: Zero external software (no Zoom or Google Meet links required). Real-time video and audio communication directly within the whiteboard.
- **Floating Interactive Dock**: Draggable video tiles showing active speaking states, muted indicators, and participant avatars when cameras are off.
- **Hardware Controls**: Toggle camera, microphone, and leave call directly from the board interface. Automatically cleans up peer connections and releases media devices upon room exit.

### User Accounts & Security

- **Dual Authentication Modes**: Email/password registration and Google One-Tap / OAuth sign-in.
- **Strict Session Security**: Short-lived 15-minute JWT access tokens paired with rotating `httpOnly` refresh cookies. Includes automatic session family revocation if a stale or intercepted token is replayed.
- **Account Controls**: Email verification links, password reset workflows, profile stat tracking (boards created/joined, messages sent, collaboration time), and complete account deletion (GDPR-compliant purge of boards and assets).

---

## System Architecture

### High-Level Topology

```mermaid
flowchart TD
    subgraph Clients["Web Browsers (Tutors & Students)"]
        C1["Tutor Client\n(React 19 + Excalidraw)"]
        C2["Student Client A\n(React 19 + Excalidraw)"]
        C3["Student Client B\n(React 19 + Excalidraw)"]
    end

    subgraph RealtimeCall["WebRTC P2P Mesh (Audio / Video)"]
        C1 <-->|Direct Media Stream| C2
        C2 <-->|Direct Media Stream| C3
        C1 <-->|Direct Media Stream| C3
    end

    subgraph BackendCluster["SyncBoard Backend Cluster (Node.js 22 + Express 5)"]
        LB["Load Balancer / Reverse Proxy\n(Nginx / Render / Railway)"]
        API1["API & Socket.IO Worker 1"]
        API2["API & Socket.IO Worker 2"]
    end

    subgraph DataStorage["Data & State Layer"]
        Mongo[("MongoDB Atlas 9.0\n(Users, Boards, Elements, Snapshots)")]
        Redis[("Redis Cloud\n(Socket.IO Adapter & Pub/Sub)")]
    end

    C1 -->|HTTPS / REST API & WSS| LB
    C2 -->|HTTPS / REST API & WSS| LB
    C3 -->|HTTPS / REST API & WSS| LB

    LB --> API1
    LB --> API2

    API1 <--> Redis
    API2 <--> Redis

    API1 --> Mongo
    API2 --> Mongo
```

---

### Monorepo Structure

```
SyncBoard/
├── shared/                 # Universal TypeScript code shared across client & server
│   ├── src/
│   │   ├── constants.ts    # Enforced constraints (LIMITS), board codes, participant colors
│   │   ├── events.ts       # Strictly typed Socket.IO ClientToServer & ServerToClient events
│   │   ├── reconcile.ts    # Deterministic last-writer-wins element merge algorithm
│   │   ├── schemas.ts      # Zod validation schemas for API payloads & socket messages
│   │   └── types.ts        # Shared domain models (BoardSummary, Participant, Role, etc.)
│   └── tsconfig.build.json # Compiles to dist/ for dependency resolution
│
├── backend/                # Express 5 API & Socket.IO realtime server
│   ├── src/
│   │   ├── config/         # Zod-validated environment config, MongoDB & Redis connections
│   │   ├── http/           # Express routes (auth, boards, profile, health) & middleware
│   │   ├── jobs/           # Background snapshot worker (runs every 60s)
│   │   ├── lib/            # Token crypto, Pino logger, Prometheus metrics, mailer
│   │   ├── models/         # Mongoose schemas (Board, BoardElement, Session, User, etc.)
│   │   ├── services/       # Core business logic (auth, board, scene, chat, comments, version)
│   │   ├── socket/         # Socket.IO lifecycle, token-bucket limiters, event handlers
│   │   ├── app.ts          # Express application factory & security middleware
│   │   └── server.ts       # Process bootstrap (HTTP + Socket.IO + background workers)
│   ├── scripts/            # Database migration utilities & dev in-memory database
│   └── test/               # Vitest integration test suite (runs against in-memory Mongo)
│
├── frontend/               # React 19 single-page application (Vite)
│   ├── src/
│   │   ├── board/          # Whiteboard canvas, sync engines, WebRTC dock, tools, dialogs
│   │   │   ├── call/       # WebRTC peer mesh hook (useCall) & floating video dock
│   │   │   ├── chat/       # Live room chat panel with moderation & soft-delete
│   │   │   ├── comments/   # Canvas pinned comment overlay & threaded replies
│   │   │   ├── equation/   # MathJax LaTeX preview dialog & SVG asset injector
│   │   │   ├── export/     # jsPDF single-page A4 handout renderer & thumbnail capture
│   │   │   ├── share/      # Member management, role adjustment, and invite generator
│   │   │   ├── sync/       # SceneSync (unbuffered scene stream) & PresenceSync (cursors)
│   │   │   └── templates/  # Geometric generator functions for 8 STEM lesson templates
│   │   ├── components/     # Reusable UI primitives (Modal, Avatar, Spinner, AppHeader)
│   │   ├── context/        # React contexts (AuthContext, SocketContext, ThemeContext)
│   │   ├── lib/            # REST API client, Socket client, utility helpers
│   │   ├── pages/          # Top-level view routes (Dashboard, BoardPage, AuthPage, Profile)
│   │   └── styles/         # Glassmorphism design tokens and modular CSS
│   └── vercel.json         # SPA route rewrites and asset cache-control rules
│
├── e2e/                    # Playwright end-to-end multi-browser test suite
│   ├── tests/              # Scenarios: collaboration, WebRTC calling, templates, equations
│   └── playwright.config.ts# Multi-worker test configuration
│
├── screenshots/            # UI screenshots referenced by documentation
└── .github/workflows/      # Automated CI pipeline (lint, format, typecheck, tests, e2e)
```

---

### Deep Dive: Real-Time Synchronization Engine

SyncBoard avoids transmitting monolithic JSON canvas blobs. Storing or streaming the whole scene on every stroke causes bandwidth spikes, race conditions, and merge conflicts.

```mermaid
sequenceDiagram
    autonumber
    actor Tutor as Tutor (Client A)
    participant Socket as SyncBoard Realtime Server
    participant Mongo as MongoDB Atlas
    actor Student as Student (Client B)

    Note over Tutor,Student: Both clients in board TP324P3G
    Tutor->>Tutor: Draws stroke (increments element.version, sets versionNonce)
    Tutor->>Socket: emit('scene:update', { elements: [elA] })

    activate Socket
    Socket->>Socket: Rate limiter check (Token Bucket: scene)
    Socket->>Socket: Verify role is editor or owner
    Socket->>Mongo: Version-conditional upsert (boardId, elementId)
    Mongo-->>Socket: Accepted elements (newer) & Current state (if stale)
    Socket->>Socket: Touch board activity timestamp
    Socket-->>Tutor: Ack { accepted: 1, rejected: 0 }
    Socket->>Student: Broadcast emit('scene:update', { elements: [elA] })
    deactivate Socket

    Student->>Student: Excalidraw.reconcileElements() merges updates without clearing local undo stack
```

#### Deterministic Last-Writer-Wins (LWW) Merge Rule

Every canvas element contains an integer `version` (incremented on each edit) and an integer `versionNonce` (randomly chosen per client edit). When an update is processed:

1. If `incoming.version > current.version`: **Incoming edit wins**.
2. If `incoming.version === current.version`: The tie-breaker is the **lower `versionNonce`**.
3. If `incoming.version < current.version`: **Incoming edit is rejected**. The server responds by sending back the current winning database copy, forcing the stale client to converge.

Because this exact comparison logic is implemented identically in [`shared/src/reconcile.ts`](shared/src/reconcile.ts) and Excalidraw's internal `reconcileElements`, all clients and the server converge on the exact same canvas state regardless of network latency or arrival order.

#### Offline Tolerance & Reconnect Buffering

If a student's network connection drops:

- Local drawings are buffered in memory and continue rendering seamlessly on the local canvas.
- When the socket reconnects, the client emits `board:join`, pulls the latest server snapshot, runs a reconciliation pass, and immediately pushes all buffered offline modifications.

---

### Deep Dive: WebRTC Voice & Video Mesh

For small-group tutoring sessions (1 tutor + 1–5 students), a peer-to-peer mesh provides the lowest possible latency and costs zero media server overhead.

```mermaid
sequenceDiagram
    autonumber
    actor PeerA as Tutor (Peer A)
    participant Server as Socket.IO Signalling Relay
    actor PeerB as Student (Peer B)

    PeerA->>Server: emit('rtc:join', { audio: true, video: true })
    Server-->>PeerA: Ack { peers: [] }

    PeerB->>Server: emit('rtc:join', { audio: true, video: true })
    Server-->>PeerB: Ack { peers: [PeerA_SocketId] }
    Server->>PeerA: emit('rtc:peer-joined', { socketId: PeerB_SocketId, media })

    Note over PeerA,PeerB: WebRTC Signalling Exchange
    PeerA->>PeerA: Create RTCPeerConnection & generate SDP Offer
    PeerA->>Server: emit('rtc:signal', { to: PeerB, data: { description: Offer } })
    Server->>PeerB: emit('rtc:signal', { from: PeerA, data: { description: Offer } })

    PeerB->>PeerB: Set Remote Description & generate SDP Answer
    PeerB->>Server: emit('rtc:signal', { to: PeerA, data: { description: Answer } })
    Server->>PeerA: emit('rtc:signal', { from: PeerB, data: { description: Answer } })

    PeerA->>Server: emit('rtc:signal', { to: PeerB, data: { candidate: ICE } })
    Server->>PeerB: emit('rtc:signal', { from: PeerA, data: { candidate: ICE } })

    Note over PeerA,PeerB: Direct P2P Media Streams Established (SRTP)
```

- **Collision Resolution (Perfect Negotiation)**: When two clients initiate offers simultaneously, roles are resolved deterministically by comparing socket IDs (`socket.id > peerSocketId`). The polite peer yields to avoid glare.
- **Relay Only**: The backend server inspects zero audio/video bytes; it merely validates room membership and relays signals between participants in the same board room.

---

### Deep Dive: Dual-Tier Version History & Background Snapshots

To prevent whiteboards from becoming corrupted or lost during multi-hour lectures, SyncBoard implements a dual-tier versioning pipeline:

```
                      Active Stroke & Shape Edits
                                  │
                                  ▼
                   MongoDB [boardelements] Collection
                                  │
                                  ▼ (Every 60 Seconds)
          ┌────────────────────────────────────────────────┐
          │     Background Worker: Snapshot Daemon         │
          │  - Find boards where lastEditedAt > snapshot   │
          │  - Atomic lock claim via findOneAndUpdate()    │
          │  - Fetch elements & gzip compress scene JSON   │
          │  - Insert into [boardversions] (kind: auto)    │
          │  - Prune automatic history to SNAPSHOT_KEEP    │
          └────────────────────────────────────────────────┘
                                  │
                     Manual / Restorative Actions
                                  │
          ┌───────────────────────┴────────────────────────┐
          ▼                                                ▼
Manual Bookmark (`kind: manual`)           Version Restore (`kind: pre-restore`)
User creates a named snapshot;             Takes a safety snapshot before
never pruned by background job.            restoring, enabling rollbacks of restores.
```

1. **Automatic Snapshots (`kind: auto`)**: A background interval runs every 60 seconds on every server instance. It checks for boards that have sustained element edits since their `lastSnapshotAt` timestamp and are past the `SNAPSHOT_INTERVAL_MINUTES` cooldown (default: 10 minutes).
2. **Atomic Worker Locking**: When running multiple horizontally scaled server instances, each worker attempts an atomic `findOneAndUpdate` with an update condition on `lastSnapshotAt`. Only one instance successfully claims and compresses the snapshot.
3. **Manual Bookmarks (`kind: manual`)**: Tutors can capture named snapshots at any point (e.g., "End of Calculus Module 2"). Named versions are permanently preserved and exempt from pruning.
4. **Pre-Restore Rollback Safety (`kind: pre-restore`)**: Restoring an older version creates an automatic snapshot of the active canvas _immediately before_ overwriting it. A tutor can never accidentally lose live work by clicking restore.

---

### Deep Dive: Authentication & Token Family Revocation

SyncBoard implements a production-grade token rotation architecture:

```mermaid
sequenceDiagram
    autonumber
    actor Client as Browser Client
    participant API as Express Auth Router
    participant DB as MongoDB [sessions]

    Note over Client,API: User registers or signs in
    API->>DB: Store hashed refreshToken with new familyId
    API-->>Client: Returns accessToken (JSON, 15m) + refreshToken (httpOnly Cookie, 30d)

    Note over Client,API: Access token expires after 15 minutes
    Client->>API: POST /api/auth/refresh (includes Cookie & X-Requested-With)
    API->>DB: Find session matching hash(refreshToken)

    alt Valid Token Found
        API->>DB: Invalidate old token, insert new hashed token (same familyId)
        API-->>Client: New accessToken (JSON) + New refreshToken (httpOnly Cookie)
    else Reused / Stale Token (Breach Attempt Detected)
        API->>DB: Revoke ALL sessions sharing that familyId
        API-->>Client: 401 Unauthorized (Session Expired, Force Sign-Out Everywhere)
    end
```

- **Short-Lived Access Tokens**: Signed with HMAC-SHA256 containing the user ID, expiring in 15 minutes. Sent via standard `Authorization: Bearer <token>` headers.
- **Rotating Refresh Cookies**: Stored in a cryptographically random, 48-byte token inside an `httpOnly`, `SameSite=Lax` cookie scoped strictly to `/api/auth`. Rotated on every single `/refresh` call.
- **CSRF Defense**: All cookie-authenticated endpoints (`/api/auth/refresh`, `/api/auth/logout`) mandate a custom `X-Requested-With: syncboard` header. Cross-origin browser requests cannot attach custom headers without a successful CORS preflight check.

---

## Data Model & Database Schema

All domain entities are stored in MongoDB using Mongoose schemas. Individual elements are stored as discrete documents to maximize performance.

| Collection           | Model File                                                | Purpose & Indexes                                                                                                                                                                                                                                                                                                                                                                  |
| :------------------- | :-------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`users`**          | [`User.ts`](backend/src/models/User.ts)                   | User accounts, display names, avatar URLs, password hashes (bcrypt), Google IDs, email verification status, and lifetime tutoring stats. Unique index on `email`, sparse index on `googleId`.                                                                                                                                                                                      |
| **`sessions`**       | [`Session.ts`](backend/src/models/Session.ts)             | Active refresh token sessions. Stores SHA-256 token hash, `familyId`, expiration date, and user agent metadata. TTL index on `expiresAt` automatically purges expired sessions.                                                                                                                                                                                                    |
| **`authtokens`**     | [`AuthToken.ts`](backend/src/models/AuthToken.ts)         | One-time tokens for email verification and password resets. Stores token hash, associated user ID, and action type (`verify` / `reset`). TTL index automatically purges unused tokens.                                                                                                                                                                                             |
| **`boards`**         | [`Board.ts`](backend/src/models/Board.ts)                 | Whiteboard room metadata: human-readable 8-char `_id`, board name, `ownerId`, `generalAccess` (`restricted` / `viewer` / `editor`), password hash, background style (`plain` / `grid`), `listed` visibility, thumbnail data URL, members array, and expiring invite tokens. Indexes on `ownerId`, `listed + lastActivityAt`, `invites.token`, and `lastEditedAt + lastSnapshotAt`. |
| **`boardelements`**  | [`BoardElement.ts`](backend/src/models/BoardElement.ts)   | Individual Excalidraw canvas elements. Stores `boardId`, `elementId`, numeric `version`, `versionNonce`, and raw JSON data. **Compound unique index on `(boardId, elementId)`**.                                                                                                                                                                                                   |
| **`boardfiles`**     | [`BoardFile.ts`](backend/src/models/BoardFile.ts)         | Decoded binary image buffers uploaded to boards. Stores MIME type, byte size, and raw buffer. Unique index on `(boardId, fileId)`.                                                                                                                                                                                                                                                 |
| **`boardversions`**  | [`BoardVersion.ts`](backend/src/models/BoardVersion.ts)   | Gzip-compressed canvas snapshots (`kind: auto`, `manual`, or `pre-restore`). Stores snapshot label, creator ID, element count, and thumbnail preview. Index on `(boardId, createdAt)`.                                                                                                                                                                                             |
| **`chatmessages`**   | [`ChatMessage.ts`](backend/src/models/ChatMessage.ts)     | In-board chat history. Stores author ID, text content, soft-deletion timestamp (`deletedAt`), and creation time. Index on `(boardId, createdAt)`.                                                                                                                                                                                                                                  |
| **`commentthreads`** | [`CommentThread.ts`](backend/src/models/CommentThread.ts) | Pinned canvas comment threads. Stores canvas coordinates `(x, y)`, author ID, resolved boolean status, and nested array of reply messages. Index on `(boardId, createdAt)`.                                                                                                                                                                                                        |

---

## Getting Started

### Prerequisites

- **Node.js**: Version `22.0.0` or higher.
- **npm**: Version `10.0.0` or higher (supports npm workspaces).
- **MongoDB**: A running local MongoDB instance (v6+), a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster, or use the built-in in-memory development database.

---

### Step-by-Step Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/SyncBoard.git
cd SyncBoard

# 2. Install dependencies across all workspaces (automatically compiles shared/)
npm install

# 3. Initialize environment configuration files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

---

### Zero-Config Local Database

If you do not have MongoDB installed locally, SyncBoard includes a standalone script that boots a persistent, local development database using `mongodb-memory-server`:

```bash
# In a separate terminal, start the local dev database (persists to backend/.dev-db):
npm run dev:memory-db -w @syncboard/backend
```

---

### Running in Development

Start both the backend API server and the Vite frontend development server concurrently:

```bash
npm run dev
```

- **Frontend Client**: Runs on `http://localhost:5173`
- **Backend API & WebSockets**: Runs on `http://localhost:5000`

> [!NOTE]
> In local development, the Vite server automatically proxies `/api` and `/socket.io` requests to `http://localhost:5000`. Authentication cookies operate as same-origin requests seamlessly.

---

### Available Scripts

Run all scripts from the repository root:

| Command                                       | Workspace | Description                                                                          |
| :-------------------------------------------- | :-------- | :----------------------------------------------------------------------------------- |
| `npm run dev`                                 | Root      | Concurrently runs backend and frontend with live hot-reloading.                      |
| `npm run build`                               | Root      | Compiles `shared/`, then builds production artifacts for `backend/` and `frontend/`. |
| `npm test`                                    | Root      | Runs all unit and integration tests across all packages using Vitest.                |
| `npm run test:e2e`                            | Root      | Executes the Playwright end-to-end browser suite (headless Chromium).                |
| `npm run typecheck`                           | Root      | Runs `tsc --noEmit` across `shared`, `backend`, `frontend`, and `e2e`.               |
| `npm run lint`                                | Root      | Executes ESLint 9 across all TypeScript and React files.                             |
| `npm run format:check`                        | Root      | Verifies that all files conform to Prettier code style without writing changes.      |
| `npm run format`                              | Root      | Formats all source files across the monorepo using Prettier.                         |
| `npm start -w @syncboard/backend`             | Backend   | Runs the compiled backend server from `dist/server.js`.                              |
| `npm run migrate:rooms -w @syncboard/backend` | Backend   | Dry-run migration of legacy SyncBoard v1 room data into v2 board elements.           |

---

## Configuration Reference

### Backend Environment Variables (`backend/.env`)

The backend validates all variables with Zod on startup ([`backend/src/config/env.ts`](backend/src/config/env.ts)). If required settings are missing or invalid, the process terminates with descriptive error diagnostics.

| Variable                    |     Type     |                Default                 | Description                                                                                                                                                                   |
| :-------------------------- | :----------: | :------------------------------------: | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                  |    String    |             `development`              | Environment mode (`development`, `test`, or `production`).                                                                                                                    |
| `PORT`                      |    Number    |                 `5000`                 | Port the Express and Socket.IO server binds to.                                                                                                                               |
| `LOG_LEVEL`                 |    String    |     `debug` (dev) / `info` (prod)      | Pino log output level (`trace`, `debug`, `info`, `warn`, `error`, `silent`).                                                                                                  |
| `CORS_ORIGIN`               |    String    |        `http://localhost:5173`         | Comma-delimited list of permitted web origins for CORS headers.                                                                                                               |
| `APP_URL`                   |    String    |          First `CORS_ORIGIN`           | Canonical public URL of the web client (used to format verification & reset email links).                                                                                     |
| `TRUST_PROXY`               | String / Num |                 `off`                  | Express `trust proxy` setting. Set to `1` behind a reverse proxy (Render, Railway, Nginx) so client IP rate limiters function accurately.                                     |
| `MONGODB_URI`               |    String    | `mongodb://127.0.0.1:27017/syncboard`  | MongoDB connection URI.                                                                                                                                                       |
| `REDIS_URL`                 |    String    |                _Unset_                 | Redis connection URL. When supplied, enables the `@socket.io/redis-adapter` for multi-node horizontal scaling.                                                                |
| `JWT_ACCESS_SECRET`         |    String    |             _Dev fallback_             | **Required in production**. Cryptographic secret used to sign access tokens (minimum 32 characters; server refuses to start with default secret in production).               |
| `ACCESS_TOKEN_TTL_SECONDS`  |    Number    |                 `900`                  | Lifetime of access tokens in seconds (minimum `60`, default `15 minutes`).                                                                                                    |
| `REFRESH_TOKEN_TTL_DAYS`    |    Number    |                  `30`                  | Lifetime of rotating refresh token sessions in days (default `30 days`).                                                                                                      |
| `COOKIE_SAMESITE`           |    String    |                 `lax`                  | Refresh token cookie `SameSite` policy (`lax`, `strict`, or `none`). Note: `none` mandates `COOKIE_SECURE=true`.                                                              |
| `COOKIE_SECURE`             |   Boolean    |             `true` in prod             | Mandates the `Secure` flag on refresh cookies.                                                                                                                                |
| `COOKIE_DOMAIN`             |    String    |                _Unset_                 | Explicit domain scope for cookies (useful for shared parent domains like `.example.com`).                                                                                     |
| `GOOGLE_CLIENT_ID`          |    String    |                _Unset_                 | Google OAuth Client ID used to verify Google One-Tap ID tokens.                                                                                                               |
| `SMTP_URL`                  |    String    |                _Unset_                 | Nodemailer transport URI (e.g. `smtps://user:pass@smtp.mailgun.org:465`). When omitted, verification and password reset links are printed directly to the server console log. |
| `MAIL_FROM`                 |    String    | `SyncBoard <no-reply@syncboard.local>` | Default `From` header value on automated notification emails.                                                                                                                 |
| `SENTRY_DSN`                |    String    |                _Unset_                 | Sentry Data Source Name for backend error monitoring.                                                                                                                         |
| `SENTRY_TRACES_SAMPLE_RATE` |    Number    |                  `0`                   | Sentry performance transaction sample rate (`0.0` to `1.0`).                                                                                                                  |
| `METRICS_TOKEN`             |    String    |                _Unset_                 | Secret Bearer token required to scrape `/metrics`. In production, `/metrics` responds with `404` if this token is unset.                                                      |
| `SOCKET_PING_TIMEOUT`       |    Number    |                `20000`                 | Socket.IO ping timeout in milliseconds.                                                                                                                                       |
| `SOCKET_PING_INTERVAL`      |    Number    |                `25000`                 | Socket.IO ping interval in milliseconds.                                                                                                                                      |
| `SNAPSHOT_INTERVAL_MINUTES` |    Number    |                  `10`                  | Minimum elapsed time before an edited board is snapshotted by the background worker.                                                                                          |
| `SNAPSHOT_KEEP_AUTO`        |    Number    |                  `30`                  | Maximum number of automatic snapshot versions retained per board.                                                                                                             |

---

### Frontend Environment Variables (`frontend/.env`)

All client environment variables are exposed through Vite's `import.meta.env` and sanitized in [`frontend/src/lib/env.ts`](frontend/src/lib/env.ts).

| Variable                |     Default      | Description                                                                                                                                                                 |
| :---------------------- | :--------------: | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL`     |      `/api`      | Root endpoint for REST API calls. In production deployments where the API is hosted on a separate domain, set this to the full URL (e.g., `https://api.syncboard.com/api`). |
| `VITE_SOCKET_URL`       | _Current origin_ | Target host for Socket.IO connections. When the backend is hosted on a different domain, set this to the backend's root URL (e.g., `https://api.syncboard.com`).            |
| `VITE_APP_NAME`         |   `SyncBoard`    | User-facing application name rendered in page titles and navigation headers.                                                                                                |
| `VITE_GOOGLE_CLIENT_ID` |     _Unset_      | Google OAuth Client ID for the Google One-Tap button (must match the backend ID).                                                                                           |
| `VITE_ICE_SERVERS`      |   Google STUN    | JSON array of `RTCIceServer` configurations. Configure a TURN server here to support users on restricted school or corporate firewalls.                                     |
| `VITE_SENTRY_DSN`       |     _Unset_      | Sentry DSN for frontend exception monitoring and breadcrumb logging.                                                                                                        |

---

## Access Control & Permissions

Every board is assigned an 8-character code (e.g., `GD9GH3PE`). A user's effective permission role is resolved hierarchically:

1. **Board Owner**: The user who created the board.
2. **Explicit Member**: Users added with an explicit role (`editor` or `viewer`).
3. **General Access Setting**: The fallback role granted to any authenticated visitor holding the board link or code (`restricted`, `viewer`, or `editor`).

### Permission Matrix

| Capability                                                            | Viewer | Editor | Owner |
| :-------------------------------------------------------------------- | :----: | :----: | :---: |
| Open board canvas, view live drawings & follow cursors                |   ✓    |   ✓    |   ✓   |
| Send in-room chat messages & delete own messages                      |   ✓    |   ✓    |   ✓   |
| Place comment pins, post replies & resolve threads                    |   ✓    |   ✓    |   ✓   |
| Join built-in WebRTC audio and video calls                            |   ✓    |   ✓    |   ✓   |
| Exit the room (clean departure)                                       |   ✓    |   ✓    |   ✓   |
| Draw on canvas, manipulate shapes, add text & erase                   |        |   ✓    |   ✓   |
| Insert LaTeX formulas (MathJax) & lesson templates                    |        |   ✓    |   ✓   |
| Upload images & assets to canvas                                      |        |   ✓    |   ✓   |
| Capture named version snapshots & restore versions                    |        |   ✓    |   ✓   |
| Update board thumbnail preview                                        |        |   ✓    |   ✓   |
| Rename board, change background (plain/grid), toggle public listing   |        |        |   ✓   |
| Modify general access levels & configure board password               |        |        |   ✓   |
| Create and revoke expiring invite links                               |        |        |   ✓   |
| Add, adjust, or remove board members                                  |        |        |   ✓   |
| Mute disruptive participants in chat                                  |        |        |   ✓   |
| Delete any participant's chat messages or comment threads             |        |        |   ✓   |
| **End meeting for everyone** (dismiss all students & terminate calls) |        |        |   ✓   |
| Delete board permanently and purge elements                           |        |        |   ✓   |

### Access Levels & Protection

- **`restricted`**: Only the owner and explicitly invited members can access the board.
- **`viewer`**: Anyone with the link or code can enter in read-only mode.
- **`editor`**: Anyone with the link or code can join and collaborate on the canvas.
- **Board Password Protection**: Tutors can apply an optional password to any public or link-shared board. Visitors must submit the password once (verified via bcrypt) before they are admitted into the room.
- **Expiring Invite Links**: Owners can generate time-limited invite tokens (e.g., valid for 7 days) that grant either editor or viewer status upon acceptance.

---

## REST API Reference

All REST endpoints are rooted at `/api`. Payloads are strictly validated with Zod. Authenticated endpoints require the standard header:

```http
Authorization: Bearer <accessToken>
```

### Standard Error Response Format

When an error occurs, the server responds with a consistent JSON envelope:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have access to this board",
    "details": null
  }
}
```

Stable error codes include: `BAD_REQUEST`, `VALIDATION`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `PASSWORD_REQUIRED`, `INVALID_PASSWORD`, `NOT_JOINED`, `MUTED`, `LIMIT_EXCEEDED`, `EMAIL_NOT_VERIFIED`, and `INTERNAL`.

---

### Authentication Endpoints (`/api/auth`)

| Method & Route              | Auth Required | Request Body / Parameters                        | Description                                                                                            |
| :-------------------------- | :-----------: | :----------------------------------------------- | :----------------------------------------------------------------------------------------------------- |
| `POST /register`            |      No       | `{ email, password, displayName }`               | Creates an account, sets an `httpOnly` refresh cookie, and returns `{ accessToken, expiresIn, user }`. |
| `POST /login`               |      No       | `{ email, password }`                            | Authenticates with credentials, sets the refresh cookie, and returns tokens.                           |
| `POST /google`              |      No       | `{ credential }`                                 | Verifies a Google ID token, links or creates an account, sets the refresh cookie, and returns tokens.  |
| `POST /refresh`             |    Cookie     | _Header required:_ `X-Requested-With: syncboard` | Rotates the refresh token cookie and issues a new access token.                                        |
| `POST /logout`              |    Cookie     | _Header required:_ `X-Requested-With: syncboard` | Revokes the current session family and clears the refresh cookie.                                      |
| `POST /logout-all`          |    Bearer     | _None_                                           | Revokes all active session families across all devices for the authenticated user.                     |
| `GET /me`                   |    Bearer     | _None_                                           | Returns the currently authenticated user's profile object.                                             |
| `POST /verify-email`        |      No       | `{ token }`                                      | Validates a one-time verification token sent via email and marks the account verified.                 |
| `POST /resend-verification` |    Bearer     | _None_                                           | Dispatches a new email verification link to the user's registered address.                             |
| `POST /forgot-password`     |      No       | `{ email }`                                      | Dispatches a password reset link containing a secure one-time token.                                   |
| `POST /reset-password`      |      No       | `{ token, password }`                            | Consumes the reset token and updates the user's password hash.                                         |
| `POST /change-password`     |    Bearer     | `{ currentPassword, newPassword }`               | Updates the password for an authenticated session.                                                     |

---

### User Profile Endpoints (`/api/profile`)

| Method & Route | Auth Required | Request Body      | Description                                                                                                                      |
| :------------- | :-----------: | :---------------- | :------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`        |    Bearer     | _None_            | Returns the user's profile and lifetime stats: boards created, boards joined, messages sent, and minutes spent collaborating.    |
| `PATCH /`      |    Bearer     | `{ displayName }` | Updates the user's display name.                                                                                                 |
| `DELETE /`     |    Bearer     | _None_            | Permanently deletes the user account, removes all owned boards, deletes canvas elements and assets, and revokes active sessions. |

---

### Board Management Endpoints (`/api/boards`)

| Method & Route                          |  Min. Role   | Request Body / Parameters                                    | Description                                                                                                                                         |
| :-------------------------------------- | :----------: | :----------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /`                                 |    Bearer    | _None_                                                       | Returns `{ owned, shared, public }` board lists. The `public` list automatically filters to only boards with active participants (`liveCount > 0`). |
| `POST /`                                |    Bearer    | `{ name, generalAccess?, background?, listed? }`             | Creates a new board identified by an 8-character ID.                                                                                                |
| `GET /:id`                              |    Viewer    | _None_                                                       | Returns full board details, member rosters, and active invites. Responds with `403 PASSWORD_REQUIRED` if password-gated.                            |
| `POST /:id/unlock`                      |    Public    | `{ password }`                                               | Validates a board password against the bcrypt hash and unlocks access for the user.                                                                 |
| `PATCH /:id`                            |    Owner     | `{ name?, generalAccess?, password?, background?, listed? }` | Modifies room configuration settings.                                                                                                               |
| `DELETE /:id`                           |    Owner     | _None_                                                       | Deletes the board, purging all elements, files, chat messages, comments, and versions.                                                              |
| `PUT /:id/thumbnail`                    |    Editor    | `{ dataURL }`                                                | Saves a base64 thumbnail preview for display on dashboard cards (max 300 KB).                                                                       |
| `PATCH /:id/members/:userId`            |    Owner     | `{ role }`                                                   | Promotes or demotes an existing board member (`editor` or `viewer`).                                                                                |
| `DELETE /:id/members/:userId`           | Owner / Self | _None_                                                       | Removes a member from the board roster, or allows a member to leave.                                                                                |
| `POST /:id/invites`                     |    Owner     | `{ role, expiresInDays? }`                                   | Generates a shareable invite link token.                                                                                                            |
| `DELETE /:id/invites/:token`            |    Owner     | _None_                                                       | Revokes an existing invite token immediately.                                                                                                       |
| `POST /:id/files`                       |    Editor    | Multipart or JSON binary data                                | Uploads an image asset to the board (max 5 MB). Deduplicated by file ID.                                                                            |
| `GET /:id/files/:fileId`                |    Viewer    | _None_                                                       | Retrieves an image asset buffer with immutable HTTP caching headers.                                                                                |
| `GET /:id/versions`                     |    Viewer    | _None_                                                       | Lists all captured version history snapshots for the board.                                                                                         |
| `POST /:id/versions`                    |    Editor    | `{ label?, thumbnail? }`                                     | Creates a manual named bookmark snapshot of the active canvas.                                                                                      |
| `GET /:id/versions/:versionId`          |    Viewer    | _None_                                                       | Fetches a decompressed version snapshot containing its full element array.                                                                          |
| `POST /:id/versions/:versionId/restore` |    Editor    | _None_                                                       | Restores the board to the specified snapshot (automatically takes a `pre-restore` safety snapshot first).                                           |

---

### Invite Link Endpoints (`/api/invites`)

| Method & Route        | Auth Required | Description                                                                      |
| :-------------------- | :-----------: | :------------------------------------------------------------------------------- |
| `GET /:token`         |    Bearer     | Previews an invite link: returns board name, target role, and owner information. |
| `POST /:token/accept` |    Bearer     | Accepts the invite token and adds the user to the board's member roster.         |

---

### Health & Observability Endpoints

| Method & Route          |      Auth Required      | Description                                                                                                      |
| :---------------------- | :---------------------: | :--------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`       |         Public          | **Liveness Probe**: Confirms the process is running and reports uptime and timestamps.                           |
| `GET /api/health/ready` |         Public          | **Readiness Probe**: Validates active connectivity to MongoDB Atlas and Redis (if configured).                   |
| `GET /metrics`          | Bearer `$METRICS_TOKEN` | Scrapes Prometheus operational metrics (HTTP latency histograms, active socket counts, element rejection rates). |

---

### HTTP Rate Limits

Rate limits are enforced in-memory per server process using `express-rate-limit`:

| Limit Bucket       |   Window   | Max Requests | Scope                                                  |
| :----------------- | :--------: | :----------: | :----------------------------------------------------- |
| **API General**    |  1 minute  | 300 requests | All routes under `/api`                                |
| **Authentication** | 15 minutes | 30 requests  | Login, registration, password changes, unlock attempts |
| **Email Dispatch** |   1 hour   | 10 requests  | Password reset and email verification dispatches       |
| **Asset Uploads**  |  1 minute  | 60 requests  | Image attachments and thumbnail uploads                |

---

## Realtime (Socket.IO) Reference

Clients establish a WebSocket connection to path `/socket.io` authenticated via query/auth tokens:

```typescript
const socket = io(SOCKET_URL, {
  auth: { token: accessToken },
  transports: ['websocket', 'polling'],
});
```

All event payloads are strictly validated using Zod schemas on both client and server ([`shared/src/events.ts`](shared/src/events.ts)).

### Client to Server Events

| Event               | Required Role  | Payload                                                 | Ack Response                  | Description                                                                              |
| :------------------ | :------------: | :------------------------------------------------------ | :---------------------------- | :--------------------------------------------------------------------------------------- |
| `board:join`        |    General     | `{ boardId: string, password?: string }`                | `Ack<JoinedBoard>`            | Joins the board room. Returns initial elements, files, chat, comments, and participants. |
| `board:leave`       |      None      | _None_                                                  | `Ack<null>`                   | Leaves the room cleanly and updates participant rosters.                                 |
| `board:end-meeting` |   **Owner**    | _None_                                                  | `Ack<null>`                   | Terminates the session for everyone, ends calls, and broadcasts `board:meeting-ended`.   |
| `scene:update`      |   **Editor**   | `{ elements: SceneElement[] }`                          | `Ack<{ accepted, rejected }>` | Sends changed canvas elements (max 500 per batch).                                       |
| `presence:update`   |     Viewer     | `{ pointer?, button?, selectedElementIds?, viewport? }` | None                          | Streams cursor positions and viewport bounds (used by Follow Mode).                      |
| `chat:send`         |     Viewer     | `{ text: string }`                                      | `Ack<ChatMessage>`            | Sends a room chat message (max 2,000 characters).                                        |
| `chat:history`      |     Viewer     | `{ before?: string }`                                   | `Ack<{ messages, hasMore }>`  | Paginates backward through chat history (50 messages per page).                          |
| `chat:delete`       | Author / Owner | `{ messageId: string }`                                 | `Ack<null>`                   | Soft-deletes a chat message.                                                             |
| `chat:mute`         |   **Owner**    | `{ userId: string, muted: boolean }`                    | `Ack<null>`                   | Mutes or unmutes a user from sending chat messages.                                      |
| `comment:create`    |     Viewer     | `{ x: number, y: number, text: string }`                | `Ack<CommentThread>`          | Drops a new pinned comment thread on the canvas.                                         |
| `comment:reply`     |     Viewer     | `{ threadId: string, text: string }`                    | `Ack<CommentThread>`          | Appends a reply to an existing comment thread.                                           |
| `comment:resolve`   |     Viewer     | `{ threadId: string, resolved: boolean }`               | `Ack<CommentThread>`          | Toggles the resolved status of a comment thread.                                         |
| `comment:delete`    | Author / Owner | `{ threadId: string }`                                  | `Ack<null>`                   | Deletes an entire comment thread.                                                        |
| `rtc:join`          |     Viewer     | `{ audio: boolean, video: boolean }`                    | `Ack<{ peers: string[] }>`    | Joins the in-board audio/video mesh. Returns active peer socket IDs.                     |
| `rtc:leave`         |      None      | _None_                                                  | None                          | Leaves the audio/video call.                                                             |
| `rtc:media`         |     Viewer     | `{ audio: boolean, video: boolean }`                    | None                          | Broadcasts hardware microphone/camera mute status changes.                               |
| `rtc:signal`        |     Viewer     | `{ to: string, data: RtcSignalData }`                   | None                          | Relays WebRTC SDP offers, answers, and ICE candidate packets to a peer.                  |

---

### Server to Client Events

| Event                 | Payload                                                      | Description                                                                                        |
| :-------------------- | :----------------------------------------------------------- | :------------------------------------------------------------------------------------------------- |
| `scene:update`        | `{ elements: SceneElement[] }`                               | Broadcasts winning canvas element deltas to all collaborators.                                     |
| `files:added`         | `{ fileIds: string[] }`                                      | Notifies clients that new image attachments are available to load.                                 |
| `presence:update`     | `PresenceUpdate`                                             | Streams remote cursor coordinates, selections, and follow viewports.                               |
| `participants`        | `Participant[]`                                              | Pushes the updated array of active users currently in the room.                                    |
| `board:updated`       | `BoardSummary`                                               | Pushes updated board metadata (e.g. renamed, background toggled).                                  |
| `board:role-changed`  | `{ role: Role }`                                             | Notifies a client when their individual permission role changes.                                   |
| `board:removed`       | `{ reason: 'deleted' \| 'access-revoked' }`                  | Fired when a board is deleted or a user's access is revoked.                                       |
| `board:meeting-ended` | `{ boardId: string }`                                        | Dispatched when the owner ends the meeting; transitions all clients to the "Meeting ended" screen. |
| `board:muted`         | `{ mutedUserIds: string[] }`                                 | Broadcasts updated mute lists to all room participants.                                            |
| `versions:updated`    | _None_                                                       | Signals that a new snapshot version has been created or restored.                                  |
| `chat:message`        | `ChatMessage`                                                | Delivers an incoming chat message.                                                                 |
| `chat:deleted`        | `{ messageId: string }`                                      | Notifies clients that a chat message was soft-deleted.                                             |
| `comments:upsert`     | `CommentThread`                                              | Dispatches created, replied, or resolved comment threads.                                          |
| `comments:remove`     | `{ threadId: string }`                                       | Signals that a comment pin was deleted.                                                            |
| `rtc:peer-joined`     | `{ socketId: string, media: RtcMediaState }`                 | Informs peers that a new participant joined the call.                                              |
| `rtc:peer-left`       | `{ socketId: string }`                                       | Informs peers that a participant disconnected from the call.                                       |
| `rtc:media`           | `{ socketId: string, media: RtcMediaState }`                 | Updates remote peer audio/video mute indicators.                                                   |
| `rtc:signal`          | `{ from: string, data: RtcSignalData }`                      | Delivers relayed WebRTC signalling data from a remote peer.                                        |
| `notice`              | `{ level: 'info' \| 'warning' \| 'error', message: string }` | Displays a global toast notification on the client.                                                |

---

### Socket Rate Limiting Token Buckets

To prevent socket flooding or denial-of-service attempts, each socket connection is governed by separate token buckets per message category:

| Category     | Bucket Capacity | Refill Rate (tokens/sec) | Covered Events                                                         |
| :----------- | :-------------: | :----------------------: | :--------------------------------------------------------------------- |
| **join**     |       10        |        0.5 / sec         | `board:join`                                                           |
| **scene**    |       120       |        40.0 / sec        | `scene:update`                                                         |
| **presence** |       80        |        40.0 / sec        | `presence:update` _(excess silently dropped)_                          |
| **chat**     |        8        |        1.0 / sec         | `chat:send`, `chat:history`, `chat:delete`, `chat:mute`                |
| **comment**  |       10        |        1.0 / sec         | `comment:create`, `comment:reply`, `comment:resolve`, `comment:delete` |
| **rtc**      |       300       |        60.0 / sec        | `rtc:join`, `rtc:media`, `rtc:signal`                                  |
| **misc**     |       30        |        5.0 / sec         | `board:leave`, `board:end-meeting`                                     |

---

### Global Platform Enforced Limits

Enforced synchronously across both client UI inputs and backend Zod schemas ([`shared/src/constants.ts`](shared/src/constants.ts)):

| Constraint          |    Maximum Value    | Context                                   |
| :------------------ | :-----------------: | :---------------------------------------- |
| Board Name          |    60 characters    | Board title                               |
| Display Name        |    40 characters    | User display name                         |
| User Password       | 8 to 128 characters | Account credential                        |
| Board Password      |    64 characters    | Room gate password                        |
| Chat Message        |  2,000 characters   | In-room chat text                         |
| Comment Pin Text    |  2,000 characters   | Comment body (max 200 replies per thread) |
| Version Label       |    80 characters    | Named bookmark title                      |
| Elements per Batch  |    500 elements     | Maximum elements in one `scene:update`    |
| Single Element Size |       256 KB        | Serialized element buffer                 |
| Elements per Board  |   50,000 elements   | Total active elements on one canvas       |
| File / Image Upload |        5 MB         | Decoded image file buffer                 |
| Thumbnail Upload    |       300 KB        | Base64 dashboard preview image            |
| WebSocket Payload   |        8 MB         | Hard cap on raw Socket.IO frame           |

---

## Testing & Quality Assurance

SyncBoard includes an automated test pyramid with **100% passing suites**:

```
                  ┌───────────────────────────────┐
                  │   9 Playwright Browser Tests  │  End-to-End Collaboration, WebRTC,
                  │  (Dual Browser Real Context)  │  LaTeX, Templates, Commenting, Exit
                  └───────────────▲───────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  │ 61 Vitest Integration Tests   │  Auth, REST APIs, Security, Sockets,
                  │  (Backend + In-Memory Mongo)  │  Reconciliation, Version Snapshots
                  └───────────────▲───────────────┘
                                  │
                  ┌───────────────┴───────────────┐
                  │    35 Vitest Unit Tests       │  Client Algorithms, MathJax Parser,
                  │ (Shared & Frontend React/DOM) │  Templates, API Clients, UI Context
                  └───────────────────────────────┘
```

### Running Tests

```bash
# 1. Typecheck all workspaces (zero errors)
npm run typecheck

# 2. Run lint & code formatting checks
npm run lint
npm run format:check

# 3. Run all 96 Vitest unit & integration tests
npm test

# 4. Run the 9 Playwright end-to-end browser tests
# (Installs Playwright Chromium browser binaries on first run)
npm run install-browsers -w @syncboard/e2e-tests
npm run test:e2e
```

---

## Production Deployment Playbook

SyncBoard can be deployed using modern serverless/container platforms or hosted on a single Virtual Private Server (VPS).

### Option A: Modern Cloud Hosting (Vercel + Render / Railway)

This is the recommended deployment pattern:

- **Frontend**: Hosted on [Vercel](https://vercel.com) (Global CDN edge delivery).
- **Backend**: Hosted on [Render](https://render.com) or [Railway](https://railway.app) (Persistent Node.js environment supporting WebSockets).
- **Database**: [MongoDB Atlas](https://www.mongodb.com/atlas) (Managed cloud database).

```mermaid
flowchart LR
    Browser([Browser])
    Vercel["Frontend on Vercel\n(React 19 SPA)"]
    Render["Backend on Render / Railway\n(Node.js 22 + Socket.IO)"]
    Mongo[("MongoDB Atlas")]

    Browser -->|HTTPS: Static UI & Assets| Vercel
    Browser -->|HTTPS: /api & WSS: /socket.io| Render
    Render --> Mongo
```

#### 1. Deploy the Backend (on Render)

1. Create a new **Web Service** linked to your GitHub repository.
2. Select **Runtime**: `Node`.
3. Set **Build Command**:
   ```bash
   npm ci && npm run build:backend
   ```
4. Set **Start Command**:
   ```bash
   npm run start:backend
   ```
5. Configure Environment Variables:
   - `NODE_ENV=production`
   - `TRUST_PROXY=1`
   - `MONGODB_URI=<Your MongoDB Atlas connection URI>`
   - `JWT_ACCESS_SECRET=<Random 48-char string, e.g. openssl rand -base64 48>`
   - `CORS_ORIGIN=https://your-syncboard.vercel.app`
   - `APP_URL=https://your-syncboard.vercel.app`
   - `COOKIE_SAMESITE=none`
   - `COOKIE_SECURE=true`
6. Set **Health Check Path**: `/api/health`.

#### 2. Deploy the Frontend (on Vercel)

1. Import your GitHub repository into Vercel.
2. Leave **Root Directory** as repository root (a pre-configured [vercel.json](file:///c:/Users/utkar/SyncBoard/vercel.json) handles monorepo build and SPA routing automatically).
   - Alternatively, if setting Root Directory to `frontend`, the project will run the package `build` script.
3. Configure Environment Variables:
   - `VITE_API_BASE_URL=https://your-backend-api.onrender.com/api`
   - `VITE_SOCKET_URL=https://your-backend-api.onrender.com`
4. Click **Deploy**.

---

### Option B: Self-Hosted VPS (Nginx + PM2)

For hosting on Ubuntu (AWS EC2, DigitalOcean Droplet, Hetzner, etc.):

#### 1. Build the Monorepo

```bash
git clone https://github.com/your-username/SyncBoard.git /var/www/syncboard
cd /var/www/syncboard
npm ci
npm run build
```

#### 2. Configure Process Manager (PM2)

```bash
npm install -g pm2
pm2 start npm --name "syncboard-api" -- start -w @syncboard/backend
pm2 save
pm2 startup
```

#### 3. Configure Nginx Reverse Proxy

Create `/etc/nginx/sites-available/syncboard`:

```nginx
server {
    listen 80;
    server_name syncboard.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name syncboard.example.com;

    ssl_certificate /etc/letsencrypt/live/syncboard.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/syncboard.example.com/privkey.pem;

    # Frontend Single Page Application
    root /var/www/syncboard/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static Assets Long-Term Caching
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # Backend REST API
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO WebSocket Reverse Proxy
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### Production Cookie & Cross-Origin Guidelines

The refresh token is stored in an `httpOnly` cookie scoped to `/api/auth`. Two deployment patterns are supported:

1. **Unified Domain (Recommended)**: Serve frontend and API under the same domain (e.g. `syncboard.com` and `syncboard.com/api` via Nginx or Vercel rewrites). Set `COOKIE_SAMESITE=lax`.
2. **Cross-Origin Domain**: If the API lives on a separate origin (e.g. `api.render.com`), configure `COOKIE_SAMESITE=none` and `COOKIE_SECURE=true`. Set `CORS_ORIGIN` on the backend to match the exact frontend URL.

---

### Multi-Instance Horizontal Scaling

To run multiple stateless backend API instances behind a load balancer:

1. Set `REDIS_URL=redis://your-redis-host:6379` in `backend/.env`.
2. The server automatically initializes the `@socket.io/redis-adapter` to distribute room broadcasts across instances.
3. Because scene edits are conditional upserts in MongoDB and snapshot jobs use atomic locks, backend instances require no direct coordination.

---

### TURN Server Setup for Strict Networks

WebRTC peer-to-peer mesh calling uses public STUN by default (`stun:stun.l.google.com:19302`). For students connecting from behind strict educational or corporate NAT/firewalls, configure a TURN relay in `frontend/.env`:

```env
VITE_ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:turn.example.com:3478","username":"user","credential":"password"}]
```

---

## Observability & Monitoring

- **Structured Pino Logging**: Emits machine-readable JSON logs with automatic correlation request IDs (`X-Request-Id`).
- **Prometheus Metrics (`GET /metrics`)**:
  - `http_request_duration_seconds`: Histogram of route response times.
  - `socket_connected_total`: Active WebSocket connection count.
  - `socket_events_total`: Invocations and rate-limit outcomes per event type.
  - `scene_elements_total`: Accepted versus rejected element reconciliation counts.
- **Sentry Integration**: Optional unified client and server crash reporting.

---

## Upgrading & Legacy Data Migration

SyncBoard v1 stored drawing data in monolithic room documents and closed rooms 30 seconds after they emptied. SyncBoard v2 stores versioned elements permanently. To migrate legacy v1 rooms into v2:

```bash
# 1. Preview migration dry-run without writing to MongoDB
npm run migrate:rooms -w @syncboard/backend

# 2. Execute migration and persist to database
npm run migrate:rooms -w @syncboard/backend -- --apply
```

Strokes, rectangles, and pencil drawings are automatically transformed into native Excalidraw element models. Inactive rooms are preserved with unlisted visibility to keep public lobbies clean.

---

## License

This project is open-source and licensed under the [MIT License](LICENSE).

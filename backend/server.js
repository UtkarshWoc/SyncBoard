const http = require('http');
const { Server } = require('socket.io');
const app = require('./src/app');
const env = require('./src/config/env');
const initializeSocket = require('./src/socket');
const logger = require('./src/utils/logger');

// ─── Create HTTP Server ──────────────────────────────────────
const server = http.createServer(app);

// ─── Initialize Socket.IO ────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout: env.SOCKET_PING_TIMEOUT,
  pingInterval: env.SOCKET_PING_INTERVAL,
});

initializeSocket(io);

const connectDB = require('./src/config/db');

// ─── Start Server ────────────────────────────────────────────
connectDB().then(() => {
  server.listen(env.PORT, () => {
    logger.info(`🚀 SyncBoard server running on port ${env.PORT}`);
    logger.info(`📡 Socket.IO ready | CORS: ${env.CORS_ORIGIN}`);
    logger.info(`🌍 Environment: ${env.NODE_ENV}`);
  });
});

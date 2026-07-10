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
const Room = require('./src/models/Room');

// ─── Start Server ────────────────────────────────────────────
connectDB().then(async () => {
  try {
    // Clear any stale active rooms that were left open from a previous crash/restart
    const result = await Room.updateMany({ isActive: true }, { $set: { isActive: false } });
    if (result.modifiedCount > 0) {
      logger.info(`Cleaned up ${result.modifiedCount} stale active room(s) from previous session.`);
    }
  } catch (err) {
    logger.error(`Error cleaning up stale rooms: ${err.message}`);
  }

  server.listen(env.PORT, () => {
    logger.info(`🚀 SyncBoard server running on port ${env.PORT}`);
    logger.info(`📡 Socket.IO ready | CORS: ${env.CORS_ORIGIN}`);
    logger.info(`🌍 Environment: ${env.NODE_ENV}`);
  });
});

const roomHandler = require('./handlers/roomHandler');
const drawingHandler = require('./handlers/drawingHandler');
const chatHandler = require('./handlers/chatHandler');
const logger = require('../utils/logger');

/**
 * Initialize Socket.IO event handling
 */
module.exports = (io) => {
  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Register all handlers
    roomHandler(io, socket);
    drawingHandler(io, socket);
    chatHandler(io, socket);
  });
};

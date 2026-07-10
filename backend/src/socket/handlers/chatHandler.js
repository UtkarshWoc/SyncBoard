const roomService = require('../../services/roomService');
const logger = require('../../utils/logger');

/**
 * Handle chat-related socket events
 */
module.exports = (io, socket) => {
  /**
   * Receive and broadcast a chat message
   */
  socket.on('chat:message', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const message = {
      id: `${socket.id}-${Date.now()}`,
      userId: socket.id,
      username: socket.data.username || 'Anonymous',
      text: data.text,
      timestamp: new Date().toISOString(),
    };

    // Persist in room history
    roomService.addChatMessage(roomId, message);

    // Broadcast to everyone in the room (including sender)
    io.to(roomId).emit('chat:message', message);
    logger.debug(`Chat in room ${roomId}: "${message.username}": ${message.text}`);
  });
};

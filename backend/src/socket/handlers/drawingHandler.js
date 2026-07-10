const roomService = require('../../services/roomService');
const logger = require('../../utils/logger');

/**
 * Handle drawing-related socket events
 */
module.exports = (io, socket) => {
  /**
   * Broadcast drawing start
   */
  socket.on('draw:start', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('draw:start', { ...data, userId: socket.id });
  });

  /**
   * Broadcast drawing move (streaming points)
   */
  socket.on('draw:move', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit('draw:move', { ...data, userId: socket.id });
  });

  /**
   * Broadcast drawing end and persist the element
   */
  socket.on('draw:end', (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    // Store the completed element in room state
    if (data.element) {
      roomService.addCanvasElement(roomId, data.element);
    }

    socket.to(roomId).emit('draw:end', { ...data, userId: socket.id });
  });

  /**
   * Clear the entire canvas
   */
  socket.on('canvas:clear', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    roomService.clearCanvas(roomId);
    socket.to(roomId).emit('canvas:clear');
    logger.info(`Canvas cleared in room ${roomId} by ${socket.data.username}`);
  });

  /**
   * Undo last element
   */
  socket.on('canvas:undo', () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    const newState = roomService.undoCanvas(roomId);
    io.to(roomId).emit('canvas:state', newState);
    logger.debug(`Canvas undo in room ${roomId}`);
  });
};

const roomService = require('../../services/roomService');
const logger = require('../../utils/logger');

/**
 * Handle room-related socket events
 */
module.exports = (io, socket) => {
  /**
   * Create a new room
   */
  socket.on('room:create', async ({ roomName, username, isPublic = true }, callback) => {
    try {
      const room = await roomService.createRoom(roomName, {
        isPublic,
        createdBy: username,
      });
      const result = await roomService.joinRoom(room.id, socket.id, username);

      if (!result) {
        return callback?.({ success: false, message: 'Failed to create room' });
      }

      socket.join(room.id);
      socket.data.roomId = room.id;
      socket.data.username = result.user.username;

      // Broadcast updated public room list
      const publicRooms = await roomService.getPublicRooms();
      io.emit('rooms:updated', publicRooms);

      callback?.({ success: true, data: { room: result.room, user: result.user } });
    } catch (err) {
      logger.error('room:create error', err);
      callback?.({ success: false, message: 'Server error' });
    }
  });

  /**
   * Join an existing room
   */
  socket.on('room:join', async ({ roomId, username }, callback) => {
    try {
      const exists = await roomService.roomExists(roomId);
      if (!exists) {
        return callback?.({ success: false, message: 'Room not found' });
      }

      const result = await roomService.joinRoom(roomId, socket.id, username);
      if (!result) {
        return callback?.({ success: false, message: 'Failed to join room' });
      }

      socket.join(roomId);
      socket.data.roomId = roomId;
      socket.data.username = result.user.username;

      // Send canvas state to the joining user
      const canvasState = roomService.getCanvasState(roomId);
      socket.emit('canvas:state', canvasState);

      // Send chat history to the joining user
      const chatHistory = roomService.getChatHistory(roomId);
      socket.emit('chat:history', chatHistory);

      // Notify others in the room
      socket.to(roomId).emit('room:user-joined', result.user);

      // Broadcast updated user list to everyone in the room
      io.to(roomId).emit('room:users', roomService.getUsersInRoom(roomId));

      // Broadcast updated public room list
      const publicRooms = await roomService.getPublicRooms();
      io.emit('rooms:updated', publicRooms);

      callback?.({ success: true, data: { room: result.room, user: result.user } });
    } catch (err) {
      logger.error('room:join error', err);
      callback?.({ success: false, message: 'Server error' });
    }
  });

  /**
   * Leave a room
   */
  socket.on('room:leave', async (callback) => {
    try {
      const roomId = socket.data.roomId;
      if (!roomId) return callback?.({ success: true });

      const result = await roomService.leaveRoom(roomId, socket.id);
      socket.leave(roomId);
      socket.data.roomId = null;

      if (result?.user) {
        socket.to(roomId).emit('room:user-left', result.user);
        io.to(roomId).emit('room:users', result.remainingUsers);
      }

      const publicRooms = await roomService.getPublicRooms();
      io.emit('rooms:updated', publicRooms);
      callback?.({ success: true });
    } catch (err) {
      logger.error('room:leave error', err);
      callback?.({ success: false, message: 'Server error' });
    }
  });

  /**
   * Handle disconnect
   */
  socket.on('disconnect', async () => {
    const roomId = socket.data.roomId;
    if (!roomId) return;

    try {
      const result = await roomService.leaveRoom(roomId, socket.id);
      if (result?.user) {
        socket.to(roomId).emit('room:user-left', result.user);
        io.to(roomId).emit('room:users', result.remainingUsers);
      }

      const publicRooms = await roomService.getPublicRooms();
      io.emit('rooms:updated', publicRooms);
      logger.info(`Socket ${socket.id} disconnected from room ${roomId}`);
    } catch (err) {
      logger.error('disconnect error', err);
    }
  });
};

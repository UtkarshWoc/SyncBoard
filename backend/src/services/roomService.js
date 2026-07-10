const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');
const Room = require('../models/Room');

/**
 * In-memory cache for ACTIVE rooms.
 * Maps roomId -> { id, name, isPublic, createdBy, users: Map<socketId, { id, username, color, joinedAt }>, 
 *                   canvasState: [], chatHistory: [], createdAt }
 */
const activeRooms = new Map();

// Timeouts to close empty rooms
const emptyRoomTimeouts = new Map();

// Predefined avatar colors for participants
const AVATAR_COLORS = [
  '#6C5CE7', '#00B894', '#E17055', '#0984E3',
  '#FDCB6E', '#E84393', '#00CEC9', '#FF7675',
  '#A29BFE', '#55EFC4', '#FAB1A0', '#74B9FF',
];

const getRandomColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

const roomService = {
  /**
   * Create a new room in DB and load it to cache
   */
  async createRoom(roomName, { isPublic = true, createdBy = null } = {}) {
    const roomId = uuidv4().slice(0, 8).toUpperCase();
    
    const roomDoc = await Room.create({
      id: roomId,
      name: roomName || `Room ${roomId}`,
      isPublic,
      createdBy,
      isActive: true,
    });
    
    const room = {
      id: roomId,
      name: roomDoc.name,
      isPublic,
      createdBy,
      users: new Map(),
      canvasState: [],
      chatHistory: [],
      createdAt: roomDoc.createdAt,
    };
    activeRooms.set(roomId, room);
    
    logger.info(`Room created: ${roomId} - "${room.name}" (${isPublic ? 'public' : 'private'})`);
    return this.serializeRoom(room);
  },

  /**
   * Get room from memory or load from DB if active
   */
  async getOrLoadRoom(roomId) {
    if (activeRooms.has(roomId)) {
      return activeRooms.get(roomId);
    }
    
    const roomDoc = await Room.findOne({ id: roomId, isActive: true });
    if (!roomDoc) return null;
    
    const room = {
      id: roomDoc.id,
      name: roomDoc.name,
      isPublic: roomDoc.isPublic,
      createdBy: roomDoc.createdBy,
      users: new Map(),
      canvasState: roomDoc.canvasState || [],
      chatHistory: roomDoc.chatHistory || [],
      createdAt: roomDoc.createdAt,
    };
    activeRooms.set(roomId, room);
    return room;
  },

  /**
   * Join a user to a room
   */
  async joinRoom(roomId, socketId, username) {
    const room = await this.getOrLoadRoom(roomId);
    if (!room) return null;

    const user = {
      id: socketId,
      username: username || `User-${socketId.slice(0, 4)}`,
      color: getRandomColor(),
      joinedAt: new Date().toISOString(),
    };
    room.users.set(socketId, user);
    logger.info(`User "${user.username}" joined room ${roomId}`);

    // Cancel any pending close timeout
    if (emptyRoomTimeouts.has(roomId)) {
      clearTimeout(emptyRoomTimeouts.get(roomId));
      emptyRoomTimeouts.delete(roomId);
    }

    return { room: this.serializeRoom(room), user };
  },

  /**
   * Remove a user from a room, flush to DB if empty
   */
  async leaveRoom(roomId, socketId) {
    const room = activeRooms.get(roomId);
    if (!room) return null;

    const user = room.users.get(socketId);
    room.users.delete(socketId);

    const remainingUsers = Array.from(room.users.values());

    if (room.users.size === 0) {
      await this.saveRoomState(roomId);
      
      // Start 30s timeout to close the room completely
      const timeoutId = setTimeout(async () => {
        const currentRoom = activeRooms.get(roomId);
        if (currentRoom && currentRoom.users.size === 0) {
          await Room.updateOne({ id: roomId }, { isActive: false });
          activeRooms.delete(roomId);
          emptyRoomTimeouts.delete(roomId);
          logger.info(`Room ${roomId} closed after 30s of inactivity.`);
        }
      }, 30000);
      
      emptyRoomTimeouts.set(roomId, timeoutId);
      logger.info(`Room ${roomId} empty. 30s countdown to close started.`);
    }

    return { user, remainingUsers };
  },

  /**
   * Flush active room state to DB
   */
  async saveRoomState(roomId) {
    const room = activeRooms.get(roomId);
    if (!room) return;
    try {
      await Room.updateOne(
        { id: roomId },
        { 
          $set: { 
            canvasState: room.canvasState, 
            chatHistory: room.chatHistory 
          } 
        }
      );
    } catch (err) {
      logger.error(`Error saving room state to DB for ${roomId}: ${err.message}`);
    }
  },

  /**
   * Find which room a socket belongs to (only among active ones)
   */
  findRoomBySocket(socketId) {
    for (const [roomId, room] of activeRooms) {
      if (room.users.has(socketId)) return roomId;
    }
    return null;
  },

  /**
   * Get all active users in a room
   */
  getUsersInRoom(roomId) {
    const room = activeRooms.get(roomId);
    if (!room) return [];
    return Array.from(room.users.values());
  },

  /**
   * Check if room exists
   */
  async roomExists(roomId) {
    if (activeRooms.has(roomId)) return true;
    const count = await Room.countDocuments({ id: roomId, isActive: true });
    return count > 0;
  },

  /**
   * Get room info
   */
  async getRoom(roomId) {
    const room = await this.getOrLoadRoom(roomId);
    return room ? this.serializeRoom(room) : null;
  },

  /**
   * Get all active rooms (for REST API)
   */
  async getAllRooms() {
    const rooms = await Room.find({ isActive: true }).sort({ createdAt: -1 });
    return rooms.map(doc => {
      const cached = activeRooms.get(doc.id);
      return {
        id: doc.id,
        name: doc.name,
        isPublic: doc.isPublic,
        createdBy: doc.createdBy,
        userCount: cached ? cached.users.size : 0,
        createdAt: doc.createdAt,
      };
    });
  },

  /**
   * Get only public rooms (for lobby listing)
   */
  async getPublicRooms() {
    const all = await this.getAllRooms();
    return all.filter((room) => room.isPublic);
  },

  /**
   * Add a drawing element to room's canvas state
   */
  addCanvasElement(roomId, element) {
    const room = activeRooms.get(roomId);
    if (!room) return;
    room.canvasState.push(element);
  },

  /**
   * Get canvas state for a room
   */
  getCanvasState(roomId) {
    const room = activeRooms.get(roomId);
    return room ? room.canvasState : [];
  },

  /**
   * Clear canvas state for a room
   */
  clearCanvas(roomId) {
    const room = activeRooms.get(roomId);
    if (room) {
      room.canvasState = [];
      this.saveRoomState(roomId); // persist clear immediately
    }
  },

  /**
   * Undo last canvas element for a room
   */
  undoCanvas(roomId) {
    const room = activeRooms.get(roomId);
    if (room && room.canvasState.length > 0) {
      room.canvasState.pop();
    }
    return room ? room.canvasState : [];
  },

  /**
   * Add a chat message to room history
   */
  addChatMessage(roomId, message) {
    const room = activeRooms.get(roomId);
    if (!room) return;
    room.chatHistory.push(message);
    // Keep last 200 messages
    if (room.chatHistory.length > 200) {
      room.chatHistory = room.chatHistory.slice(-200);
    }
  },

  /**
   * Get chat history
   */
  getChatHistory(roomId) {
    const room = activeRooms.get(roomId);
    return room ? room.chatHistory : [];
  },

  /**
   * Serialize room for client consumption
   */
  serializeRoom(room) {
    return {
      id: room.id,
      name: room.name,
      isPublic: room.isPublic,
      createdBy: room.createdBy,
      users: Array.from(room.users.values()),
      userCount: room.users.size,
      createdAt: room.createdAt,
    };
  },
};

// Periodically save all active rooms to DB (every 30 seconds)
setInterval(async () => {
  for (const roomId of activeRooms.keys()) {
    await roomService.saveRoomState(roomId);
  }
}, 30000);

module.exports = roomService;

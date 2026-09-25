const roomService = require('../services/roomService');

const roomController = {
  /**
   * GET /api/rooms - List all public rooms (for lobby)
   */
  async getAllRooms(req, res) {
    try {
      const rooms = await roomService.getPublicRooms();
      res.json({ success: true, data: rooms });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  /**
   * GET /api/rooms/:id - Get single room info
   */
  async getRoom(req, res) {
    try {
      const room = await roomService.getRoom(req.params.id);
      if (!room) {
        return res.status(404).json({ success: false, message: 'Room not found' });
      }
      res.json({ success: true, data: room });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  /**
   * POST /api/rooms - Create a new room
   */
  async createRoom(req, res) {
    try {
      const { name, isPublic } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ success: false, message: 'Room name is required' });
      }

      const room = await roomService.createRoom(name, { isPublic });
      res.status(201).json({ success: true, data: room });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  /**
   * GET /api/rooms/:id/exists - Check if room exists
   */
  async checkRoom(req, res) {
    try {
      const exists = await roomService.roomExists(req.params.id);
      res.json({ success: true, data: { exists } });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },
};

module.exports = roomController;

/**
 * Profile Controller
 * Handles profile data retrieval and updates
 */
const User = require('../models/User');
const logger = require('../utils/logger');

const profileController = {
  /**
   * GET /api/profile/me - Get current user profile
   */
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      res.json({
        success: true,
        data: {
          id: user._id.toString(),
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
          googleId: user.googleId,
          createdAt: user.createdAt,
        },
      });
    } catch (err) {
      logger.error('Get profile error:', err.message);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },

  /**
   * PUT /api/profile/me - Update user profile
   */
  async updateProfile(req, res) {
    try {
      const { displayName } = req.body;

      if (!displayName || !displayName.trim()) {
        return res.status(400).json({ success: false, message: 'Display name is required' });
      }

      if (displayName.trim().length > 30) {
        return res.status(400).json({ success: false, message: 'Display name must be 30 characters or less' });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      user.displayName = displayName.trim();
      await user.save();

      logger.info(`Profile updated for user: ${user.email}`);

      res.json({
        success: true,
        data: {
          id: user._id.toString(),
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl,
        },
      });
    } catch (err) {
      logger.error('Update profile error:', err.message);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },
};

module.exports = profileController;
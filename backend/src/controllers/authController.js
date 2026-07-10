const authService = require('../services/authService');
const logger = require('../utils/logger');

const authController = {
  /**
   * POST /api/auth/register
   */
  async register(req, res) {
    try {
      const { email, password, displayName } = req.body;

      if (!email || !password || !displayName) {
        return res.status(400).json({
          success: false,
          message: 'Email, password, and display name are required',
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters',
        });
      }

      const result = await authService.registerUser(email, password, displayName);
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.status(201).json(result);
    } catch (err) {
      const status = err.statusCode || 500;
      const message = err.message || 'Registration failed';
      logger.error('Register error:', message);
      res.status(status).json({ success: false, message });
    }
  },

  /**
   * POST /api/auth/login
   */
  async login(req, res) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email and password are required',
        });
      }

      const result = await authService.loginUser(email, password);
      
      if (!result.success) {
        return res.status(400).json(result);
      }
      
      res.json(result);
    } catch (err) {
      const status = err.statusCode || 500;
      const message = err.message || 'Login failed';
      logger.error('Login error:', message);
      res.status(status).json({ success: false, message });
    }
  },

  /**
   * POST /api/auth/google
   */
  async googleAuth(req, res) {
    try {
      const { token: idToken } = req.body;

      if (!idToken) {
        return res.status(400).json({
          success: false,
          message: 'Google ID token is required',
        });
      }

      const result = await authService.googleAuth(idToken);
      if (!result.success) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (err) {
      const status = err.statusCode || 500;
      const message = err.message || 'Google authentication failed';
      logger.error('Google auth error:', message);
      res.status(status).json({ success: false, message });
    }
  },

  /**
   * GET /api/auth/me
   */
  async getMe(req, res) {
    try {
      const user = await authService.findUserById(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      res.json({ success: true, data: { user } });
    } catch (err) {
      res.status(500).json({ success: false, message: 'Server error' });
    }
  },
};

module.exports = authController;

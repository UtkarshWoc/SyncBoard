const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const env = require('../config/env');
const logger = require('../utils/logger');
const User = require('../models/User');

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

const authService = {
  /**
   * Register a new user with email and password
   */
  async registerUser(email, password, displayName) {
    try {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return { success: false, message: 'Email already registered' };
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const user = await User.create({
        email,
        passwordHash,
        displayName,
      });

      logger.info(`New user registered: ${email}`);
      return { success: true, data: this.generateAuthResponse(user) };
    } catch (error) {
      logger.error(`Register error: ${error.message}`);
      return { success: false, message: 'Server error' };
    }
  },

  /**
   * Login user with email and password
   */
  async loginUser(email, password) {
    try {
      const user = await User.findOne({ email });
      if (!user) {
        return { success: false, message: 'Invalid credentials' };
      }

      if (!user.passwordHash) {
        return { success: false, message: 'Please login with Google' };
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return { success: false, message: 'Invalid credentials' };
      }

      return { success: true, data: this.generateAuthResponse(user) };
    } catch (error) {
      logger.error(`Login error: ${error.message}`);
      return { success: false, message: 'Server error' };
    }
  },

  /**
   * Login or register user with Google OAuth token
   */
  async googleAuth(token) {
    if (!googleClient) {
      return { success: false, message: 'Google Auth is not configured' };
    }

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      
      const { email, sub: googleId, name, picture } = payload;

      let user = await User.findOne({ email });

      if (!user) {
        // Register new user
        user = await User.create({
          email,
          googleId,
          displayName: name,
          avatarUrl: picture,
        });
        logger.info(`New Google user registered: ${email}`);
      } else {
        // Link Google ID if not already linked
        if (!user.googleId) {
          user.googleId = googleId;
          if (picture) user.avatarUrl = picture;
          await user.save();
        }
      }

      return { success: true, data: this.generateAuthResponse(user) };
    } catch (err) {
      logger.error('Google verification failed', err);
      return { success: false, message: 'Invalid Google token' };
    }
  },

  /**
   * Generate JWT and user response
   */
  generateAuthResponse(user) {
    const token = jwt.sign({ id: user._id.toString(), email: user.email }, env.JWT_SECRET, {
      expiresIn: '7d',
    });

    return {
      token,
      user: {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      },
    };
  },

  /**
   * Find user by ID
   */
  async findUserById(id) {
    try {
      const user = await User.findById(id);
      if (!user) return null;
      return {
        id: user._id.toString(),
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
      };
    } catch (error) {
      return null;
    }
  },
};

module.exports = authService;

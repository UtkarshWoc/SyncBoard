const authService = require('../services/authService');
const logger = require('../utils/logger');

/**
 * JWT authentication middleware
 * Extracts Bearer token, verifies it, attaches user to req
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = authService.verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    logger.debug('JWT verification failed:', err.message);
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

/**
 * Optional auth middleware — attaches user if token present, but doesn't block
 */
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = authService.verifyToken(token);
    } catch (err) {
      // Token invalid, proceed without user
    }
  }
  next();
};

module.exports = { authenticate, optionalAuth };

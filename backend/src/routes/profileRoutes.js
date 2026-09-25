const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { authenticate } = require('../middleware/auth');

// Profile routes require authentication
router.get('/me', authenticate, profileController.getProfile);
router.put('/me', authenticate, profileController.updateProfile);

module.exports = router;
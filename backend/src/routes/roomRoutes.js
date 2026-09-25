const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { authenticate } = require('../middleware/auth');

router.get('/', roomController.getAllRooms);
router.get('/:id', authenticate, roomController.getRoom);
router.get('/:id/exists', authenticate, roomController.checkRoom);
router.post('/', authenticate, roomController.createRoom);

module.exports = router;
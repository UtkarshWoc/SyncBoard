const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

router.get('/', roomController.getAllRooms);
router.post('/', roomController.createRoom);
router.get('/:id', roomController.getRoom);
router.get('/:id/exists', roomController.checkRoom);

module.exports = router;

const express = require('express');
const chat = require('../controllers/chatController');
const { authenticate, authorize, requireActiveStatus } = require('../middleware/auth');

const router = express.Router();

router.get('/history', authenticate, requireActiveStatus, chat.getHistory);
router.get('/room', authenticate, chat.getRoomState);
router.post('/room/lock', authenticate, authorize('super_admin', 'moderator'), chat.setRoomLock);
router.post('/mute', authenticate, authorize('super_admin', 'moderator'), chat.muteUser);
router.delete('/messages/:id', authenticate, authorize('super_admin', 'moderator'), chat.deleteMessage);

module.exports = router;

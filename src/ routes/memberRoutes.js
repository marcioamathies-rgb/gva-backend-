const express = require('express');
const members = require('../controllers/memberController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate, authorize('super_admin', 'moderator'));

router.get('/', members.listMembers);
router.get('/:id', members.getMember);
router.post('/', members.createMember);
router.patch('/:id', members.updateMember);
router.post('/:id/approve', members.approveMember);
router.post('/:id/status', members.setStatus);
router.post('/:id/renew', members.renewMembership);
router.post('/:id/reset-password', members.resetPassword);

module.exports = router;

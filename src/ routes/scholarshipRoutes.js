const express = require('express');
const sc = require('../controllers/scholarshipController');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Public + member: view programs
router.get('/programs', sc.listPrograms);

// Any visitor can apply (auth optional — logged-in members get their user_id linked)
router.post('/apply', (req, res, next) => {
  // optionally attach user if token present
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    require('../middleware/auth').authenticate(req, res, () => sc.applyForScholarship(req, res, next));
  } else {
    sc.applyForScholarship(req, res, next);
  }
});

// Admin/Moderator only
router.post('/programs', authenticate, authorize('super_admin', 'moderator'), sc.createProgram);
router.delete('/programs/:id', authenticate, authorize('super_admin', 'moderator'), sc.deleteProgram);

module.exports = router;

const express = require('express');
const f = require('../controllers/featuresController');
const sc = require('../controllers/scholarshipController');
const { authenticate, authorize, requireActiveStatus } = require('../middleware/auth');
const A = authorize('super_admin','moderator');
const AA = authorize('super_admin');

const router = express.Router();

// CMS (public read, admin write)
router.get('/cms', f.getCmsContent);
router.put('/cms/:pageKey', authenticate, A, f.updateCmsContent);

// Gallery
router.get('/gallery', f.listGallery);
router.get('/gallery/pending', authenticate, A, f.pendingGallery);
router.post('/gallery', authenticate, requireActiveStatus, f.submitImage);
router.patch('/gallery/:id/approve', authenticate, A, f.approveImage);
router.delete('/gallery/:id', authenticate, A, f.deleteImage);

// Voting
router.get('/voting/elections', authenticate, requireActiveStatus, f.listElections);
router.post('/voting/elections', authenticate, A, f.createElection);
router.post('/voting/elections/:id/candidates', authenticate, A, f.addCandidate);
router.post('/voting/elections/:id/vote', authenticate, requireActiveStatus, f.castVote);
router.get('/voting/elections/:id/results', authenticate, f.electionResults);

// Documents
router.get('/documents', authenticate, requireActiveStatus, f.listDocs);
router.post('/documents', authenticate, A, f.uploadDoc);
router.delete('/documents/:id', authenticate, A, f.deleteDoc);

// Complaints
router.get('/complaints', authenticate, f.listComplaints);
router.post('/complaints', authenticate, requireActiveStatus, f.submitComplaint);
router.patch('/complaints/:id', authenticate, A, f.updateComplaint);

// Social / posts
router.get('/posts', authenticate, requireActiveStatus, f.getFeed);
router.post('/posts', authenticate, requireActiveStatus, f.createPost);
router.post('/posts/:id/like', authenticate, requireActiveStatus, f.likePost);
router.post('/posts/:id/comment', authenticate, requireActiveStatus, f.commentPost);

// Scholarships
router.get('/scholarships/programs', sc.listPrograms);
router.post('/scholarships/programs', authenticate, A, sc.createProgram);
router.delete('/scholarships/programs/:id', authenticate, A, sc.deleteProgram);
router.post('/scholarships/apply', sc.applyForScholarship);

// Monetization (admin only)
router.get('/monetization', authenticate, AA, f.getMonetizationStatus);
router.put('/monetization', authenticate, AA, f.updateMonetization);
router.post('/monetization/member/:userId', authenticate, A, f.enableMemberMonetization);

module.exports = router;

const express = require('express');
const multer = require('multer');
const pool = require('../config/db');
const cloudinaryUtil = require('../utils/cloudinary');
const pushUtil = require('../utils/push');
const stripeUtil = require('../utils/stripe');
const { authenticate, authorize, requireActiveStatus } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/* ============================================================
   Member Directory & Search
============================================================ */
router.get('/directory', authenticate, requireActiveStatus, async (req, res, next) => {
  try {
    const { search, page = 1 } = req.query;
    const limit = 24, offset = (Number(page) - 1) * limit;
    const params = [];
    let where = "WHERE u.status = 'active'";
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (m.full_name ILIKE $${params.length} OR m.membership_id ILIKE $${params.length} OR m.occupation ILIKE $${params.length})`;
    }
    params.push(limit, offset);
    const { rows } = await pool.query(
      `SELECT m.membership_id, m.full_name, m.profile_photo_url, m.occupation, m.nationality, m.join_date
       FROM users u JOIN members m ON m.user_id = u.id
       ${where}
       ORDER BY m.full_name ASC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ members: rows });
  } catch (err) { next(err); }
});

/* ============================================================
   Profile pages
============================================================ */
router.get('/profile/:membershipId', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.membership_id, m.full_name, m.profile_photo_url, m.bio, m.occupation,
              m.nationality, m.skills, m.join_date,
              (SELECT COUNT(*) FROM posts WHERE user_id = m.user_id)::int AS post_count,
              (SELECT COUNT(*) FROM member_connections WHERE (requester_id = m.user_id OR addressee_id = m.user_id) AND status = 'accepted')::int AS connections
       FROM members m JOIN users u ON u.id = m.user_id
       WHERE UPPER(m.membership_id) = $1 AND u.status = 'active'`,
      [req.params.membershipId.toUpperCase()]
    );
    if (!rows.length) return res.status(404).json({ error: 'Member not found.' });
    const profile = rows[0];

    const { rows: posts } = await pool.query(
      `SELECT p.id, p.content, p.image_url, p.created_at,
              (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id)::int AS likes,
              (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id)::int AS comments
       FROM posts p JOIN members m ON m.user_id = p.user_id
       WHERE UPPER(m.membership_id) = $1 ORDER BY p.created_at DESC LIMIT 20`,
      [req.params.membershipId.toUpperCase()]
    );
    res.json({ ...profile, posts });
  } catch (err) { next(err); }
});

router.patch('/profile', authenticate, async (req, res, next) => {
  try {
    const { bio, occupation, skills, nationality } = req.body;
    await pool.query(
      'UPDATE members SET bio=$1, occupation=$2, skills=$3, nationality=$4 WHERE user_id=$5',
      [bio || null, occupation || null, skills || null, nationality || null, req.user.id]
    );
    res.json({ message: 'Profile updated.' });
  } catch (err) { next(err); }
});

/* ============================================================
   File uploads (Cloudinary)
============================================================ */
router.post('/upload/avatar', authenticate, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    if (!cloudinaryUtil.isConfigured()) return res.status(503).json({ error: 'File storage not configured yet.' });
    const result = await cloudinaryUtil.uploadAvatar(req.file.buffer, req.user.id);
    await pool.query('UPDATE members SET profile_photo_url=$1 WHERE user_id=$2', [result.secure_url, req.user.id]);
    res.json({ url: result.secure_url });
  } catch (err) { next(err); }
});

router.post('/upload/gallery', authenticate, requireActiveStatus, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    if (!cloudinaryUtil.isConfigured()) return res.status(503).json({ error: 'File storage not configured yet.' });
    const result = await cloudinaryUtil.uploadImage(req.file.buffer);
    const { rows } = await pool.query(
      'INSERT INTO gallery_images (submitted_by, url, thumbnail_url) VALUES ($1,$2,$3) RETURNING id',
      [req.user.id, result.secure_url, result.eager?.[0]?.secure_url || result.secure_url]
    );
    res.status(201).json({ id: rows[0].id, url: result.secure_url, message: 'Submitted for admin approval.' });
  } catch (err) { next(err); }
});

router.post('/upload/document', authenticate, authorize('super_admin', 'moderator'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
    if (!cloudinaryUtil.isConfigured()) return res.status(503).json({ error: 'File storage not configured yet.' });
    const result = await cloudinaryUtil.uploadDocument(req.file.buffer, req.file.originalname);
    const { title, description, category } = req.body;
    const { rows } = await pool.query(
      'INSERT INTO documents (title, description, file_url, category, uploaded_by) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [title || req.file.originalname, description || null, result.secure_url, category || 'other', req.user.id]
    );
    await logAudit(req.user.id, 'Uploaded document', 'document', rows[0].id, { title });
    res.status(201).json({ id: rows[0].id, url: result.secure_url });
  } catch (err) { next(err); }
});

/* ============================================================
   Push Notifications
============================================================ */
router.get('/push/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || null, configured: pushUtil.isConfigured() });
});

router.post('/push/subscribe', authenticate, async (req, res, next) => {
  try {
    await pushUtil.savePushSubscription(req.user.id, req.body);
    res.json({ message: 'Push subscription saved.' });
  } catch (err) { next(err); }
});

router.post('/push/broadcast', authenticate, authorize('super_admin', 'moderator'), async (req, res, next) => {
  try {
    const { title, body, url } = req.body;
    if (!title) return res.status(400).json({ error: 'Title required.' });
    await pushUtil.pushToAll({ title, body: body || '', url: url || '/', icon: '/icon-192.png' });
    await logAudit(req.user.id, 'Sent push broadcast', null, null, { title, body });
    res.json({ message: 'Broadcast sent.' });
  } catch (err) { next(err); }
});

/* ============================================================
   Stripe — Payments & Payouts
============================================================ */
router.get('/stripe/status', authenticate, authorize('super_admin'), (req, res) => {
  res.json({ configured: stripeUtil.isConfigured(), publicKey: process.env.STRIPE_PUBLISHABLE_KEY || null });
});

router.post('/stripe/checkout', authenticate, async (req, res, next) => {
  try {
    if (!stripeUtil.isConfigured()) return res.status(503).json({ error: 'Payments not configured yet.' });
    const { amount, description, successUrl, cancelUrl } = req.body;
    const session = await stripeUtil.createCheckoutSession({
      amount, description: description || 'GVA Payment',
      successUrl: successUrl || `${process.env.CORS_ORIGIN}/payment-success`,
      cancelUrl:  cancelUrl  || `${process.env.CORS_ORIGIN}/payment-cancel`,
      metadata: { userId: req.user.id }
    });
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) { next(err); }
});

router.post('/stripe/connect/onboard', authenticate, requireActiveStatus, async (req, res, next) => {
  try {
    if (!stripeUtil.isConfigured()) return res.status(503).json({ error: 'Payments not configured yet.' });
    const { rows } = await pool.query('SELECT stripe_connect_account, full_name FROM members WHERE user_id=$1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ error: 'Member not found.' });
    let accountId = rows[0].stripe_connect_account;
    if (!accountId) {
      const account = await stripeUtil.createMemberConnectAccount({ email: req.user.email, name: rows[0].full_name });
      accountId = account.id;
      await pool.query('UPDATE members SET stripe_connect_account=$1 WHERE user_id=$2', [accountId, req.user.id]);
    }
    const link = await stripeUtil.createConnectOnboardingLink(accountId, `${process.env.CORS_ORIGIN}/dashboard`);
    res.json({ url: link.url });
  } catch (err) { next(err); }
});

router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const event = stripeUtil.constructWebhookEvent(req.body, req.headers['stripe-signature']);
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (userId) {
        await pool.query(
          `INSERT INTO finance_transactions (member_user_id, type, amount, currency, stripe_payment_intent_id, notes)
           VALUES ($1, 'dues', $2, $3, $4, 'Online payment via Stripe')`,
          [userId, session.amount_total / 100, session.currency.toUpperCase(), session.payment_intent]
        );
      }
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

/* ============================================================
   Member connections
============================================================ */
router.post('/connections/request', authenticate, requireActiveStatus, async (req, res, next) => {
  try {
    const { addresseeId } = req.body;
    await pool.query(
      'INSERT INTO member_connections (requester_id, addressee_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
      [req.user.id, addresseeId]
    );
    // Notify the other member
    const { rows } = await pool.query('SELECT full_name FROM members WHERE user_id=$1', [req.user.id]);
    await pushUtil.pushToUser(addresseeId, { title: 'New Connection Request', body: `${rows[0]?.full_name || 'A member'} wants to connect with you.` }).catch(() => {});
    res.json({ message: 'Connection request sent.' });
  } catch (err) { next(err); }
});

router.post('/connections/respond', authenticate, async (req, res, next) => {
  try {
    const { requesterId, accept } = req.body;
    await pool.query(
      `UPDATE member_connections SET status=$1 WHERE requester_id=$2 AND addressee_id=$3`,
      [accept ? 'accepted' : 'blocked', requesterId, req.user.id]
    );
    res.json({ message: accept ? 'Connection accepted.' : 'Request declined.' });
  } catch (err) { next(err); }
});

router.get('/connections', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT m.membership_id, m.full_name, m.profile_photo_url, mc.status,
              CASE WHEN mc.requester_id = $1 THEN 'sent' ELSE 'received' END AS direction
       FROM member_connections mc
       JOIN members m ON m.user_id = CASE WHEN mc.requester_id = $1 THEN mc.addressee_id ELSE mc.requester_id END
       WHERE (mc.requester_id = $1 OR mc.addressee_id = $1) AND mc.status != 'blocked'`,
      [req.user.id]
    );
    res.json({ connections: rows });
  } catch (err) { next(err); }
});

/* ============================================================
   Notifications
============================================================ */
router.get('/notifications', authenticate, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM notifications WHERE user_id=$1 ORDER BY created_at DESC LIMIT 50',
      [req.user.id]
    );
    res.json({ notifications: rows });
  } catch (err) { next(err); }
});

router.post('/notifications/read', authenticate, async (req, res, next) => {
  try {
    await pool.query('UPDATE notifications SET read=TRUE WHERE user_id=$1', [req.user.id]);
    res.json({ message: 'All marked read.' });
  } catch (err) { next(err); }
});

/* ============================================================
   Admin stats (dashboard overview)
============================================================ */
router.get('/admin/stats', authenticate, authorize('super_admin', 'moderator'), async (req, res, next) => {
  try {
    const [members, pending, expired, complaints, scholarships, gallery] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE role='member' AND status='active'`),
      pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE status='pending'`),
      pool.query(`SELECT COUNT(*)::int AS count FROM users WHERE status='expired'`),
      pool.query(`SELECT COUNT(*)::int AS count FROM complaints WHERE status='open'`),
      pool.query(`SELECT COUNT(*)::int AS count FROM scholarship_applications WHERE status='submitted'`),
      pool.query(`SELECT COUNT(*)::int AS count FROM gallery_images WHERE approved=FALSE`),
    ]);
    res.json({
      activeMembers:       members.rows[0].count,
      pendingApplications: pending.rows[0].count,
      expiredMembers:      expired.rows[0].count,
      openComplaints:      complaints.rows[0].count,
      pendingScholarships: scholarships.rows[0].count,
      pendingGallery:      gallery.rows[0].count,
    });
  } catch (err) { next(err); }
});

module.exports = router;

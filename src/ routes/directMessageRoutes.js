const express = require('express');
const pool = require('../config/db');
const { authenticate, requireActiveStatus } = require('../middleware/auth');

const router = express.Router();

// Get all conversations (inbox)
router.get('/conversations', authenticate, requireActiveStatus, async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT ON (other_id)
        other_id,
        m.full_name, m.profile_photo_url, m.membership_id,
        dm.content AS last_message, dm.created_at,
        (SELECT COUNT(*) FROM direct_messages
         WHERE recipient_id = $1 AND sender_id = other_id AND read = FALSE)::int AS unread
      FROM (
        SELECT CASE WHEN sender_id = $1 THEN recipient_id ELSE sender_id END AS other_id,
               id, content, created_at
        FROM direct_messages WHERE sender_id = $1 OR recipient_id = $1
      ) sub
      JOIN direct_messages dm ON dm.id = sub.id
      LEFT JOIN members m ON m.user_id = sub.other_id
      ORDER BY other_id, dm.created_at DESC
    `, [req.user.id]);
    res.json({ conversations: rows });
  } catch (err) { next(err); }
});

// Get messages between two users
router.get('/conversation/:memberId', authenticate, requireActiveStatus, async (req, res, next) => {
  try {
    const { rows: target } = await pool.query(
      'SELECT user_id FROM members WHERE UPPER(membership_id) = $1',
      [req.params.memberId.toUpperCase()]
    );
    if (!target.length) return res.status(404).json({ error: 'Member not found.' });
    const otherId = target[0].user_id;

    const { rows } = await pool.query(`
      SELECT dm.*, m.full_name, m.profile_photo_url
      FROM direct_messages dm
      LEFT JOIN members m ON m.user_id = dm.sender_id
      WHERE (sender_id = $1 AND recipient_id = $2)
         OR (sender_id = $2 AND recipient_id = $1)
      ORDER BY created_at ASC LIMIT 100
    `, [req.user.id, otherId]);

    // Mark as read
    await pool.query(
      'UPDATE direct_messages SET read = TRUE WHERE recipient_id = $1 AND sender_id = $2',
      [req.user.id, otherId]
    );

    res.json({ messages: rows, otherId });
  } catch (err) { next(err); }
});

// Send a direct message
router.post('/send', authenticate, requireActiveStatus, async (req, res, next) => {
  try {
    const { recipientId, content } = req.body;
    if (!recipientId || !content?.trim()) return res.status(400).json({ error: 'Recipient and content required.' });
    const { rows } = await pool.query(
      `INSERT INTO direct_messages (sender_id, recipient_id, content) VALUES ($1,$2,$3) RETURNING *`,
      [req.user.id, recipientId, content.trim()]
    );
    res.status(201).json({ message: rows[0] });
  } catch (err) { next(err); }
});

module.exports = router;

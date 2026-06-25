const webpush = require('web-push');
const pool = require('../config/db');

// Configure VAPID keys (generate once: npx web-push generate-vapid-keys)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:' + (process.env.ADMIN_EMAIL || 'admin@gva.org'),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

// Store push subscription for a user
async function savePushSubscription(userId, subscription) {
  await pool.query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, updated_at)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (user_id) DO UPDATE SET endpoint=$2, p256dh=$3, auth=$4, updated_at=now()`,
    [userId, subscription.endpoint, subscription.keys?.p256dh, subscription.keys?.auth]
  );
}

// Send push to a single user
async function pushToUser(userId, payload) {
  try {
    const { rows } = await pool.query(
      'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );
    if (!rows.length) return;
    const sub = { endpoint: rows[0].endpoint, keys: { p256dh: rows[0].p256dh, auth: rows[0].auth } };
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch (err) {
    if (err.statusCode === 410) {
      // Subscription expired — remove it
      await pool.query('DELETE FROM push_subscriptions WHERE user_id = $1', [userId]).catch(() => {});
    } else {
      console.error('Push error for user', userId, ':', err.message);
    }
  }
}

// Broadcast push to all active members
async function pushToAll(payload) {
  const { rows } = await pool.query(
    `SELECT ps.user_id, ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN users u ON u.id = ps.user_id
     WHERE u.status = 'active'`
  );
  await Promise.allSettled(rows.map(row =>
    webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      JSON.stringify(payload)
    ).catch(err => {
      if (err.statusCode === 410) pool.query('DELETE FROM push_subscriptions WHERE user_id=$1', [row.user_id]).catch(() => {});
    })
  ));
}

function isConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

module.exports = { savePushSubscription, pushToUser, pushToAll, isConfigured };

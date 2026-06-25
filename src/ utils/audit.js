const pool = require('../config/db');

/**
 * Records an entry in audit_logs. Never throws — a logging failure
 * should never block the action it's describing.
 */
async function logAudit(actorUserId, action, targetType = null, targetId = null, details = null) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (actor_user_id, action, target_type, target_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [actorUserId, action, targetType, targetId, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = { logAudit };

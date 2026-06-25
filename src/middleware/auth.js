const { verifyAccessToken } = require('../utils/jwt');
const pool = require('../config/db');

/**
 * Verifies the bearer JWT and attaches the current user record to req.user.
 * Re-checks status against the database on every request so a suspension
 * takes effect immediately rather than waiting for the token to expire.
 */
async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Authentication required.' });
    }

    let payload;
    try {
      payload = verifyAccessToken(token);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
    }

    const { rows } = await pool.query(
      'SELECT id, email, role, status, must_change_password FROM users WHERE id = $1',
      [payload.sub]
    );
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Account no longer exists.' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    next(err);
  }
}

/** Restricts a route to one or more roles, e.g. authorize('super_admin', 'moderator') */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required.' });
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    next();
  };
}

/** Blocks expired/suspended members from member-only actions (e.g. chat, scholarships). */
function requireActiveStatus(req, res, next) {
  if (req.user.role !== 'member') return next(); // staff roles aren't subject to membership expiry
  if (req.user.status !== 'active') {
    return res.status(403).json({
      error: 'Your membership has expired. Please visit the organization for revalidation.',
    });
  }
  next();
}

module.exports = { authenticate, authorize, requireActiveStatus };


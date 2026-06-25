const crypto = require('crypto');

/**
 * Generates the next sequential Membership ID for the current year/month,
 * in the required format: GVA-ONLINE-YYYY-MM-XXX
 * Uses a row lock on system_settings to keep generation safe under concurrency.
 */
async function generateMembershipId(client) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const prefix = `GVA-ONLINE-${year}-${month}-`;

  // Lock to avoid two concurrent approvals generating the same number.
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [prefix]);

  const { rows } = await client.query(
    `SELECT membership_id FROM members
     WHERE membership_id LIKE $1
     ORDER BY membership_id DESC
     LIMIT 1`,
    [`${prefix}%`]
  );

  let nextSeq = 1;
  if (rows.length > 0) {
    const lastSeq = parseInt(rows[0].membership_id.slice(-3), 10);
    nextSeq = lastSeq + 1;
  }

  return `${prefix}${String(nextSeq).padStart(3, '0')}`;
}

function generateApplicationRef() {
  const year = new Date().getFullYear();
  const rand = crypto.randomInt(100000, 999999);
  return `GVA-APP-${year}-${rand}`;
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

module.exports = { generateMembershipId, generateApplicationRef, generateToken };

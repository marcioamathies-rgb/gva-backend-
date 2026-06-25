// Emergency admin password reset.
// Run from server shell: npm run resetAdmin
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function reset() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });
  const tempPassword = 'GVA-RESET-' + crypto.randomBytes(4).toString('hex').toUpperCase();
  const hash = await bcrypt.hash(tempPassword, 12);

  const { rows } = await pool.query(
    `UPDATE users SET password_hash=$1, must_change_password=TRUE, failed_login_attempts=0, locked_until=NULL
     WHERE role='super_admin'
     RETURNING email, (SELECT membership_id FROM members WHERE user_id=users.id) AS membership_id`,
    [hash]
  );

  if (!rows.length) {
    console.log('\nNo Super Admin found. Go to yoursite.com/?admin-setup=true to create one.\n');
  } else {
    console.log('\n================================================');
    console.log('  GVA SUPER ADMIN — TEMPORARY PASSWORD RESET');
    console.log('================================================');
    console.log('  Membership ID :', rows[0].membership_id || '(check your setup)');
    console.log('  Temp Password :', tempPassword);
    console.log('  Email         :', rows[0].email);
    console.log('================================================');
    console.log('  Log in immediately and change your password.\n');
  }
  await pool.end();
}

reset().catch(err => { console.error(err.message); process.exit(1); });

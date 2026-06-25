const bcrypt = require('bcrypt');

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10);

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function comparePassword(plainPassword, passwordHash) {
  return bcrypt.compare(plainPassword, passwordHash);
}

// Basic strength check: 8+ chars, at least one letter and one number.
function isPasswordStrongEnough(plainPassword) {
  if (typeof plainPassword !== 'string' || plainPassword.length < 8) return false;
  return /[A-Za-z]/.test(plainPassword) && /[0-9]/.test(plainPassword);
}

module.exports = { hashPassword, comparePassword, isPasswordStrongEnough };

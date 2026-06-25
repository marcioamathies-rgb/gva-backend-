// Runs schema.sql against DATABASE_URL. Safe to re-run (uses IF NOT EXISTS / ON CONFLICT).
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

async function migrate() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  const sqlPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  try {
    console.log('Running migration against', maskUrl(process.env.DATABASE_URL));
    await pool.query(sql);
    console.log('Migration complete.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

function maskUrl(url) {
  if (!url) return '(no DATABASE_URL set)';
  return url.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:****@');
}

migrate();

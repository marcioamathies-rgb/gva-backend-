const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  // Unexpected errors on idle clients shouldn't crash the process silently uncaught.
  console.error('Unexpected PostgreSQL pool error:', err);
});

module.exports = pool;

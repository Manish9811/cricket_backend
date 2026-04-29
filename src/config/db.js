const { Pool } = require('pg');

// Connection pool for Neon PostgreSQL (uses SSL by default)
// Neon requires SSL in all environments — never set ssl:false against Neon
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
  process.exit(-1);
});

// Thin wrapper: query returns rows directly
const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  if (process.env.NODE_ENV === 'development') {
    console.log(`[DB] ${Date.now() - start}ms | ${text.substring(0, 60)}`);
  }
  return res;
};

// Use for transactions: const client = await getClient(); await client.query(…); client.release()
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };

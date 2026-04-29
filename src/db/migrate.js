// Run: node src/db/migrate.js   (from the /server directory)
require('dotenv').config();      // load .env from current working dir (server/)

if (!process.env.DATABASE_URL) {
  console.error('\n[migrate] ERROR: DATABASE_URL is not set.');
  console.error('  1. Copy server/.env.example to server/.env');
  console.error('  2. Paste your Neon connection string into DATABASE_URL\n');
  process.exit(1);
}

const { Pool } = require('pg');
const fs   = require('fs');
const path = require('path');

// Create a one-off pool here so migrate.js doesn't depend on config/db.js
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  const sqlPath = path.join(__dirname, 'migrations', '001_schema.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('[migrate] Connecting to Neon…');
  const client = await pool.connect();
  try {
    console.log('[migrate] Running schema migration…');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[migrate] ✓ Migration completed successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[migrate] ✗ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();

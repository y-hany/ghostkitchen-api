// db/pool.js
// One shared PostgreSQL connection pool for the whole app.
// Every route file imports this and calls pool.query(sql, [params]).
'use strict';
require('dotenv').config();
const { Pool } = require('pg');

// If connection string is pointing to Supabase pooler on 5432 (session mode),
// switch to 6543 (transaction mode) to avoid EMAXCONNSESSION limits.
let connStr = process.env.DATABASE_URL || '';
if (connStr.includes('pooler.supabase.com:5432')) {
  connStr = connStr.replace(':5432', ':6543');
}

const pool = new Pool({
  connectionString: connStr,
  // Supabase requires SSL; rejectUnauthorized:false accepts Supabase's cert
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

// Fail loudly on startup if the connection string is missing
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set in .env');
  process.exit(1);
}

module.exports = pool;

// db/pool.js
// One shared PostgreSQL connection pool for the whole app.
// Every route file imports this and calls pool.query(sql, [params]).
'use strict';
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase requires SSL; rejectUnauthorized:false accepts Supabase's cert
  ssl: { rejectUnauthorized: false },
  // Keep at most 10 open connections (Supabase free tier limit)
  max: 10,
});

// Fail loudly on startup if the connection string is missing
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set in .env');
  process.exit(1);
}

module.exports = pool;

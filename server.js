// server.js — entry point
// Loads env, sets up Express, mounts all routes, starts the HTTP server.
'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');

const app = express();

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow only your Vercel front-end (and localhost for development).
// Set FRONTEND_URL in .env.  Multiple origins can be comma-separated.
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5500')
  .split(',')
  .map(s => s.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, curl) or file:/// (origin === 'null') during dev
    if (!origin || allowedOrigins.includes(origin) || origin === 'null') return callback(null, true);
    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api',         require('./routes/auth'));
app.use('/api/kitchens',require('./routes/kitchens'));
app.use('/api/slots',   require('./routes/slots'));
app.use('/api/bookings',require('./routes/bookings'));
app.use('/api/events',  require('./routes/events'));
app.use('/api/tickets', require('./routes/tickets'));
app.use('/api/admin',   require('./routes/admin'));

// ── Health check (Render pings this to know the service is alive) ─────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found.' }));

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'An unexpected error occurred.' });
});

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT, 10) || 3000;
app.listen(PORT, () => {
  console.log(`GhostKitchen API listening on port ${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(', ')}`);
});

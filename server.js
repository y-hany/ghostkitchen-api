// server.js — entry point
// Loads env, sets up Express, mounts all routes, starts the HTTP server.
'use strict';
require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

// ── Serve static front-end assets ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow requests from all origins (Vercel deployment, localhost, phone, etc.)
app.use(cors({
  origin: true,
  credentials: true,
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

// ── Fallback handler ─────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Route not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(err.status || 500).json({ error: err.message || 'An unexpected error occurred.' });
});

// ── Start server (locally) or export (for Vercel) ───────────────────────────
if (process.env.VERCEL !== '1') {
  const PORT = parseInt(process.env.PORT, 10) || 3000;
  app.listen(PORT, () => {
    console.log(`GhostKitchen API listening on port ${PORT}`);
    console.log('CORS enabled for all origins');
  });
}

module.exports = app;

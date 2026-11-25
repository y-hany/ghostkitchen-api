// server.js — entry point with hardened security, CSP, CORS, and rate limiting
'use strict';
require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');
const path      = require('path');

const app = express();

// ── Reverse Proxy & IP Resolution ─────────────────────────────────────────────
// Tells Express to trust X-Forwarded-* headers when behind Vercel or Render proxies
app.set('trust proxy', 1);

// ── Security Headers via Helmet ───────────────────────────────────────────────
app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
      connectSrc: [
        "'self'",
        'https://ghostkitchen-api.vercel.app',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5500',
      ],
      frameAncestors: ["'none'"], // Strict anti-clickjacking protection
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  frameguard: { action: 'deny' },
  noSniff: true,
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://ghostkitchen-api.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

const VERCEL_PREVIEW_RE = /^https:\/\/ghostkitchen-api-[a-z0-9-]+-y-hany\.vercel\.app$/;
const LOCALHOST_RE      = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

app.use(cors({
  origin: (origin, callback) => {
    // Non-browser or server-side clients (curl, mobile apps) have no origin
    if (!origin) return callback(null, true);
    if (
      ALLOWED_ORIGINS.includes(origin) ||
      VERCEL_PREVIEW_RE.test(origin) ||
      (process.env.NODE_ENV !== 'production' && LOCALHOST_RE.test(origin))
    ) {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy: Origin unauthorized.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400,
}));

// ── Rate Limiting (DoS & Brute-Force Safeguards) ──────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts from this IP. Please try again after 15 minutes.' },
});

const ticketLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 40, // 40 seat reservations per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reservation attempts. Please try again shortly.' },
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // 500 general API requests per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many API requests from this IP. Please slow down.' },
});

// ── Body parsing with size limit & JSON syntax error guard ────────────────────
app.use(express.json({ limit: '10kb' }));
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload.' });
  }
  next(err);
});

// ── Serve static front-end assets ─────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
    }
  }
}));

// ── Apply Rate Limiters ───────────────────────────────────────────────────────
app.use('/api/login',      authLimiter);
app.use('/api/register',   authLimiter);
app.use('/api/demo-login', authLimiter);
app.use('/api/tickets',    ticketLimiter);
app.use('/api',            apiLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api',          require('./routes/auth'));
app.use('/api/kitchens', require('./routes/kitchens'));
app.use('/api/slots',    require('./routes/slots'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/events',   require('./routes/events'));
app.use('/api/tickets',  require('./routes/tickets'));
app.use('/api/admin',    require('./routes/admin'));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', secure: true }));

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
  if (err.message && err.message.includes('Blocked by CORS')) {
    return res.status(403).json({ error: err.message });
  }
  console.error('Unhandled server error:', err);
  res.status(err.status || 500).json({ error: err.message || 'An unexpected error occurred.' });
});

// ── Start server (locally) or export (for Vercel) ───────────────────────────
if (process.env.VERCEL !== '1' && require.main === module) {
  const PORT = parseInt(process.env.PORT, 10) || 3000;
  app.listen(PORT, () => {
    console.log(`GhostKitchen API running securely on port ${PORT}`);
    console.log('Security headers, Helmet CSP, CORS, and Rate-Limiting enabled.');
  });
}

module.exports = app;

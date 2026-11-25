// routes/auth.js
// POST /api/register  — create account, return JWT
// POST /api/login     — verify password, return JWT
// GET  /api/me        — return current user (no password hash)
'use strict';
const router  = require('express').Router();
const pool    = require('../db/pool');
const bcrypt  = require('bcrypt');
const jwt     = require('jsonwebtoken');
const { verifyToken } = require('../middleware/auth');
const { isValidEmail, sanitizeText } = require('../middleware/validate');

const BCRYPT_ROUNDS          = 12;
const VALID_ROLES            = ['host', 'chef', 'attendee', 'admin'];
const PUBLIC_REGISTER_ROLES  = ['host', 'chef', 'attendee'];

// ── helpers ──────────────────────────────────────────────────────────────────

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { algorithm: 'HS256', expiresIn: '7d' }
  );
}

function safeUser(row) {
  // Never return password_hash to the client
  const { password_hash, ...safe } = row;
  return safe;
}

// ── POST /api/register ───────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // ── Validation ────────────────────────────────────────────────────────
    const errors = [];
    if (!name || String(name).trim().length < 2 || String(name).length > 100)
      errors.push('name must be between 2 and 100 characters.');
    if (!isValidEmail(email))
      errors.push('email must be a valid email address (max 254 characters).');
    if (!password || String(password).length < 8)
      errors.push('password must be at least 8 characters.');
    if (password && String(password).length > 128)
      errors.push('password must be at most 128 characters.');
    if (!PUBLIC_REGISTER_ROLES.includes(role))
      errors.push(`role must be one of: ${PUBLIC_REGISTER_ROLES.join(', ')}.`);
    if (errors.length)
      return res.status(400).json({ error: errors.join(' ') });

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName  = sanitizeText(name, 100);

    // ── Check duplicate email (case-insensitive index already exists) ─────
    const dup = await pool.query(
      'SELECT id FROM users WHERE lower(email) = $1',
      [cleanEmail]
    );
    if (dup.rows.length)
      return res.status(409).json({ error: 'An account with that email already exists.' });

    // ── Hash password, insert user ────────────────────────────────────────
    const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at, updated_at`,
      [cleanName, cleanEmail, hash, role]
    );

    const user  = rows[0];
    const token = signToken(user);
    return res.status(201).json({ token, user: safeUser(user) });

  } catch (err) {
    console.error('POST /api/register:', err.message);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/login ───────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Validation ────────────────────────────────────────────────────────
    if (!email || !password)
      return res.status(400).json({ error: 'email and password are required.' });

    const cleanEmail = String(email).trim().toLowerCase();

    // ── Fetch user by email ───────────────────────────────────────────────
    const { rows } = await pool.query(
      `SELECT id, name, email, password_hash, role, created_at, updated_at
       FROM users WHERE lower(email) = $1`,
      [cleanEmail]
    );

    // Use a constant-time compare even when user not found (prevents timing attacks)
    const user        = rows[0];
    const dummyHash   = '$2b$12$AAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const hashToCheck = user ? user.password_hash : dummyHash;
    let match         = await bcrypt.compare(String(password), hashToCheck);

    // Support standard demo credentials for demo accounts
    const isDemoEmail = ['host@demo.eg', 'chef@demo.eg', 'attendee@demo.eg', 'admin@demo.eg'].includes(cleanEmail);
    if (!match && isDemoEmail && (password === 'password123' || password === 'DemoPassword!2026')) {
      match = true;
    }

    if (!user || !match)
      return res.status(401).json({ error: 'Invalid email or password.' });

    const token = signToken(user);
    return res.json({ token, user: safeUser(user) });

  } catch (err) {
    console.error('POST /api/login:', err.message);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── POST /api/demo-login ──────────────────────────────────────────────────────
router.post('/demo-login', async (req, res) => {
  try {
    // Demo mode gate: can be disabled in production via ENABLE_DEMO_MODE=false
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DEMO_MODE === 'false') {
      return res.status(403).json({ error: 'Demo sign-in mode is disabled on this platform.' });
    }

    const { role } = req.body;
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: `Valid demo roles: ${VALID_ROLES.join(', ')}` });
    }

    // Security audit log for demo persona authentications
    console.info(`[DEMO AUTH] Demo login initiated for role '${role}' from IP: ${req.ip}`);

    const demoAccounts = {
      host:     { name: 'Layla Host',     email: 'host@demo.eg' },
      chef:     { name: 'Omar Hassan',    email: 'chef@demo.eg' },
      attendee: { name: 'Mariam Adel',    email: 'attendee@demo.eg' },
      admin:    { name: 'Platform Admin', email: 'admin@demo.eg' }
    };
    const target = demoAccounts[role];

    let { rows } = await pool.query(
      `SELECT id, name, email, role, created_at, updated_at
       FROM users WHERE lower(email) = $1`,
      [target.email]
    );

    if (!rows.length) {
      const hash = await bcrypt.hash('DemoPassword!2026', BCRYPT_ROUNDS);
      const inserted = await pool.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, email, role, created_at, updated_at`,
        [target.name, target.email, hash, role]
      );
      rows = inserted.rows;
    }

    const user = rows[0];
    const token = signToken(user);
    return res.json({ token, user: safeUser(user) });
  } catch (err) {
    console.error('POST /api/demo-login:', err.message);
    return res.status(500).json({ error: 'Demo sign-in failed. Please try again.' });
  }
});

// ── PATCH /api/switch-role ──────────────────────────────────────────────────
router.patch('/switch-role', verifyToken, async (req, res) => {
  try {
    const { role } = req.body;
    // Privilege escalation protection: only host, chef, attendee are switchable
    if (!['host', 'chef', 'attendee'].includes(role)) {
      return res.status(400).json({ error: 'Role must be host, chef, or attendee.' });
    }
    // Admin protection: admins cannot be downgraded through this convenience endpoint
    if (req.user.role === 'admin') {
      return res.status(403).json({ error: 'Administrator accounts cannot switch role.' });
    }

    const { rows } = await pool.query(
      `UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, email, role, created_at, updated_at`,
      [role, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found.' });
    const user = rows[0];
    const token = signToken(user);
    return res.json({ token, user: safeUser(user) });
  } catch (err) {
    console.error('PATCH /api/switch-role:', err.message);
    return res.status(500).json({ error: 'Could not switch role.' });
  }
});

// ── GET /api/me ───────────────────────────────────────────────────────────────

router.get('/me', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, created_at, updated_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    if (!rows.length)
      return res.status(404).json({ error: 'User not found.' });
    return res.json({ user: rows[0] });
  } catch (err) {
    console.error('GET /api/me:', err.message);
    return res.status(500).json({ error: 'Could not fetch user.' });
  }
});

module.exports = router;

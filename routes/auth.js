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

const BCRYPT_ROUNDS = 12;
const VALID_ROLES   = ['host', 'chef', 'attendee', 'admin'];

// ── helpers ──────────────────────────────────────────────────────────────────

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
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
    if (!name || String(name).trim().length < 2)
      errors.push('name must be at least 2 characters.');
    if (!email || !/^\S+@\S+\.\S+$/.test(String(email).trim()))
      errors.push('email must be a valid address.');
    if (!password || String(password).length < 8)
      errors.push('password must be at least 8 characters.');
    if (!VALID_ROLES.includes(role))
      errors.push(`role must be one of: ${VALID_ROLES.join(', ')}.`);
    if (errors.length)
      return res.status(400).json({ error: errors.join(' ') });

    const cleanEmail = String(email).trim().toLowerCase();
    const cleanName  = String(name).trim();

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
    const match       = await bcrypt.compare(String(password), hashToCheck);

    if (!user || !match)
      return res.status(401).json({ error: 'Invalid email or password.' });

    const token = signToken(user);
    return res.json({ token, user: safeUser(user) });

  } catch (err) {
    console.error('POST /api/login:', err.message);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
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

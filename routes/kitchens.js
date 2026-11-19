// routes/kitchens.js
//
// GET    /api/kitchens               — list kitchens (verified only for public; all for host/admin)
// GET    /api/kitchens/:id           — single kitchen with its slots
// POST   /api/kitchens               — host creates a kitchen (pending verification)
// PATCH  /api/kitchens/:id/verify    — admin verifies a kitchen
// PATCH  /api/kitchens/:id/reject    — admin rejects a kitchen
// PATCH  /api/kitchens/:id/revoke    — admin revokes verification back to pending
'use strict';
const router = require('express').Router();
const pool   = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateUUID, sanitizeText } = require('../middleware/validate');

// ── GET /api/kitchens ─────────────────────────────────────────────────────────
// Public guests + attendees see only verified kitchens.
// Hosts see their own kitchens regardless of status.
// Admins see everything.
router.get('/', async (req, res) => {
  try {
    // Parse optional equipment filter: ?equipment=Walk-in+fridge,Gas+range
    const rawEquip  = req.query.equipment;
    const equipFilter = rawEquip
      ? rawEquip.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    // Determine caller role from token (optional on this route)
    let callerRole = 'guest';
    let callerId   = null;
    const header = (req.headers.authorization || '').replace('Bearer ', '');
    if (header) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(header, process.env.JWT_SECRET);
        callerRole = decoded.role;
        callerId   = decoded.id;
      } catch { /* expired / invalid — treat as guest */ }
    }

    let sql;
    let params = [];

    if (callerRole === 'admin') {
      // Admin: all kitchens
      sql = `SELECT k.*, u.name AS host_name
             FROM kitchens k
             JOIN users u ON u.id = k.host_id`;
      if (equipFilter.length) {
        sql += ` WHERE k.equipment @> $1::text[]`;
        params = [equipFilter];
      }
    } else {
      // Public / host / chef / attendee browsing marketplace: verified only
      sql = `SELECT k.*, u.name AS host_name
             FROM kitchens k
             JOIN users u ON u.id = k.host_id
             WHERE k.verification_status = 'verified'`;
      if (equipFilter.length) {
        sql += ` AND k.equipment @> $1::text[]`;
        params = [equipFilter];
      }
    }

    sql += ` ORDER BY k.created_at DESC`;
    const { rows } = await pool.query(sql, params);
    return res.json({ kitchens: rows });

  } catch (err) {
    console.error('GET /api/kitchens:', err.message);
    return res.status(500).json({ error: 'Could not fetch kitchens.' });
  }
});

// ── GET /api/kitchens/mine ────────────────────────────────────────────────────
router.get('/mine', verifyToken, requireRole('host'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT k.*, u.name AS host_name
       FROM kitchens k
       JOIN users u ON u.id = k.host_id
       WHERE k.host_id = $1
       ORDER BY k.created_at DESC`,
      [req.user.id]
    );
    return res.json({ kitchens: rows });
  } catch (err) {
    console.error('GET /api/kitchens/mine:', err.message);
    return res.status(500).json({ error: 'Could not fetch your kitchens.' });
  }
});

// ── GET /api/kitchens/:id ──────────────────────────────────────────────────────
router.get('/:id', validateUUID(), async (req, res) => {
  try {
    const { rows: kRows } = await pool.query(
      `SELECT k.*, u.name AS host_name
       FROM kitchens k
       JOIN users u ON u.id = k.host_id
       WHERE k.id = $1`,
      [req.params.id]
    );
    if (!kRows.length)
      return res.status(404).json({ error: 'Kitchen not found.' });

    const kitchen = kRows[0];

    // Data protection: unverified/rejected kitchens only accessible to owner host or admin
    if (kitchen.verification_status !== 'verified') {
      let isAuthorized = false;
      const header = (req.headers.authorization || '').replace('Bearer ', '');
      if (header) {
        try {
          const jwt = require('jsonwebtoken');
          const decoded = jwt.verify(header, process.env.JWT_SECRET, { algorithms: ['HS256'] });
          if (decoded.role === 'admin' || decoded.id === kitchen.host_id) {
            isAuthorized = true;
          }
        } catch {}
      }
      if (!isAuthorized) {
        return res.status(404).json({ error: 'Kitchen not found.' });
      }
    }

    const { rows: slots } = await pool.query(
      `SELECT id, start_time, end_time, status, created_at, updated_at
       FROM slots WHERE kitchen_id = $1 ORDER BY start_time`,
      [req.params.id]
    );

    return res.json({ kitchen, slots });
  } catch (err) {
    console.error('GET /api/kitchens/:id:', err.message);
    return res.status(500).json({ error: 'Could not fetch kitchen.' });
  }
});

// ── POST /api/kitchens ─────────────────────────────────────────────────────────
router.post('/', verifyToken, requireRole('host'), async (req, res) => {
  try {
    const { name, address, license_info, hourly_rate, equipment } = req.body;

    // Validate lengths and bounds
    const errors = [];
    if (!name || String(name).trim().length < 4 || String(name).length > 120)
      errors.push('Kitchen name must be between 4 and 120 characters.');
    if (!address || String(address).trim().length < 8 || String(address).length > 250)
      errors.push('Full street address and district must be between 8 and 250 characters.');
    if (!license_info || String(license_info).trim().length < 4 || String(license_info).length > 100)
      errors.push('MOH commercial permit number is required (4–100 characters).');

    const rate = parseFloat(hourly_rate);
    if (isNaN(rate) || rate < 150 || rate > 50000)
      errors.push('Hourly rate must be between 150 and 50,000 EGP/hour.');
    if (errors.length)
      return res.status(400).json({ error: errors.join(' ') });

    // Equipment validation and sanitization (max 30 items, each max 80 chars)
    let equip = [];
    if (Array.isArray(equipment)) {
      equip = equipment
        .slice(0, 30)
        .map(s => sanitizeText(String(s), 80))
        .filter(Boolean);
    }

    const cleanName = sanitizeText(name, 120);
    const cleanAddr = sanitizeText(address, 250);
    const cleanLic  = sanitizeText(license_info, 100);

    const { rows } = await pool.query(
      `INSERT INTO kitchens (host_id, name, address, license_info, hourly_rate, equipment, verification_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [req.user.id, cleanName, cleanAddr, cleanLic, rate, equip]
    );
    return res.status(201).json({ kitchen: rows[0] });

  } catch (err) {
    console.error('POST /api/kitchens:', err.message);
    return res.status(500).json({ error: 'Could not create kitchen.' });
  }
});

// ── Admin-only status changes ──────────────────────────────────────────────────
async function setVerification(req, res, status) {
  try {
    const { rows } = await pool.query(
      `UPDATE kitchens
       SET verification_status = $1,
           verified_by = CASE WHEN $1 = 'verified' THEN $3::uuid ELSE NULL END,
           verified_at = CASE WHEN $1 = 'verified' THEN NOW() ELSE NULL END
       WHERE id = $2
       RETURNING *`,
      [status, req.params.id, req.user.id]
    );
    if (!rows.length)
      return res.status(404).json({ error: 'Kitchen not found.' });
    return res.json({ kitchen: rows[0] });
  } catch (err) {
    console.error(`PATCH /api/kitchens/:id/${status}:`, err.message);
    return res.status(500).json({ error: 'Could not update kitchen status.' });
  }
}

router.patch('/:id/verify',  verifyToken, requireRole('admin'), validateUUID(), (req, res) => setVerification(req, res, 'verified'));
router.patch('/:id/reject',  verifyToken, requireRole('admin'), validateUUID(), (req, res) => setVerification(req, res, 'rejected'));
router.patch('/:id/revoke',  verifyToken, requireRole('admin'), validateUUID(), (req, res) => setVerification(req, res, 'pending'));

module.exports = router;

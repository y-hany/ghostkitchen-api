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
router.get('/:id', async (req, res) => {
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

    const { rows: slots } = await pool.query(
      `SELECT id, start_time, end_time, status, created_at, updated_at
       FROM slots WHERE kitchen_id = $1 ORDER BY start_time`,
      [req.params.id]
    );

    return res.json({ kitchen: kRows[0], slots });
  } catch (err) {
    console.error('GET /api/kitchens/:id:', err.message);
    return res.status(500).json({ error: 'Could not fetch kitchen.' });
  }
});

// ── POST /api/kitchens ─────────────────────────────────────────────────────────
router.post('/', verifyToken, requireRole('host'), async (req, res) => {
  try {
    const { name, address, license_info, hourly_rate, equipment } = req.body;

    // Validate
    const errors = [];
    if (!name || String(name).trim().length < 2)       errors.push('name is required (min 2 chars).');
    if (!address || String(address).trim().length < 5)  errors.push('address is required.');
    if (!license_info || String(license_info).trim().length < 2) errors.push('license_info is required.');
    const rate = parseFloat(hourly_rate);
    if (isNaN(rate) || rate <= 0) errors.push('hourly_rate must be a positive number.');
    if (errors.length)
      return res.status(400).json({ error: errors.join(' ') });

    // equipment is an optional array of strings
    const equip = Array.isArray(equipment) ? equipment.map(String) : [];

    const { rows } = await pool.query(
      `INSERT INTO kitchens (host_id, name, address, license_info, hourly_rate, equipment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, name.trim(), address.trim(), license_info.trim(), rate, equip]
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
    const extra = status === 'verified'
      ? `, verified_by = $3, verified_at = now()`
      : `, verified_by = NULL, verified_at = NULL`;

    const params = status === 'verified'
      ? [status, req.params.id, req.user.id]
      : [status, req.params.id];

    const { rows } = await pool.query(
      `UPDATE kitchens SET verification_status = $1 ${extra}
       WHERE id = $2 RETURNING *`,
      params
    );
    if (!rows.length)
      return res.status(404).json({ error: 'Kitchen not found.' });
    return res.json({ kitchen: rows[0] });
  } catch (err) {
    console.error(`PATCH /api/kitchens/:id/${status}:`, err.message);
    return res.status(500).json({ error: 'Could not update kitchen status.' });
  }
}

router.patch('/:id/verify',  verifyToken, requireRole('admin'), (req, res) => setVerification(req, res, 'verified'));
router.patch('/:id/reject',  verifyToken, requireRole('admin'), (req, res) => setVerification(req, res, 'rejected'));
router.patch('/:id/revoke',  verifyToken, requireRole('admin'), (req, res) => setVerification(req, res, 'pending'));

module.exports = router;

// routes/slots.js
//
// GET  /api/slots?kitchen_id=<uuid>   — list slots for a kitchen
// POST /api/slots                     — host adds a slot to their kitchen
'use strict';
const router = require('express').Router();
const pool   = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateUUID } = require('../middleware/validate');

// ── GET /api/slots?kitchen_id=... ─────────────────────────────────────────────
router.get('/', validateUUID('kitchen_id'), async (req, res) => {
  try {
    const { kitchen_id } = req.query;
    let rows;
    if (kitchen_id) {
      const result = await pool.query(
        `SELECT id, kitchen_id, start_time, end_time, status, created_at, updated_at
         FROM slots WHERE kitchen_id = $1 ORDER BY start_time`,
        [kitchen_id]
      );
      rows = result.rows;
    } else {
      const result = await pool.query(
        `SELECT id, kitchen_id, start_time, end_time, status, created_at, updated_at
         FROM slots WHERE status = 'open' AND end_time > NOW() ORDER BY start_time`
      );
      rows = result.rows;
    }
    return res.json({ slots: rows });
  } catch (err) {
    console.error('GET /api/slots:', err.message);
    return res.status(500).json({ error: 'Could not fetch slots.' });
  }
});

// ── POST /api/slots ───────────────────────────────────────────────────────────
router.post('/', verifyToken, requireRole('host'), validateUUID('kitchen_id'), async (req, res) => {
  try {
    const { kitchen_id, start_time, end_time } = req.body;

    // Validate presence
    const errors = [];
    if (!kitchen_id)  errors.push('kitchen_id is required.');
    if (!start_time)  errors.push('start_time is required (ISO 8601).');
    if (!end_time)    errors.push('end_time is required (ISO 8601).');
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    // Validate date values
    const start = new Date(start_time);
    const end   = new Date(end_time);
    if (isNaN(start.getTime())) return res.status(400).json({ error: 'start_time is not a valid date.' });
    if (isNaN(end.getTime()))   return res.status(400).json({ error: 'end_time is not a valid date.' });
    if (end <= start)           return res.status(400).json({ error: 'end_time must be after start_time.' });

    // Enforce future time
    if (start < new Date()) {
      return res.status(400).json({ error: 'Shift slot start time must be in the future.' });
    }

    // Enforce reasonable shift duration (minimum 1 hour, maximum 24 hours)
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (durationHours < 1) {
      return res.status(400).json({ error: 'Shift slot duration must be at least 1 hour.' });
    }
    if (durationHours > 24) {
      return res.status(400).json({ error: 'Shift slot duration cannot exceed 24 hours.' });
    }

    // Confirm the kitchen belongs to the calling host and is not rejected
    const { rows: kRows } = await pool.query(
      'SELECT id, verification_status FROM kitchens WHERE id = $1 AND host_id = $2',
      [kitchen_id, req.user.id]
    );
    if (!kRows.length)
      return res.status(403).json({ error: 'Kitchen not found or does not belong to you.' });

    // Check for overlapping shift slots in this kitchen
    const { rows: overlap } = await pool.query(
      `SELECT id FROM slots
       WHERE kitchen_id = $1
         AND NOT (end_time <= $2 OR start_time >= $3)
       LIMIT 1`,
      [kitchen_id, start.toISOString(), end.toISOString()]
    );
    if (overlap.length) {
      return res.status(409).json({ error: 'A shift slot already exists that overlaps with this time range.' });
    }

    const { rows } = await pool.query(
      `INSERT INTO slots (kitchen_id, start_time, end_time)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [kitchen_id, start.toISOString(), end.toISOString()]
    );
    return res.status(201).json({ slot: rows[0] });

  } catch (err) {
    console.error('POST /api/slots:', err.message);
    return res.status(500).json({ error: 'Could not create slot.' });
  }
});

module.exports = router;

// routes/tickets.js
//
// GET  /api/tickets      — attendee's own tickets (what tickets.html displays)
// POST /api/tickets      — attendee reserves seats at an event
'use strict';
const router = require('express').Router();
const pool   = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');

// ── GET /api/tickets ──────────────────────────────────────────────────────────
// Returns everything tickets.html needs in one query:
//   ref_no, event title, starts_at, kitchen name + address,
//   quantity, unit_price, total_price
router.get('/', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         t.id,
         t.ref_no,
         t.quantity,
         t.unit_price,
         t.total_price,
         t.created_at,
         e.id          AS event_id,
         e.title       AS event_title,
         e.starts_at,
         k.name        AS kitchen_name,
         k.address     AS kitchen_address,
         s.start_time,
         s.end_time,
         u.name        AS chef_name
       FROM tickets  t
       JOIN events   e ON e.id  = t.event_id
       JOIN bookings b ON b.id  = e.booking_id
       JOIN slots    s ON s.id  = b.slot_id
       JOIN kitchens k ON k.id  = s.kitchen_id
       JOIN users    u ON u.id  = b.chef_id
       WHERE t.attendee_id = $1
       ORDER BY t.created_at DESC`,
      [req.user.id]
    );
    return res.json({ tickets: rows });
  } catch (err) {
    console.error('GET /api/tickets:', err.message);
    return res.status(500).json({ error: 'Could not fetch your tickets.' });
  }
});

// ── POST /api/tickets ─────────────────────────────────────────────────────────
// The DB trigger (trg_tickets_before_write) handles:
//   - setting unit_price from events.ticket_price
//   - capacity check (raises exception if sold out)
router.post('/', verifyToken, requireRole('attendee'), async (req, res) => {
  try {
    const { event_id, quantity } = req.body;

    // Validate
    const errors = [];
    if (!event_id) errors.push('event_id is required.');
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) errors.push('quantity must be at least 1.');
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    // Event must exist and its booking must be approved
    const { rows: evRows } = await pool.query(
      `SELECT e.id, e.capacity, b.status AS booking_status
       FROM events e
       JOIN bookings b ON b.id = e.booking_id
       WHERE e.id = $1`,
      [event_id]
    );
    if (!evRows.length)
      return res.status(404).json({ error: 'Event not found.' });
    if (evRows[0].booking_status !== 'approved')
      return res.status(400).json({ error: 'That event is not yet live (booking not approved).' });

    // Insert — the DB trigger fills unit_price and enforces capacity
    const { rows } = await pool.query(
      `INSERT INTO tickets (event_id, attendee_id, quantity)
       VALUES ($1, $2, $3)
       RETURNING id, ref_no, event_id, attendee_id, quantity, unit_price, total_price, created_at`,
      [event_id, req.user.id, qty]
    );
    return res.status(201).json({ ticket: rows[0] });

  } catch (err) {
    // Surface the DB trigger's "Not enough seats left" message
    if (err.message && err.message.includes('Not enough seats'))
      return res.status(409).json({ error: 'Not enough seats left for this event.' });
    console.error('POST /api/tickets:', err.message);
    return res.status(500).json({ error: 'Could not reserve tickets.' });
  }
});

module.exports = router;

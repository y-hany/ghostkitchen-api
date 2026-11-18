// routes/tickets.js
//
// GET   /api/tickets              — attendee's own tickets (what tickets.html displays)
// POST  /api/tickets              — attendee reserves seats at an event
// PATCH /api/tickets/:id/checkin  — chef toggles door check-in for a ticket
'use strict';
const router = require('express').Router();
const pool   = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');

// ── GET /api/tickets ──────────────────────────────────────────────────────────
// Returns everything tickets.html needs in one query:
//   ref_no, event title, starts_at, kitchen name + address,
//   quantity, unit_price, total_price, dietary_notes, checked_in
router.get('/', verifyToken, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         t.id,
         t.ref_no,
         t.quantity,
         t.unit_price,
         t.total_price,
         t.dietary_notes,
         t.checked_in,
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
  const client = await pool.connect();
  try {
    const { event_id, quantity, dietary_notes } = req.body;

    // Validate
    const errors = [];
    if (!event_id) errors.push('event_id is required.');
    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) errors.push('quantity must be at least 1.');
    if (errors.length) return res.status(400).json({ error: errors.join(' ') });

    await client.query('BEGIN');

    // Event must exist and its booking must be approved (FOR UPDATE lock)
    const { rows: evRows } = await client.query(
      `SELECT e.id, e.capacity, e.ticket_price, b.status AS booking_status
       FROM events e
       JOIN bookings b ON b.id = e.booking_id
       WHERE e.id = $1
       FOR UPDATE`,
      [event_id]
    );
    if (!evRows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Event not found.' });
    }
    if (evRows[0].booking_status !== 'approved') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'That event is not yet live (booking not approved).' });
    }

    const cleanNotes = dietary_notes ? String(dietary_notes).trim().slice(0, 300) : null;

    // Insert — the DB trigger fills unit_price and enforces capacity
    const { rows } = await client.query(
      `INSERT INTO tickets (event_id, attendee_id, quantity, dietary_notes)
       VALUES ($1, $2, $3, $4)
       RETURNING id, ref_no, event_id, attendee_id, quantity, unit_price, total_price, dietary_notes, created_at`,
      [event_id, req.user.id, qty, cleanNotes]
    );

    await client.query('COMMIT');
    return res.status(201).json({ ticket: rows[0] });

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    // Surface the DB trigger's "Not enough seats left" message
    if (err.message && err.message.includes('Not enough seats'))
      return res.status(409).json({ error: 'Not enough seats left for this event.' });
    console.error('POST /api/tickets:', err.message);
    return res.status(500).json({ error: 'Could not reserve tickets.' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/tickets/:id/checkin ───────────────────────────────────────────
router.patch('/:id/checkin', verifyToken, async (req, res) => {
  try {
    const { rows: tRows } = await pool.query(
      `SELECT t.id, t.checked_in, b.chef_id
       FROM tickets t
       JOIN events e ON e.id = t.event_id
       JOIN bookings b ON b.id = e.booking_id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (!tRows.length) return res.status(404).json({ error: 'Ticket pass not found.' });
    if (tRows[0].chef_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the hosting chef can check in guests.' });
    }

    const nextState = !tRows[0].checked_in;
    const { rows } = await pool.query(
      `UPDATE tickets
       SET checked_in = $1, checked_in_at = ${nextState ? 'NOW()' : 'NULL'}
       WHERE id = $2
       RETURNING *`,
      [nextState, req.params.id]
    );
    return res.json({ ticket: rows[0] });
  } catch (err) {
    console.error('PATCH /api/tickets/:id/checkin:', err.message);
    return res.status(500).json({ error: 'Could not update door check-in.' });
  }
});

module.exports = router;

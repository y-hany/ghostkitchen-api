// routes/events.js
//
// GET  /api/events          — public: approved pop-up events with seats-left count
// GET  /api/events/mine     — chef: own events (all statuses)
// POST /api/events          — chef publishes an event on an approved or pending booking
'use strict';
const router = require('express').Router();
const pool   = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');

// ── GET /api/events/mine ──────────────────────────────────────────────────────
// Must be declared BEFORE /:id to avoid "mine" being treated as a UUID
router.get('/mine', verifyToken, requireRole('chef'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.*,
              b.status AS booking_status,
              b.booking_no,
              s.start_time, s.end_time,
              k.name AS kitchen_name, k.address,
              COALESCE(SUM(t.quantity), 0)::int AS seats_sold
       FROM events e
       JOIN bookings b ON b.id = e.booking_id
       JOIN slots    s ON s.id = b.slot_id
       JOIN kitchens k ON k.id = s.kitchen_id
       LEFT JOIN tickets t ON t.event_id = e.id
       WHERE b.chef_id = $1
       GROUP BY e.id, b.id, s.id, k.id
       ORDER BY e.created_at DESC`,
      [req.user.id]
    );
    return res.json({ events: rows });
  } catch (err) {
    console.error('GET /api/events/mine:', err.message);
    return res.status(500).json({ error: 'Could not fetch your events.' });
  }
});

// ── GET /api/events ───────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT e.id, e.title, e.menu_description, e.ticket_price, e.capacity,
              e.starts_at, e.created_at,
              b.booking_no, b.status AS booking_status,
              s.start_time, s.end_time,
              k.id AS kitchen_id, k.name AS kitchen_name, k.address,
              u.name AS chef_name,
              COALESCE(SUM(t.quantity), 0)::int AS seats_sold,
              (e.capacity - COALESCE(SUM(t.quantity), 0))::int AS seats_left
       FROM events e
       JOIN bookings b ON b.id = e.booking_id
       JOIN slots    s ON s.id = b.slot_id
       JOIN kitchens k ON k.id = s.kitchen_id
       JOIN users    u ON u.id = b.chef_id
       LEFT JOIN tickets t ON t.event_id = e.id
       WHERE b.status = 'approved' AND (e.verification_status = 'verified' OR e.verification_status IS NULL)
       GROUP BY e.id, b.id, s.id, k.id, u.id
       ORDER BY e.starts_at ASC NULLS LAST, e.created_at DESC`
    );
    return res.json({ events: rows });
  } catch (err) {
    console.error('GET /api/events:', err.message);
    return res.status(500).json({ error: 'Could not fetch events.' });
  }
});

// ── POST /api/events ──────────────────────────────────────────────────────────
router.post('/', verifyToken, requireRole('chef'), async (req, res) => {
  try {
    const { booking_id, title, menu_description, ticket_price, capacity, starts_at } = req.body;

    // Validate
    const errors = [];
    if (!booking_id)                                     errors.push('booking_id is required.');
    if (!title || String(title).trim().length < 3)       errors.push('title must be at least 3 characters.');
    if (!menu_description || String(menu_description).trim().length < 5)
      errors.push('menu_description is required.');
    const price = parseFloat(ticket_price);
    if (isNaN(price) || price < 0)   errors.push('ticket_price must be 0 or more.');
    const cap = parseInt(capacity, 10);
    if (isNaN(cap) || cap < 1)        errors.push('capacity must be at least 1.');
    if (errors.length)
      return res.status(400).json({ error: errors.join(' ') });

    // Booking must belong to this chef
    const { rows: bRows } = await pool.query(
      'SELECT id, chef_id, status FROM bookings WHERE id = $1',
      [booking_id]
    );
    if (!bRows.length)
      return res.status(404).json({ error: 'Booking not found.' });
    if (bRows[0].chef_id !== req.user.id)
      return res.status(403).json({ error: 'That booking does not belong to you.' });
    if (bRows[0].status === 'declined')
      return res.status(400).json({ error: 'Cannot publish an event on a declined booking.' });

    // One event per booking (the unique index on events.booking_id enforces this in DB too)
    const { rows: existing } = await pool.query(
      'SELECT id FROM events WHERE booking_id = $1',
      [booking_id]
    );
    if (existing.length)
      return res.status(409).json({ error: 'An event already exists for this booking.' });

    // Parse optional starts_at
    let startsAt = null;
    if (starts_at) {
      const d = new Date(starts_at);
      if (isNaN(d.getTime()))
        return res.status(400).json({ error: 'starts_at is not a valid date.' });
      startsAt = d.toISOString();
    }

    const { rows } = await pool.query(
      `INSERT INTO events (booking_id, title, menu_description, ticket_price, capacity, starts_at, verification_status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [booking_id, title.trim(), menu_description.trim(), price, cap, startsAt]
    );
    return res.status(201).json({ event: rows[0] });

  } catch (err) {
    // Catch DB trigger error for declined booking
    if (err.message && err.message.includes('declined'))
      return res.status(400).json({ error: err.message });
    console.error('POST /api/events:', err.message);
    return res.status(500).json({ error: 'Could not create event.' });
  }
});

// ── GET /api/events/:id/manifest ───────────────────────────────────────────
// Hosting chef views registered diner manifest with dietary notes and door check-in status
router.get('/:id/manifest', verifyToken, async (req, res) => {
  try {
    const { rows: eRows } = await pool.query(
      `SELECT e.id, e.title, b.chef_id
       FROM events e
       JOIN bookings b ON b.id = e.booking_id
       WHERE e.id = $1`,
      [req.params.id]
    );
    if (!eRows.length) return res.status(404).json({ error: 'Event not found.' });
    if (eRows[0].chef_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only the hosting chef can access this guest manifest.' });
    }

    const { rows } = await pool.query(
      `SELECT t.id, t.ref_no, t.quantity, t.dietary_notes, t.checked_in, t.checked_in_at, t.created_at,
              u.name AS guest_name, u.email AS guest_email
       FROM tickets t
       JOIN users u ON u.id = t.attendee_id
       WHERE t.event_id = $1
       ORDER BY t.created_at ASC`,
      [req.params.id]
    );
    return res.json({ manifest: rows });
  } catch (err) {
    console.error('GET /api/events/:id/manifest:', err.message);
    return res.status(500).json({ error: 'Could not fetch guest manifest.' });
  }
});

// ── PATCH /api/events/:id/verify ───────────────────────────────────────────
router.patch('/:id/verify', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE events
       SET verification_status = 'verified', verified_by = $2, verified_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Event not found.' });
    return res.json({ event: rows[0] });
  } catch (err) {
    console.error('PATCH /api/events/:id/verify:', err.message);
    return res.status(500).json({ error: 'Could not verify event.' });
  }
});

// ── PATCH /api/events/:id/reject ───────────────────────────────────────────
router.patch('/:id/reject', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `UPDATE events
       SET verification_status = 'rejected', verified_by = $2, verified_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Event not found.' });
    return res.json({ event: rows[0] });
  } catch (err) {
    console.error('PATCH /api/events/:id/reject:', err.message);
    return res.status(500).json({ error: 'Could not reject event.' });
  }
});

module.exports = router;

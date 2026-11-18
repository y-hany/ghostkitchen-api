// routes/bookings.js
//
// GET   /api/bookings              — chef sees own; host sees requests on own kitchens
// POST  /api/bookings              — chef requests a slot
// PATCH /api/bookings/:id/approve — host approves (marks slot booked, declines rivals)
// PATCH /api/bookings/:id/decline — host declines
'use strict';
const router = require('express').Router();
const pool   = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');

// ── GET /api/bookings ─────────────────────────────────────────────────────────
router.get('/', verifyToken, async (req, res) => {
  try {
    let sql, params;

    if (req.user.role === 'chef') {
      // Chef: own bookings with kitchen + slot detail
      sql = `
        SELECT b.id, b.booking_no, b.status, b.decided_at, b.created_at, b.updated_at,
               b.slot_id, s.start_time, s.end_time, s.status AS slot_status,
               k.id AS kitchen_id, k.name AS kitchen_name, k.address, k.hourly_rate
        FROM bookings b
        JOIN slots    s ON s.id = b.slot_id
        JOIN kitchens k ON k.id = s.kitchen_id
        WHERE b.chef_id = $1
        ORDER BY b.created_at DESC`;
      params = [req.user.id];

    } else if (req.user.role === 'host') {
      // Host: booking requests on kitchens they own
      sql = `
        SELECT b.id, b.booking_no, b.status, b.decided_at, b.created_at, b.updated_at,
               b.slot_id, s.start_time, s.end_time,
               k.id AS kitchen_id, k.name AS kitchen_name, k.address, k.hourly_rate,
               u.id AS chef_id, u.name AS chef_name, u.email AS chef_email
        FROM bookings b
        JOIN slots    s ON s.id  = b.slot_id
        JOIN kitchens k ON k.id  = s.kitchen_id
        JOIN users    u ON u.id  = b.chef_id
        WHERE k.host_id = $1
        ORDER BY (b.status = 'pending') DESC, b.created_at DESC`;
      params = [req.user.id];

    } else if (req.user.role === 'admin') {
      sql = `
        SELECT b.id, b.booking_no, b.status, b.decided_at, b.created_at, b.updated_at,
               b.slot_id, s.start_time, s.end_time,
               k.name AS kitchen_name, k.hourly_rate,
               u.name AS chef_name
        FROM bookings b
        JOIN slots    s ON s.id = b.slot_id
        JOIN kitchens k ON k.id = s.kitchen_id
        JOIN users    u ON u.id = b.chef_id
        ORDER BY b.created_at DESC`;
      params = [];

    } else {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const { rows } = await pool.query(sql, params);
    return res.json({ bookings: rows });

  } catch (err) {
    console.error('GET /api/bookings:', err.message);
    return res.status(500).json({ error: 'Could not fetch bookings.' });
  }
});

// ── POST /api/bookings ────────────────────────────────────────────────────────
router.post('/', verifyToken, requireRole('chef'), async (req, res) => {
  try {
    const { slot_id } = req.body;
    if (!slot_id)
      return res.status(400).json({ error: 'slot_id is required.' });

    // Slot must exist and belong to a verified kitchen
    const { rows: sRows } = await pool.query(
      `SELECT s.id, s.status, k.verification_status
       FROM slots s
       JOIN kitchens k ON k.id = s.kitchen_id
       WHERE s.id = $1`,
      [slot_id]
    );
    if (!sRows.length)
      return res.status(404).json({ error: 'Slot not found.' });
    if (sRows[0].verification_status !== 'verified')
      return res.status(400).json({ error: 'That kitchen is not yet verified.' });
    if (sRows[0].status === 'booked')
      return res.status(409).json({ error: 'That slot is already booked.' });

    // Duplicate request guard (the unique index covers this, but give a clear message)
    const { rows: dup } = await pool.query(
      'SELECT id FROM bookings WHERE slot_id = $1 AND chef_id = $2',
      [slot_id, req.user.id]
    );
    if (dup.length)
      return res.status(409).json({ error: 'You have already requested this slot.' });

    const { rows } = await pool.query(
      `INSERT INTO bookings (slot_id, chef_id) VALUES ($1, $2)
       RETURNING id, booking_no, slot_id, chef_id, status, created_at, updated_at`,
      [slot_id, req.user.id]
    );
    return res.status(201).json({ booking: rows[0] });

  } catch (err) {
    console.error('POST /api/bookings:', err.message);
    return res.status(500).json({ error: 'Could not create booking.' });
  }
});

// ── PATCH /api/bookings/:id/approve ──────────────────────────────────────────
// 1. Verify the booking's kitchen belongs to the calling host.
// 2. Set booking status = 'approved', decided_at = now().
// 3. Mark the slot as 'booked'.
// 4. Decline all other pending requests for the same slot.
router.patch('/:id/approve', verifyToken, requireRole('host'), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch booking + ownership check in one query
    const { rows: bRows } = await client.query(
      `SELECT b.id, b.status, b.slot_id, s.kitchen_id, k.host_id
       FROM bookings b
       JOIN slots    s ON s.id = b.slot_id
       JOIN kitchens k ON k.id = s.kitchen_id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (!bRows.length)
      return rollback(client, res, 404, 'Booking not found.');
    const bk = bRows[0];
    if (bk.host_id !== req.user.id)
      return rollback(client, res, 403, 'That booking is not on one of your kitchens.');
    if (bk.status !== 'pending')
      return rollback(client, res, 400, `Booking is already '${bk.status}'.`);

    // Approve this booking
    const { rows: approved } = await client.query(
      `UPDATE bookings SET status = 'approved', decided_at = now()
       WHERE id = $1
       RETURNING id, booking_no, slot_id, chef_id, status, decided_at, updated_at`,
      [req.params.id]
    );

    // Mark the slot as booked
    await client.query(
      `UPDATE slots SET status = 'booked' WHERE id = $1`,
      [bk.slot_id]
    );

    // Auto-decline all other pending requests on the same slot
    await client.query(
      `UPDATE bookings SET status = 'declined', decided_at = now()
       WHERE slot_id = $1 AND id != $2 AND status = 'pending'`,
      [bk.slot_id, req.params.id]
    );

    await client.query('COMMIT');
    return res.json({ booking: approved[0] });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PATCH /api/bookings/:id/approve:', err.message);
    return res.status(500).json({ error: 'Could not approve booking.' });
  } finally {
    client.release();
  }
});

// ── PATCH /api/bookings/:id/decline ──────────────────────────────────────────
router.patch('/:id/decline', verifyToken, requireRole('host'), async (req, res) => {
  try {
    const { rows: bRows } = await pool.query(
      `SELECT b.id, b.status, k.host_id
       FROM bookings b
       JOIN slots    s ON s.id = b.slot_id
       JOIN kitchens k ON k.id = s.kitchen_id
       WHERE b.id = $1`,
      [req.params.id]
    );
    if (!bRows.length)
      return res.status(404).json({ error: 'Booking not found.' });
    if (bRows[0].host_id !== req.user.id)
      return res.status(403).json({ error: 'That booking is not on one of your kitchens.' });
    if (bRows[0].status !== 'pending')
      return res.status(400).json({ error: `Booking is already '${bRows[0].status}'.` });

    const { rows } = await pool.query(
      `UPDATE bookings SET status = 'declined', decided_at = now()
       WHERE id = $1
       RETURNING id, booking_no, slot_id, chef_id, status, decided_at, updated_at`,
      [req.params.id]
    );
    return res.json({ booking: rows[0] });

  } catch (err) {
    console.error('PATCH /api/bookings/:id/decline:', err.message);
    return res.status(500).json({ error: 'Could not decline booking.' });
  }
});

// ── helper: rollback and respond inside a transaction ────────────────────────
async function rollback(client, res, status, error) {
  await client.query('ROLLBACK');
  return res.status(status).json({ error });
}

module.exports = router;

// routes/admin.js
//
// GET  /api/admin/stats    — platform overview numbers for admin dashboard
// GET  /api/admin/kitchens — kitchens pending verification or all
// GET  /api/admin/events   — supper club events pending verification or all
'use strict';
const router = require('express').Router();
const pool   = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');
const { validateUUID } = require('../middleware/validate');

// All routes in this file require admin role
router.use(verifyToken, requireRole('admin'));

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [kitchenCounts, eventCounts, bookingCount, ticketAgg] = await Promise.all([
      pool.query(
        `SELECT verification_status, COUNT(*)::int AS count
         FROM kitchens GROUP BY verification_status`
      ),
      pool.query(
        `SELECT verification_status, COUNT(*)::int AS count
         FROM events GROUP BY verification_status`
      ),
      pool.query(`SELECT COUNT(*)::int AS count FROM bookings`),
      pool.query(
        `SELECT COALESCE(SUM(t.quantity), 0)::int AS seats_sold,
                COALESCE(SUM(t.total_price), 0)::numeric AS revenue
         FROM tickets t`
      ),
    ]);

    const kStatusMap = {};
    for (const row of kitchenCounts.rows) {
      kStatusMap[row.verification_status] = row.count;
    }

    const eStatusMap = {};
    for (const row of eventCounts.rows) {
      eStatusMap[row.verification_status] = row.count;
    }

    return res.json({
      stats: {
        kitchens_verified : kStatusMap.verified  || 0,
        kitchens_pending  : kStatusMap.pending   || 0,
        kitchens_rejected : kStatusMap.rejected  || 0,
        events_verified   : eStatusMap.verified  || 0,
        events_pending    : eStatusMap.pending   || 0,
        events_rejected   : eStatusMap.rejected  || 0,
        total_bookings    : bookingCount.rows[0].count,
        seats_sold        : ticketAgg.rows[0].seats_sold,
        revenue_egp       : parseFloat(ticketAgg.rows[0].revenue),
      }
    });
  } catch (err) {
    console.error('GET /api/admin/stats:', err.message);
    return res.status(500).json({ error: 'Could not fetch stats.' });
  }
});

// ── GET /api/admin/kitchens ───────────────────────────────────────────────────
// ?status=pending  → only pending kitchens (default for approval queue)
// ?status=all      → every kitchen
router.get('/kitchens', async (req, res) => {
  try {
    const rawFilter = String(req.query.status || 'pending').toLowerCase();
    const filter = ['pending', 'verified', 'rejected', 'all'].includes(rawFilter) ? rawFilter : 'pending';
    let sql = `
      SELECT k.*, u.name AS host_name, u.email AS host_email,
             av.name AS verified_by_name
      FROM kitchens k
      JOIN users u ON u.id = k.host_id
      LEFT JOIN users av ON av.id = k.verified_by`;
    const params = [];
    if (filter !== 'all') {
      sql += ` WHERE k.verification_status = $1`;
      params.push(filter);
    }
    sql += ` ORDER BY k.created_at ASC`;

    const { rows } = await pool.query(sql, params);
    return res.json({ kitchens: rows });
  } catch (err) {
    console.error('GET /api/admin/kitchens:', err.message);
    return res.status(500).json({ error: 'Could not fetch kitchens.' });
  }
});

// ── GET /api/admin/events ─────────────────────────────────────────────────────
// ?status=pending  → only pending pop-up events (default for approval queue)
// ?status=all      → every event
router.get('/events', async (req, res) => {
  try {
    const rawFilter = String(req.query.status || 'pending').toLowerCase();
    const filter = ['pending', 'verified', 'rejected', 'all'].includes(rawFilter) ? rawFilter : 'pending';
    let sql = `
      SELECT e.*,
             b.booking_no, b.status AS booking_status,
             s.start_time, s.end_time,
             k.id AS kitchen_id, k.name AS kitchen_name, k.address,
             u.id AS chef_id, u.name AS chef_name, u.email AS chef_email,
             av.name AS verified_by_name
      FROM events e
      JOIN bookings b ON b.id = e.booking_id
      JOIN slots    s ON s.id = b.slot_id
      JOIN kitchens k ON k.id = s.kitchen_id
      JOIN users    u ON u.id = b.chef_id
      LEFT JOIN users av ON av.id = e.verified_by`;
    const params = [];
    if (filter !== 'all') {
      sql += ` WHERE e.verification_status = $1`;
      params.push(filter);
    }
    sql += ` ORDER BY e.created_at ASC`;

    const { rows } = await pool.query(sql, params);
    return res.json({ events: rows });
  } catch (err) {
    console.error('GET /api/admin/events:', err.message);
    return res.status(500).json({ error: 'Could not fetch events for admin.' });
  }
});

// ── PATCH /api/admin/events/:id/verify ────────────────────────────────────────
router.patch('/events/:id/verify', validateUUID(), async (req, res) => {
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
    console.error('PATCH /api/admin/events/:id/verify:', err.message);
    return res.status(500).json({ error: 'Could not verify event.' });
  }
});

// ── PATCH /api/admin/events/:id/reject ────────────────────────────────────────
router.patch('/events/:id/reject', validateUUID(), async (req, res) => {
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
    console.error('PATCH /api/admin/events/:id/reject:', err.message);
    return res.status(500).json({ error: 'Could not reject event.' });
  }
});

module.exports = router;

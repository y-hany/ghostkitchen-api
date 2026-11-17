// routes/admin.js
//
// GET  /api/admin/stats    — platform overview numbers for admin.html banner
// GET  /api/admin/kitchens — all kitchens with pending/all status for the approval queue
'use strict';
const router = require('express').Router();
const pool   = require('../db/pool');
const { verifyToken, requireRole } = require('../middleware/auth');

// All routes in this file require admin role
router.use(verifyToken, requireRole('admin'));

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [kitchenCounts, bookingCount, ticketAgg] = await Promise.all([
      pool.query(
        `SELECT verification_status, COUNT(*)::int AS count
         FROM kitchens GROUP BY verification_status`
      ),
      pool.query(`SELECT COUNT(*)::int AS count FROM bookings`),
      pool.query(
        `SELECT COALESCE(SUM(t.quantity), 0)::int AS seats_sold,
                COALESCE(SUM(t.total_price), 0)::numeric AS revenue
         FROM tickets t`
      ),
    ]);

    const statusMap = {};
    for (const row of kitchenCounts.rows) {
      statusMap[row.verification_status] = row.count;
    }

    return res.json({
      stats: {
        kitchens_verified : statusMap.verified  || 0,
        kitchens_pending  : statusMap.pending   || 0,
        kitchens_rejected : statusMap.rejected  || 0,
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
    const filter = req.query.status || 'pending';
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

module.exports = router;

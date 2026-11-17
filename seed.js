// seed.js — seeds friendly demo users and Cairo kitchens into Supabase
'use strict';
const pool = require('./db/pool');
const bcrypt = require('bcrypt');

async function seed() {
  console.log('Seeding demo data into Supabase...');
  
  // 1. Demo accounts
  const pwHash = await bcrypt.hash('password123', 12);
  const users = [
    { name: 'Layla Host',     email: 'host@demo.eg',     role: 'host' },
    { name: 'Omar Hassan',    email: 'chef@demo.eg',     role: 'chef' },
    { name: 'Mariam Adel',    email: 'attendee@demo.eg', role: 'attendee' },
    { name: 'Platform Admin', email: 'admin@demo.eg',    role: 'admin' }
  ];

  const userMap = {};
  for (const u of users) {
    const res = await pool.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (lower(email)) DO UPDATE SET name = EXCLUDED.name
       RETURNING id, role`,
      [u.name, u.email, pwHash, u.role]
    );
    userMap[u.role] = res.rows[0].id;
  }
  console.log('Demo users ready.');

  const hostId = userMap.host;
  const adminId = userMap.admin;

  // 2. Kitchens
  const kitchens = [
    {
      name: 'The Baker’s Studio – Zamalek',
      address: '5 Brazil St, Zamalek, Cairo',
      license_info: 'LIC-5120 · valid to Dec 2026',
      hourly_rate: 350,
      equipment: ['Convection ovens', 'Induction hobs'],
      status: 'verified'
    },
    {
      name: 'Urban Culinary Lab – Maadi',
      address: '12 Road 9, Maadi, Cairo',
      license_info: 'LIC-3987 · valid to Jun 2027',
      hourly_rate: 320,
      equipment: ['Walk-in fridge', 'Induction hobs', 'Gas range'],
      status: 'verified'
    },
    {
      name: 'Heliopolis Test Kitchen Co.',
      address: 'Baghdad St, Heliopolis, Cairo',
      license_info: 'LIC-6203 · submitted for review',
      hourly_rate: 240,
      equipment: ['Convection ovens', 'Gas range'],
      status: 'pending'
    }
  ];

  for (const k of kitchens) {
    const kRes = await pool.query(
      `INSERT INTO kitchens (host_id, name, address, license_info, hourly_rate, equipment, verification_status, verified_by, verified_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CASE WHEN $7 = 'verified' THEN now() ELSE NULL END)
       RETURNING id`,
      [hostId, k.name, k.address, k.license_info, k.hourly_rate, k.equipment, k.status, k.status === 'verified' ? adminId : null]
    );
    const kId = kRes.rows[0].id;

    // Add 2 slots per kitchen
    await pool.query(
      `INSERT INTO slots (kitchen_id, start_time, end_time, status)
       VALUES 
       ($1, now() + interval '2 days 15 hours', now() + interval '2 days 19 hours', 'open'),
       ($1, now() + interval '4 days 14 hours', now() + interval '4 days 18 hours', 'open')`,
      [kId]
    );
  }

  console.log('Cairo kitchens and slots seeded successfully!');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});

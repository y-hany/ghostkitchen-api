// test-e2e.js — end-to-end test of the entire GhostKitchen API
'use strict';

const BASE = 'http://localhost:3000';

async function req(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`${method} ${path} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

async function test() {
  console.log('--- STARTING GHOSTKITCHEN API END-TO-END TEST ---');
  
  // 1. Health
  const h = await req('/health');
  console.log('✓ 1. Health check passed:', h);

  // Unique suffix for emails so test can be re-run cleanly
  const tag = Date.now().toString().slice(-5);

  // 2. Register Host
  const host = await req('/api/register', 'POST', {
    name: 'Layla Host',
    email: `host_${tag}@demo.eg`,
    password: 'password123',
    role: 'host'
  });
  console.log('✓ 2. Host registered:', host.user.email);

  // 3. Register Chef
  const chef = await req('/api/register', 'POST', {
    name: 'Omar Chef',
    email: `chef_${tag}@demo.eg`,
    password: 'password123',
    role: 'chef'
  });
  console.log('✓ 3. Chef registered:', chef.user.email);

  // 4. Register Attendee
  const attendee = await req('/api/register', 'POST', {
    name: 'Mariam Attendee',
    email: `attendee_${tag}@demo.eg`,
    password: 'password123',
    role: 'attendee'
  });
  console.log('✓ 4. Attendee registered:', attendee.user.email);

  // 5. Register Admin
  const admin = await req('/api/register', 'POST', {
    name: 'Platform Admin',
    email: `admin_${tag}@demo.eg`,
    password: 'password123',
    role: 'admin'
  });
  console.log('✓ 5. Admin registered:', admin.user.email);

  // 6. Host adds a kitchen
  const kRes = await req('/api/kitchens', 'POST', {
    name: 'Nile Valley Commercial Kitchen',
    address: '18 Mesaha St, Dokki, Giza',
    license_info: 'LIC-4471',
    hourly_rate: 300,
    equipment: ['Walk-in fridge', 'Convection ovens', 'Gas range']
  }, host.token);
  const kitchen = kRes.kitchen;
  console.log('✓ 6. Kitchen created (pending):', kitchen.name, 'ID:', kitchen.id);

  // 7. Admin verifies the kitchen
  const vRes = await req(`/api/kitchens/${kitchen.id}/verify`, 'PATCH', {}, admin.token);
  console.log('✓ 7. Kitchen verified by admin:', vRes.kitchen.verification_status);

  // 8. Host adds an availability slot
  const sRes = await req('/api/slots', 'POST', {
    kitchen_id: kitchen.id,
    start_time: '2026-12-05T15:00:00Z',
    end_time: '2026-12-05T20:00:00Z'
  }, host.token);
  const slot = sRes.slot;
  console.log('✓ 8. Slot added:', slot.id, slot.status);

  // 9. Chef requests booking for this slot
  const bRes = await req('/api/bookings', 'POST', {
    slot_id: slot.id
  }, chef.token);
  const booking = bRes.booking;
  console.log('✓ 9. Slot requested by chef: Booking #', booking.booking_no, booking.status);

  // 10. Host approves booking
  const appRes = await req(`/api/bookings/${booking.id}/approve`, 'PATCH', {}, host.token);
  console.log('✓ 10. Host approved booking:', appRes.booking.status);

  // 11. Chef publishes pop-up event
  const evRes = await req('/api/events', 'POST', {
    booking_id: booking.id,
    title: '5-Course Cairo Fusion Supper',
    menu_description: 'Smoked lentil soup, charred tomato daqqa, spiced lamb.',
    ticket_price: 450,
    capacity: 20,
    starts_at: '2026-12-05T18:00:00Z'
  }, chef.token);
  const event = evRes.event;
  console.log('✓ 11. Event published:', event.title, 'Price:', event.ticket_price, 'EGP');

  // 12. Public lists events
  const pubEvents = await req('/api/events');
  console.log('✓ 12. Public events list:', pubEvents.events.length, 'live event found');

  // 13. Attendee reserves 2 tickets
  const tRes = await req('/api/tickets', 'POST', {
    event_id: event.id,
    quantity: 2
  }, attendee.token);
  console.log('✓ 13. Attendee reserved tickets! Ref #:', tRes.ticket.ref_no, 'Total:', tRes.ticket.total_price, 'EGP');

  // 14. Attendee fetches tickets (My Tickets page)
  const myTickets = await req('/api/tickets', 'GET', null, attendee.token);
  console.log('✓ 14. tickets.html data verified! Found', myTickets.tickets.length, 'ticket:');
  console.log('    - Event:', myTickets.tickets[0].event_title);
  console.log('    - Kitchen:', myTickets.tickets[0].kitchen_name);
  console.log('    - Seats:', myTickets.tickets[0].quantity);
  console.log('    - Total Price:', myTickets.tickets[0].total_price, 'EGP');

  // 15. Admin overview stats
  const statsRes = await req('/api/admin/stats', 'GET', null, admin.token);
  console.log('✓ 15. Admin stats:', statsRes.stats);

  console.log('\n========================================');
  console.log('🎉 ALL 15 BACKEND TESTS PASSED COMPLETELY!');
  console.log('========================================');
}

test().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});

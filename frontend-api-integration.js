// frontend-api-integration.js
// Drop this in your prototype's source/ folder and load it before app.js.
// It replaces every localStorage write with a real fetch() call.
//
// This file shows the FULL pattern once (tickets.html),
// then stubs for every other page so you can fill them in one by one.
'use strict';

// ── Configuration ─────────────────────────────────────────────────────────────
// Change this to your Render URL when you deploy.
const API_BASE = 'http://localhost:3000';

// ── Core fetch helper ─────────────────────────────────────────────────────────
// Usage:  const data = await api('GET', '/api/tickets');
//         const data = await api('POST', '/api/bookings', { slot_id });
async function api(method, path, body) {
  const token = localStorage.getItem('gk_token');
  const res = await fetch(API_BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    // Bubble the server's error message up so callers can show it in the UI
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

// ── Auth helpers ──────────────────────────────────────────────────────────────
async function apiRegister(name, email, password, role) {
  const data = await api('POST', '/api/register', { name, email, password, role });
  localStorage.setItem('gk_token', data.token);
  return data.user; // { id, name, email, role, … }
}

async function apiLogin(email, password) {
  const data = await api('POST', '/api/login', { email, password });
  localStorage.setItem('gk_token', data.token);
  return data.user; // { id, name, email, role, … }
}

function apiLogout() {
  localStorage.removeItem('gk_token');
}

// ── tickets.html integration (complete worked example) ────────────────────────
//
// HTML you need in tickets.html:
//   <div id="ticketList"></div>
//
// Call loadMyTickets() when the tickets page renders.
async function loadMyTickets() {
  const listEl = document.getElementById('ticketList');
  if (!listEl) return; // not on the tickets page

  listEl.innerHTML = '<p class="muted">Loading your tickets…</p>';

  try {
    const { tickets } = await api('GET', '/api/tickets');

    if (!tickets.length) {
      listEl.innerHTML = `
        <div class="card empty">
          <h2>No tickets yet</h2>
          <p>Reserve seats at a pop-up dinner and your tickets will show up here.</p>
          <a class="btn" href="event.html" data-go="event">Browse events</a>
        </div>`;
      return;
    }

    // Render one card per ticket
    listEl.innerHTML = tickets.map(t => {
      const date = t.starts_at
        ? new Date(t.starts_at).toLocaleString('en-EG', {
            weekday: 'short', day: 'numeric', month: 'short',
            hour: '2-digit', minute: '2-digit'
          })
        : (t.start_time
            ? new Date(t.start_time).toLocaleString('en-EG', {
                weekday: 'short', day: 'numeric', month: 'short',
                hour: '2-digit', minute: '2-digit'
              })
            : 'TBA');

      const fmt = n => Number(n).toLocaleString('en-US') + ' EGP';

      return `
        <div class="card">
          <div class="row">
            <b>${esc(t.event_title)}</b>
            <span class="badge approved">Confirmed</span>
          </div>
          <div class="muted">
            📅 ${date} · 📍 ${esc(t.kitchen_name)}
          </div>
          <div class="muted">${esc(t.kitchen_address)}</div>
          <div class="muted">By Chef ${esc(t.chef_name)}</div>
          <div class="row" style="margin-top:8px">
            <span>${t.quantity} × ${fmt(t.unit_price)}</span>
            <span class="price">${fmt(t.total_price)}</span>
          </div>
          <div class="muted">Ref T-${t.ref_no}</div>
        </div>`;
    }).join('');

  } catch (err) {
    listEl.innerHTML = `<div class="card"><p class="err">${esc(err.message)}</p></div>`;
  }
}

// ── event.html: load live events + reserve seats ──────────────────────────────
async function loadEvents() {
  // const { events } = await api('GET', '/api/events');
  // Render each event card the same way you do now but from real data
}

async function reserveSeats(event_id, quantity) {
  // const { ticket } = await api('POST', '/api/tickets', { event_id, quantity });
  // Show confirmation flash
}

// ── kitchens.html: load kitchens + equipment filter ───────────────────────────
async function loadKitchens(equipmentFilter = []) {
  // const qs = equipmentFilter.length
  //   ? '?equipment=' + encodeURIComponent(equipmentFilter.join(','))
  //   : '';
  // const { kitchens } = await api('GET', '/api/kitchens' + qs);
}

async function requestSlot(slot_id) {
  // await api('POST', '/api/bookings', { slot_id });
}

// ── host.html ─────────────────────────────────────────────────────────────────
async function loadHostDashboard() {
  // const { bookings } = await api('GET', '/api/bookings'); // host role → own kitchens' requests
  // const { kitchens } = await api('GET', '/api/kitchens'); // host role → own kitchens
}

async function approveBooking(booking_id) {
  // await api('PATCH', `/api/bookings/${booking_id}/approve`);
}

async function declineBooking(booking_id) {
  // await api('PATCH', `/api/bookings/${booking_id}/decline`);
}

async function addKitchen(form) {
  // const { kitchen } = await api('POST', '/api/kitchens', {
  //   name: form.name.value, address: form.address.value,
  //   license_info: form.license_info.value, hourly_rate: form.hourly_rate.value,
  //   equipment: form.equipment.value.split(',').map(s => s.trim()).filter(Boolean)
  // });
}

async function addSlot(form) {
  // const { slot } = await api('POST', '/api/slots', {
  //   kitchen_id: form.kitchen_id.value,
  //   start_time: form.start_time.value,
  //   end_time:   form.end_time.value
  // });
}

// ── chef.html ─────────────────────────────────────────────────────────────────
async function loadChefDashboard() {
  // const { bookings } = await api('GET', '/api/bookings'); // chef role → own bookings
  // const { events }   = await api('GET', '/api/events/mine');
}

async function publishEvent(form) {
  // const { event } = await api('POST', '/api/events', {
  //   booking_id: form.booking_id.value, title: form.title.value,
  //   menu_description: form.menu_description.value,
  //   ticket_price: form.ticket_price.value, capacity: form.capacity.value,
  //   starts_at: form.starts_at.value
  // });
}

// ── admin.html ────────────────────────────────────────────────────────────────
async function loadAdminDashboard() {
  // const { stats }    = await api('GET', '/api/admin/stats');
  // const { kitchens } = await api('GET', '/api/admin/kitchens?status=pending');
}

async function verifyKitchen(kitchen_id) {
  // await api('PATCH', `/api/kitchens/${kitchen_id}/verify`);
}

async function rejectKitchen(kitchen_id) {
  // await api('PATCH', `/api/kitchens/${kitchen_id}/reject`);
}

async function revokeKitchen(kitchen_id) {
  // await api('PATCH', `/api/kitchens/${kitchen_id}/revoke`);
}

// ── Shared escape helper (keep in sync with app.js) ───────────────────────────
function esc(s) {
  return String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])
  );
}

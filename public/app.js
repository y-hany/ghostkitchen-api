(function(){
'use strict';

var API = (window.location.origin && window.location.origin !== 'null' && window.location.protocol.indexOf('http') === 0) ? window.location.origin + '/api' : 'http://localhost:3000/api';
var K = 'gk_state_v4';

var DEMO_USERS = {
  host:     { name: 'Layla Host',       email: 'host@demo.eg',     role: 'host' },
  chef:     { name: 'Omar Hassan',      email: 'chef@demo.eg',     role: 'chef' },
  attendee: { name: 'Mariam Adel',      email: 'attendee@demo.eg', role: 'attendee' },
  admin:    { name: 'Platform Admin',   email: 'admin@demo.eg',    role: 'admin' }
};

var DISTRICTS = ['All', 'Dokki', 'Zamalek', 'Maadi', 'Heliopolis', 'Garden City', 'New Cairo', 'Sheikh Zayed'];
var SETUPS = ['All Setups', 'Hot Cooking Line', 'Bakery Deck', 'Supper Club (Kitchen+Dining)', 'Cold Prep'];
var RATES = ['All Rates', '< 300 EGP', '300–350 EGP', '350+ EGP'];
var EQUIP = ['Walk-in chiller', 'Convection ovens', 'Gas range', 'Induction hobs'];

var KITCHEN_PHOTOS = [
  'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1578474846511-04ba529f0b88?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1590736969955-71cc94801759?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1556910103-1c02745aae4d?auto=format&fit=crop&w=800&q=80'
];

var EVENT_PHOTOS = [
  'https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80',
  'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=800&q=80'
];

var S, flash = null;
var $ = (s, r) => [].slice.call((r || document).querySelectorAll(s)), $1 = (s, r) => (r || document).querySelector(s);
var $$ = s => [].slice.call(document.querySelectorAll(s));
var fmt = n => Number(n || 0).toLocaleString('en-US') + ' EGP';
var esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
var by = (a, id) => a.filter(x => x.id === id)[0];

// ── VECTOR SVG ICONS ────────────────────────────────────────────────────────
var ICONS = {
  pin: '<svg class="inline-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  cal: '<svg class="inline-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  chef: '<svg class="inline-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 13.8V4a2 2 0 0 1 4 0v9.8"/><path d="M14 13.8V4a2 2 0 0 1 4 0v9.8"/><path d="M10 10.5V4a2 2 0 0 1 4 0v6.5"/><path d="M19 14a6 6 0 1 1-14 0"/><path d="M5 14h14v7H5z"/></svg>',
  shield: '<svg class="inline-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>',
  ticket: '<svg class="inline-ico" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"/></svg>',
  sun: '<svg class="theme-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>',
  moon: '<svg class="theme-ico" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
};

// ── THEME MANAGER ───────────────────────────────────────────────────────────
function initTheme() {
  var saved = localStorage.getItem('gk_theme') || ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light');
  setTheme(saved);
}

function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('gk_theme', t);
  var btn = $1('#themeToggle');
  if (btn) {
    btn.innerHTML = t === 'dark' ? ICONS.sun : ICONS.moon;
    btn.setAttribute('title', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  }
}

function toggleTheme() {
  var cur = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(cur === 'dark' ? 'light' : 'dark');
}

function setRoute(h) {
  if (location.hash === h) {
    route();
  } else {
    location.hash = h;
  }
}

// ── API CLIENT ─────────────────────────────────────────────────────────────
async function api(method, path, body) {
  var token = localStorage.getItem('gk_token');
  var headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  try {
    var res = await fetch(API + path, {
      method: method,
      headers: headers,
      body: body ? JSON.stringify(body) : undefined
    });
    var data = await res.json().catch(() => ({}));
    if (res.status === 401) {
      localStorage.removeItem('gk_token');
      localStorage.removeItem(K);
      if (S) S.session = null;
      updateNav();
      toast('Session expired. Please sign in again.');
      setRoute('#login');
      throw new Error(data.error || 'Session expired');
    }
    if (!res.ok) {
      throw new Error(data.error || 'Request failed (' + res.status + ')');
    }
    return data;
  } catch (err) {
    if (err.message.indexOf('Failed to fetch') > -1) {
      toast('Cannot connect to API service.');
    }
    throw err;
  }
}

// ── STATE & PERSISTENCE ─────────────────────────────────────────────────────
function initSession() {
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(K)); } catch(e){}
  S = {
    session: saved && saved.session ? saved.session : null,
    filters: [],
    district: 'All',
    setup: 'All Setups',
    maxRate: 'All Rates',
    searchQuery: '',
    kitchens: [],
    slots: [],
    bookings: [],
    events: [],
    tickets: [],
    stats: null
  };
}

function saveSession() {
  try {
    localStorage.setItem(K, JSON.stringify({ session: S.session }));
  } catch(e){}
}

var role = () => S.session ? S.session.role : 'guest';
var me = () => S.session ? S.session.name : 'Guest';

function toast(m){
  var t = $1('#toast');
  if(!t){
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = m;
  t.className = 'show';
  clearTimeout(t._h);
  t._h = setTimeout(() => t.className = '', 3200);
}

function B(st, txt){
  var m = { verified: 'approved', approved: 'approved', pending: 'pending', booked: 'pending', rejected: 'declined', declined: 'declined' };
  return '<span class="badge ' + (m[st] || '') + '">' + esc(txt || st) + '</span>';
}

function fmtSlot(s) {
  if (!s.start_time) return 'Shift details';
  var a = new Date(s.start_time), z = new Date(s.end_time || s.start_time);
  var day = a.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  var from = a.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  var to = z.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return day + ' · ' + from + '–' + to;
}

function slotHours(s) {
  if (!s.start_time || !s.end_time) return 4;
  return Math.max(1, Math.round((new Date(s.end_time) - new Date(s.start_time)) / 36e5));
}

function hashPhoto(str, list) {
  var h = 0;
  for (var i = 0; i < str.length; i++) h = (h << 5) - h + str.charCodeAt(i);
  return list[Math.abs(h) % list.length];
}

// ── SKELETON LOADERS ────────────────────────────────────────────────────────
function skeletonCards(n) {
  var h = '';
  for (var i = 0; i < (n || 3); i++) {
    h += `
      <div class="card skeleton-card">
        <div class="skeleton skeleton-img"></div>
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line sm"></div>
      </div>
    `;
  }
  return h;
}

// ── MODAL SYSTEM ────────────────────────────────────────────────────────────
function openModal(title, contentHtml) {
  var m = $1('#modalContainer');
  m.innerHTML = `
    <div class="modal-box" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3 class="modal-title">${esc(title)}</h3>
        <button class="modal-close" data-act="modal-close" aria-label="Close dialog">✕</button>
      </div>
      <div>${contentHtml}</div>
    </div>
  `;
  m.hidden = false;
  document.body.classList.add('locked');
}

function closeModal() {
  var m = $1('#modalContainer');
  if (m) {
    m.hidden = true;
    m.innerHTML = '';
  }
  document.body.classList.remove('locked');
}

// ── DYNAMIC RBAC NAVIGATION ─────────────────────────────────────────────────
function updateNav() {
  var r = role();
  var navLinks = $1('#navLinks');
  var userAction = $1('#navUserAction');
  var cur = getActiveRoute();

  var linksHtml = '';
  if (r === 'guest') {
    linksHtml = `
      <a href="#events" class="${cur === 'events' ? 'on' : ''}">Supper Clubs</a>
      <a href="#kitchens" class="${cur === 'kitchens' ? 'on' : ''}">Kitchen Spaces</a>
      <a href="#login" class="${cur === 'login' ? 'on' : ''}">Sign In</a>
    `;
    userAction.innerHTML = `<button class="nav-cta" data-act="open-cook-host">Cook or Host</button>`;
  } else if (r === 'attendee') {
    linksHtml = `
      <a href="#events" class="${cur === 'events' ? 'on' : ''}">Explore Supper Clubs</a>
      <a href="#tickets" class="${cur === 'tickets' ? 'on' : ''}">My Passes</a>
    `;
    userAction.innerHTML = `
      <div class="user-menu">
        <span class="role-chip">${esc(me().split(' ')[0])} · Diner</span>
        <button class="logout-btn" data-act="logout">Sign out</button>
      </div>
    `;
  } else if (r === 'chef') {
    linksHtml = `
      <a href="#kitchens" class="${cur === 'kitchens' ? 'on' : ''}">Kitchen Spaces</a>
      <a href="#chef-bookings" class="${cur === 'chef' ? 'on' : ''}">My Bookings</a>
      <a href="#events" class="${cur === 'events' ? 'on' : ''}">Explore Dinners</a>
    `;
    userAction.innerHTML = `
      <div class="user-menu">
        <button class="nav-cta" data-act="modal-event">+ Host a Pop-up</button>
        <span class="role-chip">${esc(me().split(' ')[0])} · Chef</span>
        <button class="logout-btn" data-act="logout">Sign out</button>
      </div>
    `;
  } else if (r === 'host') {
    linksHtml = `
      <a href="#host-dashboard" class="${cur === 'host' ? 'on' : ''}">Kitchen Hub</a>
      <a href="#kitchens" class="${cur === 'kitchens' ? 'on' : ''}">Browse Network</a>
    `;
    userAction.innerHTML = `
      <div class="user-menu">
        <button class="nav-cta" data-act="modal-kitchen">+ List Kitchen</button>
        <span class="role-chip">${esc(me().split(' ')[0])} · Host</span>
        <button class="logout-btn" data-act="logout">Sign out</button>
      </div>
    `;
  } else if (r === 'admin') {
    linksHtml = `
      <a href="#admin-console" class="${cur === 'admin' ? 'on' : ''}">Verifications</a>
      <a href="#kitchens" class="${cur === 'kitchens' ? 'on' : ''}">Kitchens</a>
      <a href="#events" class="${cur === 'events' ? 'on' : ''}">Pop-ups</a>
    `;
    userAction.innerHTML = `
      <div class="user-menu">
        <span class="role-chip">Platform Admin</span>
        <button class="logout-btn" data-act="logout">Sign out</button>
      </div>
    `;
  }

  navLinks.innerHTML = linksHtml;

  $$('.demo-role-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.role === r);
  });
}

function getActiveRoute() {
  var h = (location.hash || '').slice(1).toLowerCase();
  var p = location.pathname.replace(/^\//, '').toLowerCase();
  var target = h || p || 'events';
  return target.split('-')[0];
}

// ── VIEW 1: SUPPER CLUBS & POP-UP DINING (Default Diner Landing) ────────────
async function renderEventsView() {
  var view = $1('#appView');
  view.innerHTML = `
    <div class="hero">
      <h1>Cairo Pop-ups & Supper Clubs</h1>
      <p>Exclusive tasting menus, guest chef residencies, and intimate supper clubs hosted inside licensed commercial kitchens across Cairo.</p>
    </div>

    <!-- Hospitality Trust Signals -->
    <div class="trust-bar">
      <div class="trust-item">
        <div class="trust-icon">${ICONS.shield}</div>
        <div>
          <div class="trust-title">MOH Licensed Kitchens</div>
          <div class="trust-sub">Inspected commercial food preparation facilities</div>
        </div>
      </div>
      <div class="trust-item">
        <div class="trust-icon">${ICONS.chef}</div>
        <div>
          <div class="trust-title">Curated Guest Chefs</div>
          <div class="trust-sub">Artisanal concepts from Egypt's top culinary talent</div>
        </div>
      </div>
      <div class="trust-item">
        <div class="trust-icon">${ICONS.ticket}</div>
        <div>
          <div class="trust-title">Intimate Seating</div>
          <div class="trust-sub">Secret locations revealed upon confirmed booking</div>
        </div>
      </div>
    </div>

    <h2>Upcoming Pop-up Dinners</h2>
    <div id="eventGrid">${skeletonCards(2)}</div>
  `;

  try {
    var data = await api('GET', '/events');
    var events = data.events || [];
    var grid = $1('#eventGrid');
    if (!grid) return;

    if (!events.length) {
      grid.innerHTML = `
        <div class="card empty" style="text-align:center;padding:40px 20px">
          <div style="font-size:36px;margin-bottom:12px">🍽️</div>
          <h2>No Upcoming Pop-ups Published Yet</h2>
          <p class="muted" style="max-width:440px;margin:0 auto 16px">Guest chefs post pop-up supper clubs once their commercial kitchen slots are approved.</p>
          ${role() === 'chef' ? '<button class="nav-cta" data-act="modal-event">+ Host a Pop-up Dinner</button>' : '<a class="btn" href="#kitchens">Browse Commercial Kitchens</a>'}
        </div>
      `;
      return;
    }

    grid.innerHTML = events.map(ev => {
      var left = ev.seats_left != null ? ev.seats_left : ev.capacity;
      var total = ev.capacity || 20;
      var pct = Math.max(0, Math.min(100, Math.round(((total - left) / total) * 100)));
      var photo = hashPhoto(ev.title || ev.id, EVENT_PHOTOS);
      var dateStr = ev.starts_at ? new Date(ev.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Upcoming Date';
      var f = flash && flash.id === ev.id;

      return `
        <div class="card lift">
          <div class="card-media">
            <img class="card-img" src="${photo}" alt="${esc(ev.title)}" loading="lazy">
            <div class="card-badge-top">${left > 5 ? left + ' seats left' : left > 0 ? 'Only ' + left + ' left' : 'Sold out'}</div>
            <div class="card-badge-bottom">${ICONS.pin} Secret Location · ${esc((ev.address || '').split(',')[1] || 'Cairo')}</div>
          </div>
          
          <div class="row">
            <b class="kt" style="font-size:20px">${esc(ev.title)}</b>
            <div class="price" style="font-size:20px">${fmt(ev.ticket_price)} <span class="muted" style="font-size:13px">/ seat</span></div>
          </div>

          <div class="muted" style="margin:6px 0 10px">${ICONS.chef} Hosted by Chef ${esc(ev.chef_name)} · ${ICONS.cal} ${dateStr}</div>

          <div class="seat-progress-bar" title="${total - left} of ${total} seats booked">
            <div class="seat-progress-fill" style="width:${100 - pct}%"></div>
          </div>

          <p class="menu" style="margin:8px 0 14px;color:var(--text);font-size:14.5px">${esc(ev.menu_description)}</p>

          <form novalidate data-form="reserve" data-id="${ev.id}" data-price="${ev.ticket_price}" data-left="${left}">
            <input type="hidden" name="event_id" value="${ev.id}">
            <div class="row" style="align-items:flex-end;margin-bottom:12px">
              <div style="flex:1">
                <label style="font-size:12.5px;font-weight:700">Reserve Seats ${role() !== 'guest' ? '<span class="muted">(as ' + esc(me().split(' ')[0]) + ')</span>' : ''}</label>
                <input name="quantity" type="number" inputmode="numeric" min="1" max="${left}" value="${left ? '1' : '0'}" placeholder="Seats (e.g. 2)" ${left ? '' : 'disabled'} style="margin:0">
              </div>
              <div style="text-align:right;padding-bottom:10px">
                <span class="muted" style="font-size:12px">Total:</span> <b class="price total">${fmt(left ? ev.ticket_price : 0)}</b>
              </div>
            </div>
            <div class="msg err" role="alert" hidden></div>
            ${f ? '<div class="msg ok" role="status"><b>Reservation Confirmed!</b> ' + esc(flash.text) + ' <a href="#tickets">View My Tickets</a></div>' : ''}
            <button type="submit" style="width:100%" ${left ? '' : 'disabled'}>${left ? 'Reserve Pop-up Seats' : 'Sold Out'}</button>
          </form>
        </div>
      `;
    }).join('');

    flash = null; // Clear flash banner after rendering

  } catch(err) {
    var g = $1('#eventGrid');
    if (g) g.innerHTML = '<div class="card empty"><p>Unable to load supper clubs at this moment.</p></div>';
  }
}

// ── VIEW 2: COMMERCIAL KITCHENS MARKETPLACE ─────────────────────────────────
async function renderKitchensView() {
  var view = $1('#appView');
  view.innerHTML = `
    <div class="dashboard-header">
      <div class="dashboard-title-area">
        <h1>Cairo Commercial Kitchen Spaces</h1>
        <p class="sub">Verified licensed commissary kitchens, bakery prep decks, and supper club venues available for hourly shift rental.</p>
        <button type="button" class="hiw-toggle-pill" data-act="toggle-hiw">
          <span>How shift rental works</span>
          <svg class="hiw-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>
      ${role() === 'host' ? '<button class="btn-primary-action" data-act="modal-kitchen">+ List a Kitchen</button>' : ''}
    </div>

    <!-- Educational "How Commercial Kitchen Rental Works" Section (Collapsible) -->
    <section class="how-it-works collapsed" id="hiwSection">
      <div class="hiw-header">
        <span class="hiw-badge">How It Works for Chefs & Food Entrepreneurs</span>
        <h2>Flexible Commercial Shifts with Zero Long-term Lease</h2>
        <p class="muted">Rent licensed commercial kitchen infrastructure by the hour for prep, production, or live pop-up dinner services.</p>
      </div>
      <div class="hiw-grid">
        <div class="hiw-step">
          <div class="hiw-num">01</div>
          <h3>MOH Health Licensed</h3>
          <p>Every commercial facility in our network holds active Ministry of Health permits and commercial operating licenses.</p>
        </div>
        <div class="hiw-step">
          <div class="hiw-num">02</div>
          <h3>Flexible Off-Peak Shifts</h3>
          <p>Book morning prep, afternoon bakery runs, or late-night dinners with transparent rates starting from 240 EGP/hour.</p>
        </div>
        <div class="hiw-step">
          <div class="hiw-num">03</div>
          <h3>Turnkey Equipment</h3>
          <p>Walk-in chillers, convection ovens, 6-burner gas ranges, stainless steel stations, and optional guest dining rooms.</p>
        </div>
        <div class="hiw-step">
          <div class="hiw-num">04</div>
          <h3>Verified Host Confirmation</h3>
          <p>Request open shift slots directly. Kitchen hosts confirm bookings within 24 hours with standard deposit escrow protection.</p>
        </div>
      </div>
    </section>

    <!-- Search Box -->
    <div class="search-box">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" class="search-ico"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="search" id="kSearch" placeholder="Search by kitchen name, equipment, Zamalek, Maadi, Dokki, New Cairo..." autocomplete="off">
    </div>

    <!-- Operational Filter Rows -->
    <div class="filter-row">
      <div id="districtChips" class="district-chips"></div>
      <div id="setupChips" class="setup-chips"></div>
      <div id="rateChips" class="rate-chips"></div>
      <div id="equipChips" class="chips"></div>
    </div>

    <p class="muted" id="count" style="font-size:13.5px;font-weight:600;margin:16px 0 12px"></p>
    <div id="kitchenList">${skeletonCards(3)}</div>
  `;

  updateKitchenFiltersUI();

  try {
    var fetches = [api('GET', '/kitchens'), api('GET', '/slots')];
    if (role() === 'chef') {
      fetches.push(api('GET', '/bookings'));
    }
    var results = await Promise.all(fetches);
    S.kitchens = results[0].kitchens || [];
    S.slots = results[1].slots || [];
    if (results[2] && results[2].bookings) {
      S.bookings = results[2].bookings;
    }

    renderFilteredKitchens();
  } catch(err) {
    var kl = $1('#kitchenList');
    if (kl) kl.innerHTML = '<div class="card empty"><p>Unable to load kitchens.</p></div>';
  }
}

function updateKitchenFiltersUI() {
  var dEl = $1('#districtChips');
  var sEl = $1('#setupChips');
  var rEl = $1('#rateChips');
  var eEl = $1('#equipChips');
  if (!dEl) return;

  dEl.innerHTML = DISTRICTS.map(d =>
    `<button type="button" class="district-chip${S.district === d ? ' on' : ''}" data-act="district" data-district="${d}">${d}</button>`
  ).join('');

  sEl.innerHTML = SETUPS.map(s =>
    `<button type="button" class="setup-chip${S.setup === s ? ' on' : ''}" data-act="setup" data-setup="${s}">${s}</button>`
  ).join('');

  if (rEl) {
    rEl.innerHTML = RATES.map(r =>
      `<button type="button" class="rate-chip${(S.maxRate || 'All Rates') === r ? ' on' : ''}" data-act="rate" data-rate="${r}">${r}</button>`
    ).join('');
  }

  eEl.innerHTML = EQUIP.map(t =>
    `<button type="button" class="chip${S.filters.indexOf(t) > -1 ? ' on' : ''}" data-act="filter" data-tag="${t}">${t}</button>`
  ).join('') + ((S.filters.length || S.district !== 'All' || S.setup !== 'All Setups' || (S.maxRate && S.maxRate !== 'All Rates') || S.searchQuery) ? '<button type="button" class="chip clear" data-act="clearfilter">Reset Filters</button>' : '');
}

function renderFilteredKitchens() {
  var list = S.kitchens || [];
  var q = (S.searchQuery || '').trim().toLowerCase();

  var filtered = list.filter(function(k) {
    // District
    if (S.district && S.district !== 'All') {
      if (!k.address || k.address.toLowerCase().indexOf(S.district.toLowerCase()) === -1) {
        return false;
      }
    }
    // Setup Type
    if (S.setup && S.setup !== 'All Setups') {
      var sLow = S.setup.toLowerCase();
      var kNameLow = (k.name || '').toLowerCase();
      var kEquipLow = (k.equipment || k.equip || []).join(' ').toLowerCase();
      if (sLow.indexOf('bakery') > -1 && kNameLow.indexOf('baker') === -1 && kEquipLow.indexOf('convection') === -1) return false;
      if (sLow.indexOf('supper') > -1 && kEquipLow.indexOf('induction') === -1 && kNameLow.indexOf('studio') === -1 && kNameLow.indexOf('dining') === -1) return false;
      if (sLow.indexOf('hot') > -1 && kEquipLow.indexOf('gas range') === -1) return false;
      if (sLow.indexOf('cold') > -1 && kEquipLow.indexOf('chiller') === -1 && kEquipLow.indexOf('fridge') === -1) return false;
    }
    // Rates
    if (S.maxRate && S.maxRate !== 'All Rates') {
      var rateNum = Number(k.hourly_rate || 0);
      if (S.maxRate === '< 300 EGP' && rateNum >= 300) return false;
      if (S.maxRate === '300–350 EGP' && (rateNum < 300 || rateNum > 350)) return false;
      if (S.maxRate === '350+ EGP' && rateNum < 350) return false;
    }
    // Equipment
    if (S.filters && S.filters.length) {
      var kEquip = (k.equipment || k.equip || []).map(e => e.toLowerCase());
      var hasAll = S.filters.every(f => kEquip.some(ke => ke.indexOf(f.toLowerCase()) > -1));
      if (!hasAll) return false;
    }
    // Text search query
    if (q) {
      var matchName = (k.name || '').toLowerCase().indexOf(q) > -1;
      var matchAddr = (k.address || '').toLowerCase().indexOf(q) > -1;
      var matchEquip = (k.equipment || k.equip || []).some(e => e.toLowerCase().indexOf(q) > -1);
      if (!matchName && !matchAddr && !matchEquip) return false;
    }
    return true;
  });

  var countEl = $1('#count');
  if (countEl) countEl.textContent = 'Showing ' + filtered.length + ' of ' + list.length + ' verified commercial kitchens';

  var kl = $1('#kitchenList');
  if (!kl) return;

  if (!filtered.length) {
    kl.innerHTML = `
      <div class="card empty" style="text-align:center;padding:40px 20px">
        <h2>No Commercial Kitchens Found</h2>
        <p class="muted">Try adjusting your district or setup filters.</p>
        <button class="ghost" data-act="clearfilter" style="margin-top:12px">Reset All Filters</button>
      </div>
    `;
    return;
  }

  kl.innerHTML = filtered.map(k => {
    var sl = S.slots.filter(s => s.kitchen_id === k.id);
    var st = k.verification_status || k.status || 'pending';
    var equip = k.equipment || k.equip || [];
    var photo = hashPhoto(k.name || k.id, KITCHEN_PHOTOS);
    var openSlots = sl.filter(s => s.status !== 'booked');

    return `
      <div class="card lift">
        <div class="card-media">
          <img class="card-img" src="${photo}" alt="${esc(k.name)}" loading="lazy">
          <div class="card-badge-top">${st === 'verified' ? '✓ Licensed & Inspected' : 'Pending Verification'}</div>
          <div class="card-badge-bottom">${ICONS.pin} ${esc(k.address)}</div>
        </div>

        <div class="row">
          <div>
            <b class="kt" style="font-size:20px">${esc(k.name)}</b>
            <div class="muted" style="font-size:13px;margin-top:2px">MOH Permit: ${esc(k.license_info)}</div>
          </div>
          <div style="text-align:right">
            <div class="price" style="font-size:22px">${fmt(k.hourly_rate)}</div>
            <span class="muted" style="font-size:12px">hourly shift rate</span>
          </div>
        </div>

        <!-- Spec Pills -->
        <div class="chips sm" style="margin:12px 0 10px">
          ${equip.map(e => '<span class="chip">' + esc(e) + '</span>').join('')}
          <span class="chip" style="background:var(--ok-bg);color:var(--ok);border-color:var(--ok-border)">Health Code Checked</span>
        </div>

        <!-- Shift Slot Availability Preview -->
        <div class="slot-preview-box">
          <div class="slot-preview-title">
            <span>Next Open Shift Slots</span>
            <span style="color:var(--accent);font-weight:700">${openSlots.length} available</span>
          </div>
          ${openSlots.length ? openSlots.slice(0, 3).map(s => {
            var hrs = slotHours(s);
            var cost = hrs * (k.hourly_rate || 250);
            return `
              <div class="slot-preview-item">
                <span>${ICONS.cal} ${fmtSlot(s)} (${hrs} hrs)</span>
                <b>${fmt(cost)}</b>
              </div>
            `;
          }).join('') : '<div class="muted" style="font-size:12.5px">No open shifts scheduled right now.</div>'}
        </div>

        <div class="row" style="margin-top:14px;gap:8px">
          <button class="ghost" data-act="kitchen-detail" data-id="${k.id}" style="flex:1">View Details & Rules</button>
          <button data-act="kitchen-detail" data-id="${k.id}" style="flex:1">Request Shift Booking</button>
        </div>
      </div>
    `;
  }).join('');
}

// ── KITCHEN DETAIL DRAWER / MODAL ───────────────────────────────────────────
function openKitchenDetail(kId) {
  var k = by(S.kitchens, kId);
  if (!k) return;

  var sl = S.slots.filter(s => s.kitchen_id === k.id);
  var photo = hashPhoto(k.name || k.id, KITCHEN_PHOTOS);
  var equip = k.equipment || k.equip || [];
  var st = k.verification_status || k.status || 'pending';
  var openSlots = sl.filter(s => s.status !== 'booked');

  var isChef = role() === 'chef';
  var authPromptHtml = '';
  if (!isChef) {
    authPromptHtml = `
      <div style="background:var(--warn-bg);border:1px solid var(--warn-border);padding:14px;border-radius:12px;margin:16px 0">
        <b style="color:var(--warn);font-size:13px">Guest Chef Account Required to Request Shifts</b>
        <p class="muted" style="font-size:12px;margin:4px 0 10px">Sign in as a Chef to submit shift booking requests to this kitchen host.</p>
        <button class="demo-role-btn active" data-act="demo" data-role="chef" style="font-size:12px">⚡ 1-Click Continue as Chef Omar</button>
      </div>
    `;
  }

  var slotsHtml = '';
  if (!openSlots.length) {
    slotsHtml = '<div class="muted" style="padding:14px 0">No open shift slots available for this kitchen at this time.</div>';
  } else {
    slotsHtml = openSlots.map(s => {
      var hrs = slotHours(s);
      var cost = hrs * (k.hourly_rate || 250);
      var mine = S.bookings.filter(b => b.slot_id === s.id && (b.chef_id === S.session?.id || b.chef === me()))[0];
      var btnHtml = '';

      if (mine) {
        btnHtml = B(mine.status, 'Request ' + mine.status);
      } else if (isChef) {
        btnHtml = `<button data-act="request" data-id="${s.id}" style="padding:6px 14px;font-size:13px">Request Shift</button>`;
      } else {
        btnHtml = `<button data-act="demo" data-role="chef" style="padding:6px 14px;font-size:12px">Sign in to Book</button>`;
      }

      return `
        <div class="shift-select-card">
          <div>
            <div style="font-weight:700;font-size:14px">${ICONS.cal} ${fmtSlot(s)}</div>
            <div class="muted" style="font-size:12px">${hrs} Hours Shift · Total: <b>${fmt(cost)}</b></div>
          </div>
          ${btnHtml}
        </div>
      `;
    }).join('');
  }

  var modalHtml = `
    <div class="kitchen-detail-modal">
      <img class="detail-img-banner" src="${photo}" alt="${esc(k.name)}">
      
      <div class="row" style="margin-bottom:8px">
        <div>
          <span class="ticket-badge">${st === 'verified' ? '✓ MOH Licensed Commercial Space' : 'Pending License Verification'}</span>
          <h2 style="margin:4px 0 0;font-size:22px;font-weight:800">${esc(k.name)}</h2>
        </div>
        <div style="text-align:right">
          <div class="price" style="font-size:22px">${fmt(k.hourly_rate)}</div>
          <span class="muted" style="font-size:12px">hourly rate</span>
        </div>
      </div>

      <div class="muted" style="font-size:14px;margin-bottom:16px">${ICONS.pin} ${esc(k.address)} · Permit #${esc(k.license_info)}</div>

      <div class="detail-section-title">Commercial Equipment & Stations</div>
      <div class="spec-grid">
        ${equip.map(e => '<div class="spec-item"><span style="color:var(--ok)">✓</span> <b>' + esc(e) + '</b></div>').join('')}
        <div class="spec-item"><span style="color:var(--ok)">✓</span> Stainless Steel Prep Island</div>
        <div class="spec-item"><span style="color:var(--ok)">✓</span> Grease Trap & Extraction Hood</div>
        <div class="spec-item"><span style="color:var(--ok)">✓</span> 3-Compartment Sanitizing Sink</div>
      </div>

      <div class="detail-section-title">House Rules & Food Safety Standards</div>
      <ul class="rule-list">
        <li class="rule-item"><span class="rule-icon">✓</span> Hairnets, clean chef uniform, and pre-shift walk-in temperature log mandatory.</li>
        <li class="rule-item"><span class="rule-icon">✓</span> Complete station sanitization and oil waste disposal required prior to checkout.</li>
        <li class="rule-item"><span class="rule-icon">✓</span> Supper club dining room access permitted for approved tasting menus.</li>
        <li class="rule-item"><span class="rule-icon">✓</span> 100% refundable security deposit returned within 24 hours of inspection.</li>
      </ul>

      <div class="host-badge-box">
        <div>
          <div style="font-weight:700;font-size:13.5px">Commercial Kitchen Host · ${esc(k.host_name || 'Verified Host')}</div>
          <div class="muted" style="font-size:12px">Host average booking confirmation time: Under 2 hours</div>
        </div>
        <span class="badge approved">Verified Operator</span>
      </div>

      <div class="detail-section-title">Available Shift Slots</div>
      ${slotsHtml}
      ${authPromptHtml}
    </div>
  `;

  openModal(k.name, modalHtml);
}

// ── VIEW 3: DINER TICKETS & RESERVATIONS ────────────────────────────────────
async function renderTicketsView() {
  if (role() === 'guest') {
    location.replace('#login');
    return;
  }

  var view = $1('#appView');
  view.innerHTML = `
    <div class="hero">
      <h1>My Pop-up Reservations</h1>
      <p>Your confirmed supper club admissions and admission ticket stubs.</p>
    </div>
    <div id="ticketFeed">${skeletonCards(2)}</div>
  `;

  try {
    var data = await api('GET', '/tickets');
    var tickets = data.tickets || [];
    var feed = $1('#ticketFeed');
    if (!feed) return;

    if (!tickets.length) {
      feed.innerHTML = `
        <div class="card empty" style="text-align:center;padding:48px 20px">
          <div style="font-size:36px;margin-bottom:12px">🎟️</div>
          <h2>No Upcoming Reservations Yet</h2>
          <p class="muted" style="max-width:400px;margin:0 auto 16px">Browse Cairo's exclusive guest chef supper clubs to reserve your seat at the table.</p>
          <a class="nav-cta" href="#events" style="display:inline-block">Explore Cairo Supper Clubs</a>
        </div>
      `;
      return;
    }

    feed.innerHTML = tickets.map(t => {
      var dateStr = t.starts_at ? new Date(t.starts_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Confirmed date';
      return `
        <div class="card ticket-card">
          <div class="row" style="margin-bottom:6px">
            <div>
              <span class="ticket-badge">DINING ADMISSION PASS</span>
              <h3 style="margin:4px 0 0;font-size:19px;font-weight:800">${esc(t.event_title)}</h3>
            </div>
            ${B('approved', 'Confirmed')}
          </div>
          <div class="ticket-divider"></div>
          <div class="ticket-body">
            <div class="ticket-info">
              <span>Date & Time</span>
              <b>${ICONS.cal} ${dateStr}</b>
            </div>
            <div class="ticket-info">
              <span>Venue & Chef</span>
              <b>${ICONS.pin} ${esc(t.kitchen_name)}</b>
              <div class="muted" style="font-size:12.5px;margin-top:2px">${ICONS.chef} Chef ${esc(t.chef_name)}</div>
            </div>
            <div class="ticket-info">
              <span>Reserved Seats</span>
              <b>${t.quantity} seat${t.quantity > 1 ? 's' : ''} (${fmt(t.unit_price)}/seat)</b>
            </div>
            <div class="ticket-info">
              <span>Total Paid</span>
              <b class="price" style="font-size:18px">${fmt(t.total_price)}</b>
            </div>
          </div>
          <div class="ticket-footer">
            <span class="ticket-ref">PASS #T-${t.ref_no}</span>
            <button type="button" class="ghost" data-act="print-ticket" style="font-size:12px;padding:5px 14px">Print / Save Pass</button>
          </div>
        </div>
      `;
    }).join('');

  } catch(err) {
    var f = $1('#ticketFeed');
    if (f) f.innerHTML = '<div class="card empty"><p>Unable to load reservations.</p></div>';
  }
}

// ── VIEW 4: CHEF DASHBOARD ──────────────────────────────────────────────────
async function renderChefView() {
  if (role() !== 'chef') {
    toast('Chef account required to access Chef Hub.');
    location.replace('#login');
    return;
  }

  var view = $1('#appView');
  view.innerHTML = `
    <div class="dashboard-header">
      <div class="dashboard-title-area">
        <h1>Chef Culinary Hub</h1>
        <p class="sub">Manage kitchen slot requests, booking approvals, and published supper clubs.</p>
      </div>
      <button class="btn-primary-action" data-act="modal-event">+ Host a Pop-up</button>
    </div>

    <div id="chefStats"></div>

    <h2>My Kitchen Slot Bookings</h2>
    <div id="chefBookingsFeed">${skeletonCards(2)}</div>

    <h2>My Published Pop-up Dinners</h2>
    <div id="chefEventsFeed">${skeletonCards(1)}</div>
  `;

  try {
    var [bData, evData] = await Promise.all([
      api('GET', '/bookings').catch(() => ({ bookings: [] })),
      api('GET', '/events/mine').catch(() => ({ events: [] }))
    ]);
    S.bookings = bData.bookings || [];
    S.events = evData.events || [];

    var pCount = S.bookings.filter(b => b.status === 'pending').length;
    var aCount = S.bookings.filter(b => b.status === 'approved').length;
    $1('#chefStats').innerHTML = `
      <div class="stats">
        <div class="stat"><b>${pCount}</b><span>Pending Requests</span></div>
        <div class="stat"><b>${aCount}</b><span>Approved Kitchens</span></div>
        <div class="stat"><b>${S.events.length}</b><span>Active Dinners</span></div>
      </div>
    `;

    var bf = $1('#chefBookingsFeed');
    if (!S.bookings.length) {
      bf.innerHTML = `
        <div class="card empty" style="text-align:center;padding:32px 20px">
          <p class="muted">You have no active kitchen booking requests.</p>
          <a class="btn" href="#kitchens" style="margin-top:10px">Find a Commercial Kitchen</a>
        </div>
      `;
    } else {
      bf.innerHTML = S.bookings.map(b => bCard(b, false)).join('');
    }

    var ef = $1('#chefEventsFeed');
    if (!S.events.length) {
      ef.innerHTML = `
        <div class="card empty" style="text-align:center;padding:32px 20px">
          <p class="muted">No pop-up events published yet.</p>
          <button class="nav-cta" data-act="modal-event" style="margin-top:10px">+ Host Your First Pop-up</button>
        </div>
      `;
    } else {
      ef.innerHTML = S.events.map(ev => `
        <div class="card">
          <div class="row">
            <b class="kt" style="font-size:18px">${esc(ev.title)}</b>
            ${ev.booking_status === 'approved' ? B('approved', 'Live on Marketplace') : B('pending', 'Awaiting Kitchen Host Approval')}
          </div>
          <div class="muted" style="margin:4px 0 8px">${ICONS.pin} ${esc(ev.kitchen_name)}</div>
          <div class="row">
            <span>Ticket Price: <b>${fmt(ev.ticket_price)}</b></span>
            <span class="muted">${ev.seats_sold || 0} of ${ev.capacity} seats sold</span>
          </div>
        </div>
      `).join('');
    }

  } catch(err) {
    toast(err.message);
  }
}

// ── VIEW 5: HOST DASHBOARD ──────────────────────────────────────────────────
async function renderHostView() {
  if (role() !== 'host') {
    toast('Kitchen Host account required.');
    location.replace('#login');
    return;
  }

  var view = $1('#appView');
  view.innerHTML = `
    <div class="dashboard-header">
      <div class="dashboard-title-area">
        <h1>Kitchen Host Hub</h1>
        <p class="sub">Signed in as <b>${esc(me())}</b>. Manage commercial listings, shift slots, and chef requests.</p>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn-primary-action" data-act="modal-kitchen">+ List Kitchen</button>
        <button class="btn-primary-action ghost" data-act="modal-slot">+ Add Shift Slot</button>
      </div>
    </div>

    <div id="hostStats"></div>

    <h2>Incoming Booking Requests</h2>
    <div id="hostRequestsFeed">${skeletonCards(2)}</div>

    <h2>My Listed Kitchens</h2>
    <div id="hostKitchensFeed">${skeletonCards(1)}</div>
  `;

  try {
    var [bData, kData] = await Promise.all([
      api('GET', '/bookings').catch(() => ({ bookings: [] })),
      api('GET', '/kitchens/mine').catch(() => api('GET', '/kitchens')).catch(() => ({ kitchens: [] }))
    ]);
    S.bookings = bData.bookings || [];
    var hostId = S.session ? S.session.id : null;
    S.kitchens = (kData.kitchens || []).filter(k => !hostId || !k.host_id || k.host_id === hostId);

    var pCount = S.bookings.filter(b => b.status === 'pending').length;
    var aCount = S.bookings.filter(b => b.status === 'approved').length;

    $1('#hostStats').innerHTML = `
      <div class="stats">
        <div class="stat"><b>${pCount}</b><span>Pending Requests</span></div>
        <div class="stat"><b>${aCount}</b><span>Approved Shifts</span></div>
        <div class="stat"><b>${S.kitchens.length}</b><span>Kitchens Listed</span></div>
      </div>
    `;

    var rf = $1('#hostRequestsFeed');
    if (!S.bookings.length) {
      rf.innerHTML = '<div class="card empty"><p class="muted">No booking requests from chefs yet.</p></div>';
    } else {
      rf.innerHTML = S.bookings.map(b => bCard(b, true)).join('');
    }

    var kf = $1('#hostKitchensFeed');
    if (!S.kitchens.length) {
      kf.innerHTML = `
        <div class="card empty" style="text-align:center;padding:32px 20px">
          <p class="muted">You have not listed any commercial kitchens yet.</p>
          <button class="nav-cta" data-act="modal-kitchen" style="margin-top:10px">+ List Your Kitchen</button>
        </div>
      `;
    } else {
      kf.innerHTML = S.kitchens.map(k => `
        <div class="card">
          <div class="row">
            <b class="kt" style="font-size:18px">${esc(k.name)}</b>
            ${B(k.verification_status, k.verification_status === 'verified' ? 'Verified License' : 'Pending Review')}
          </div>
          <div class="muted" style="margin:4px 0">${ICONS.pin} ${esc(k.address)}</div>
          <div class="muted">Rate: <b>${fmt(k.hourly_rate)} / hr</b> · License: ${esc(k.license_info)}</div>
        </div>
      `).join('');
    }

  } catch(err) {
    toast(err.message);
  }
}

// ── VIEW 6: ADMIN CONSOLE (RBAC Guarded) ────────────────────────────────────
async function renderAdminView() {
  if (role() !== 'admin') {
    toast('Access denied. Administrator privileges required.');
    location.replace('#events');
    return;
  }

  var view = $1('#appView');
  view.innerHTML = `
    <div class="dashboard-header">
      <div class="dashboard-title-area">
        <h1>Platform Administration Console</h1>
        <p class="sub">Commercial license verifications, compliance audits, and platform metrics.</p>
      </div>
    </div>

    <div id="adminStatsFeed">${skeletonCards(1)}</div>

    <h2>Commercial Licenses Awaiting Verification</h2>
    <div id="adminPendingFeed">${skeletonCards(2)}</div>
  `;

  try {
    var [sData, kData] = await Promise.all([
      api('GET', '/admin/stats'),
      api('GET', '/admin/kitchens?status=pending')
    ]);
    var st = sData.stats || {};
    $1('#adminStatsFeed').innerHTML = `
      <div class="banner">
        <div class="bn-h">${ICONS.shield} Platform Health Overview <span class="badge">Live Production</span></div>
        <div class="bn-g">
          <div><b>${st.kitchens_verified || 0}</b><span>Verified Kitchens</span></div>
          <div><b>${st.kitchens_pending || 0}</b><span>Pending Review</span></div>
          <div><b>${st.total_bookings || 0}</b><span>Kitchen Bookings</span></div>
          <div><b>${st.seats_sold || 0}</b><span>Tickets Sold</span></div>
        </div>
        <div class="bn-f">Total Marketplace Ticket Revenue: <b>${fmt(st.revenue_egp)}</b></div>
      </div>
    `;

    var pending = kData.kitchens || [];
    var pf = $1('#adminPendingFeed');
    if (!pending.length) {
      pf.innerHTML = '<div class="card empty"><p class="muted">All commercial kitchen licenses are verified and up to date.</p></div>';
    } else {
      pf.innerHTML = pending.map(k => `
        <div class="card">
          <div class="row">
            <b class="kt" style="font-size:18px">${esc(k.name)}</b>
            ${B('pending', 'Pending Approval')}
          </div>
          <div class="muted" style="margin:4px 0">${ICONS.pin} ${esc(k.address)}</div>
          <div class="muted">License info: <b>${esc(k.license_info)}</b> · Rate: ${fmt(k.hourly_rate)} / hr</div>
          <div class="row act" style="margin-top:12px">
            <button data-act="verify" data-id="${k.id}">Approve License</button>
            <button class="bad" data-act="reject" data-id="${k.id}">Reject</button>
          </div>
        </div>
      `).join('');
    }

  } catch(err) {
    toast(err.message);
  }
}

// ── VIEW 7: SIGN IN / REGISTER ──────────────────────────────────────────────
function renderLoginView() {
  var view = $1('#appView');
  view.innerHTML = `
    <div class="hero">
      <h1>Join GhostKitchen & Supper Club</h1>
      <p>Connect with Cairo's culinary creators, commercial kitchen network, and secret supper clubs.</p>
    </div>

    ${S.session ? `
      <div class="card row" style="margin-bottom:20px">
        <div>
          <div class="muted">Currently signed in as</div>
          <b style="font-size:17px">${esc(me())}</b> ${B('approved', role())}
        </div>
        <button class="logout-btn" data-act="logout">Sign out</button>
      </div>
    ` : ''}

    <form class="card" novalidate data-form="login">
      <h2>Sign in or Create Account</h2>
      <label>Full Name</label>
      <input name="name" type="text" value="Nour Hassan" placeholder="e.g. Nour Hassan">

      <label>Email Address</label>
      <input name="email" type="email" value="nour@example.com" placeholder="you@example.com">

      <label>Password</label>
      <input name="password" type="password" value="password123" placeholder="Choose a secure password">

      <label>I am joining primarily as a:</label>
      <div class="seg" style="margin-bottom:16px">
        <label><input type="radio" name="role" value="attendee" checked><span>Dinner Guest</span></label>
        <label><input type="radio" name="role" value="chef"><span>Guest Chef</span></label>
        <label><input type="radio" name="role" value="host"><span>Kitchen Host</span></label>
      </div>

      <div class="msg err" role="alert" hidden></div>
      <button type="submit" style="width:100%">Continue</button>
    </form>
  `;
}

function bCard(b, isHost) {
  var s = by(S.slots, b.slot_id) || { start_time: b.start_time, end_time: b.end_time };
  var kName = b.kitchen_name || (by(S.kitchens, s.kitchen_id) || {}).name || 'Kitchen Space';
  var num = b.booking_no ? '#' + b.booking_no : '#' + (b.id || '').slice(0, 6);
  var chefLabel = b.chef_name || b.chef || 'Chef';

  return `
    <div class="card">
      <div class="row">
        <b>Booking ${num}</b>
        ${B(b.status)}
      </div>
      <div class="muted" style="margin:4px 0">${isHost ? ICONS.chef + ' Guest Chef: ' + esc(chefLabel) + ' · ' : ''}${ICONS.pin} ${esc(kName)}</div>
      <div>${ICONS.cal} ${fmtSlot(s)}</div>
      ${isHost && b.status === 'pending' ? `
        <div class="row act" style="margin-top:12px">
          <button data-act="approve" data-id="${b.id}">Approve Request</button>
          <button class="bad" data-act="decline" data-id="${b.id}">Decline</button>
        </div>
      ` : ''}
    </div>
  `;
}

// ── ROUTER ──────────────────────────────────────────────────────────────────
function route() {
  var r = getActiveRoute();
  updateNav();

  var titles = {
    events: 'Pop-ups & Supper Clubs — GhostKitchen Cairo',
    kitchens: 'Commercial Kitchens & Spaces — GhostKitchen Cairo',
    tickets: 'My Dining Passes — GhostKitchen Cairo',
    chef: 'Chef Culinary Hub — GhostKitchen Cairo',
    host: 'Kitchen Host Hub — GhostKitchen Cairo',
    admin: 'Platform Admin Console — GhostKitchen Cairo',
    login: 'Sign In / Register — GhostKitchen Cairo'
  };
  document.title = titles[r] || 'GhostKitchen & Supper Club Cairo';

  if (r === 'events') {
    renderEventsView();
  } else if (r === 'kitchens') {
    renderKitchensView();
  } else if (r === 'tickets') {
    renderTicketsView();
  } else if (r === 'chef') {
    renderChefView();
  } else if (r === 'host') {
    renderHostView();
  } else if (r === 'admin') {
    renderAdminView();
  } else if (r === 'login') {
    renderLoginView();
  } else {
    renderEventsView();
  }
}

// ── AUTHENTICATION ──────────────────────────────────────────────────────────
async function loginOrRegister(name, email, password, r) {
  try {
    var data = await api('POST', '/login', { email: email, password: password });
    localStorage.setItem('gk_token', data.token);
    S.session = data.user;
    saveSession();
    toast('Welcome back, ' + data.user.name + '!');
    redirectAfterAuth(data.user.role);
  } catch (err) {
    if (err.message.indexOf('Invalid email') > -1 || err.message.indexOf('not found') > -1) {
      try {
        var regData = await api('POST', '/register', {
          name: name || email.split('@')[0],
          email: email,
          password: password,
          role: r
        });
        localStorage.setItem('gk_token', regData.token);
        S.session = regData.user;
        saveSession();
        toast('Account created! Signed in as ' + regData.user.name);
        redirectAfterAuth(regData.user.role);
        return;
      } catch (regErr) {
        toast('Registration error: ' + regErr.message);
        throw regErr;
      }
    }
    toast('Sign in failed: ' + err.message);
    throw err;
  }
}

function redirectAfterAuth(r) {
  if (r === 'host') setRoute('#host-dashboard');
  else if (r === 'chef') setRoute('#kitchens');
  else if (r === 'admin') setRoute('#admin-console');
  else setRoute('#events');
}

// ── EVENT LISTENERS (CLICKS & ACTIONS) ──────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

document.addEventListener('click', async e => {
  // Theme toggle
  if (e.target.closest('#themeToggle')) {
    e.preventDefault();
    toggleTheme();
    return;
  }

  // Demo drawer toggle (minimize / expand)
  if (e.target.closest('#demoToggle')) {
    e.preventDefault();
    var d = $1('#demoDrawer');
    if (d) d.classList.toggle('minimized');
    return;
  }
  if (e.target.closest('[data-act="close-demo"]')) {
    e.preventDefault();
    var d = $1('#demoDrawer');
    if (d) d.classList.add('minimized');
    return;
  }

  // Toggle "How shift rental works"
  if (e.target.closest('[data-act="toggle-hiw"]')) {
    e.preventDefault();
    var hiw = $1('#hiwSection');
    var btn = e.target.closest('[data-act="toggle-hiw"]');
    if (hiw) {
      hiw.classList.toggle('collapsed');
      if (btn) btn.classList.toggle('active', !hiw.classList.contains('collapsed'));
    }
    return;
  }

  // Modal close
  if (e.target.closest('[data-act="modal-close"]') || e.target.id === 'modalContainer') {
    closeModal();
    return;
  }

  // Print ticket
  if (e.target.closest('[data-act="print-ticket"]')) {
    window.print();
    return;
  }

  var b = e.target.closest('[data-act]');
  if (!b) return;
  var a = b.dataset.act;
  var id = b.dataset.id;

  // Reviewer Demo Persona Switching
  if (a === 'demo') {
    var dRole = b.dataset.role;
    var d = DEMO_USERS[dRole];
    if (d) {
      toast('Switching persona to ' + d.name + ' (' + d.role + ')...');
      try {
        var res = await api('POST', '/demo-login', { role: dRole });
        localStorage.setItem('gk_token', res.token);
        S.session = res.user;
        saveSession();
        updateNav();
        redirectAfterAuth(res.user.role);
      } catch (err) {
        toast('Demo switch failed: ' + err.message);
      }
    }
    return;
  }

  // Cook or Host Call to Action
  if (a === 'open-cook-host') {
    setRoute('#login');
    return;
  }

  // Logout
  if (a === 'logout') {
    localStorage.removeItem('gk_token');
    S.session = null;
    saveSession();
    toast('Signed out successfully.');
    setRoute('#events');
    return;
  }

  // Kitchen Filters
  if (a === 'district') {
    S.district = b.dataset.district;
    renderFilteredKitchens();
    updateKitchenFiltersUI();
    return;
  }
  if (a === 'setup') {
    S.setup = b.dataset.setup;
    renderFilteredKitchens();
    updateKitchenFiltersUI();
    return;
  }
  if (a === 'rate') {
    S.maxRate = b.dataset.rate;
    renderFilteredKitchens();
    updateKitchenFiltersUI();
    return;
  }
  if (a === 'filter') {
    var i = S.filters.indexOf(b.dataset.tag);
    i > -1 ? S.filters.splice(i, 1) : S.filters.push(b.dataset.tag);
    renderFilteredKitchens();
    updateKitchenFiltersUI();
    return;
  }
  if (a === 'clearfilter') {
    S.filters = [];
    S.district = 'All';
    S.setup = 'All Setups';
    S.maxRate = 'All Rates';
    S.searchQuery = '';
    var si = $1('#kSearch');
    if (si) si.value = '';
    renderFilteredKitchens();
    updateKitchenFiltersUI();
    return;
  }

  // Kitchen Detail Drawer
  if (a === 'kitchen-detail') {
    openKitchenDetail(id);
    return;
  }

  // Open Creation Modals
  if (a === 'modal-kitchen') {
    openModal('List a Commercial Kitchen', `
      <form class="card" novalidate data-form="kitchen" style="border:none;box-shadow:none;padding:0;margin:0">
        <label>Kitchen / Studio Name</label>
        <input name="name" type="text" placeholder="e.g. Nile Artisan Culinary Hub" required>

        <label>Street Address & District</label>
        <input name="address" type="text" placeholder="e.g. 14 Kasr El Aini, Garden City, Cairo" required>

        <div class="grid2">
          <div>
            <label>MOH Permit / License</label>
            <input name="license_info" type="text" placeholder="e.g. LIC-9281 · Health Ministry" required>
          </div>
          <div>
            <label>Hourly Rate (EGP)</label>
            <input name="hourly_rate" type="number" placeholder="320" min="50" required>
          </div>
        </div>

        <label>Commercial Equipment (comma separated)</label>
        <input name="equip" type="text" placeholder="Walk-in chiller, Convection ovens, Gas range">

        <div class="msg err" role="alert" hidden></div>
        <button type="submit" style="width:100%;margin-top:10px">Submit for License Verification</button>
      </form>
    `);
    return;
  }

  if (a === 'modal-slot') {
    var kitchens = S.kitchens || [];
    if (!kitchens.length) {
      toast('Please list a kitchen before scheduling availability slots.');
      return;
    }
    openModal('Add Availability Shift Slot', `
      <form class="card" novalidate data-form="slot" style="border:none;box-shadow:none;padding:0;margin:0">
        <label>Select Commercial Kitchen</label>
        <select name="kitchen_id">
          ${kitchens.map(k => '<option value="' + k.id + '">' + esc(k.name) + '</option>').join('')}
        </select>

        <div class="grid2">
          <div>
            <label>Start Time</label>
            <input name="start_time" type="datetime-local" required>
          </div>
          <div>
            <label>End Time</label>
            <input name="end_time" type="datetime-local" required>
          </div>
        </div>

        <div class="msg err" role="alert" hidden></div>
        <button type="submit" style="width:100%;margin-top:10px">Publish Availability Slot</button>
      </form>
    `);
    return;
  }

  if (a === 'modal-event') {
    if (!S.bookings || !S.bookings.length) {
      try {
        var bRes = await api('GET', '/bookings');
        S.bookings = bRes.bookings || [];
      } catch (err) {}
    }
    var approvedBookings = (S.bookings || []).filter(b => b.status === 'approved');
    if (!approvedBookings.length) {
      toast('You need an approved kitchen shift before publishing a pop-up dinner.');
      setRoute('#kitchens');
      return;
    }
    openModal('Publish Pop-up Supper Club Dinner', `
      <form class="card" novalidate data-form="event" style="border:none;box-shadow:none;padding:0;margin:0">
        <label>Select Approved Kitchen Shift</label>
        <select name="booking_id">
          ${approvedBookings.map(b => '<option value="' + b.id + '">#' + (b.booking_no || b.id.slice(0, 6)) + ' · ' + esc(b.kitchen_name || 'Kitchen') + '</option>').join('')}
        </select>

        <label>Pop-up Title & Theme</label>
        <input name="title" type="text" placeholder="e.g. Modern Cairo: 5-Course Nile Tasting Menu" required>

        <label>Menu Description & Concept</label>
        <textarea name="menu_description" rows="3" placeholder="Describe the courses, seasonal ingredients, and atmosphere..." required></textarea>

        <div class="grid2">
          <div>
            <label>Ticket Price (EGP)</label>
            <input name="ticket_price" type="number" value="450" min="50" required>
          </div>
          <div>
            <label>Guest Capacity (Seats)</label>
            <input name="capacity" type="number" value="16" min="1" required>
          </div>
        </div>

        <div class="msg err" role="alert" hidden></div>
        <button type="submit" style="width:100%;margin-top:10px">Publish Pop-up Event</button>
      </form>
    `);
    return;
  }

  // Live Backend Mutations
  try {
    if (a === 'request') {
      if (role() !== 'chef') {
        toast('Chef account required. Switching to Chef persona...');
        var demoRes = await api('POST', '/demo-login', { role: 'chef' });
        localStorage.setItem('gk_token', demoRes.token);
        S.session = demoRes.user;
        saveSession();
        updateNav();
      }
      await api('POST', '/bookings', { slot_id: id });
      toast('Booking request sent to kitchen host!');
      closeModal();
      route();
    } else if (a === 'approve' && role() === 'host') {
      await api('PATCH', '/bookings/' + id + '/status', { status: 'approved' });
      toast('Chef booking approved!');
      route();
    } else if (a === 'decline' && role() === 'host') {
      await api('PATCH', '/bookings/' + id + '/status', { status: 'declined' });
      toast('Booking declined.');
      route();
    } else if (a === 'verify' && role() === 'admin') {
      await api('PATCH', '/kitchens/' + id + '/verify', { status: 'verified' });
      toast('Commercial license approved!');
      route();
    } else if (a === 'reject' && role() === 'admin') {
      await api('PATCH', '/kitchens/' + id + '/verify', { status: 'rejected' });
      toast('License rejected.');
      route();
    }
  } catch (err) {
    toast('Action error: ' + err.message);
  }
});

// ── FORM SUBMISSIONS ────────────────────────────────────────────────────────
function fail(f, m, el) {
  var er = $1('.msg.err', f);
  if (er) { er.textContent = m; er.hidden = false; }
  toast(m);
  if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
}

document.addEventListener('submit', async e => {
  var f = e.target.closest('form');
  if (!f) return;
  e.preventDefault();

  var subBtn = f.querySelector('button[type="submit"]');
  if (subBtn) {
    subBtn.disabled = true;
    subBtn.style.opacity = '0.6';
  }

  var er = $1('.msg.err', f);
  if (er) er.hidden = true;
  f.querySelectorAll('[aria-invalid]').forEach(i => i.removeAttribute('aria-invalid'));

  var t = f.dataset.form, x = f.elements, v = n => (x[n] ? x[n].value.trim() : '');

  try {
    if (t === 'login') {
      if (!v('email')) return fail(f, 'Please enter your email.', x.email);
      if (!v('password')) return fail(f, 'Please enter your password.', x.password);
      var r = f.querySelector('input[name="role"]:checked')?.value || 'attendee';
      await loginOrRegister(v('name'), v('email'), v('password'), r);
    }
    else if (t === 'kitchen') {
      if (!v('name') || !v('address') || !v('license_info')) return fail(f, 'All fields are required.');
      if (!(+x.hourly_rate.value > 0)) return fail(f, 'Enter an hourly rate above 0 EGP.', x.hourly_rate);

      var equipArr = v('equip') ? v('equip').split(',').map(s => s.trim()).filter(Boolean) : [];
      await api('POST', '/kitchens', {
        name: v('name'),
        address: v('address'),
        hourly_rate: +x.hourly_rate.value,
        license_info: v('license_info'),
        equipment: equipArr
      });
      closeModal();
      toast('Kitchen submitted for verification!');
      route();
    }
    else if (t === 'slot') {
      if (!x.start_time.value || !x.end_time.value) return fail(f, 'Choose start and end times.');
      var a = new Date(x.start_time.value), z = new Date(x.end_time.value);
      if (z <= a) return fail(f, 'End time must be after start time.', x.end_time);

      await api('POST', '/slots', {
        kitchen_id: x.kitchen_id.value,
        start_time: a.toISOString(),
        end_time: z.toISOString()
      });
      closeModal();
      toast('Availability slot published!');
      route();
    }
    else if (t === 'event') {
      if (!v('title')) return fail(f, 'Event title is required.', x.title);
      if (!v('menu_description')) return fail(f, 'Menu description is required.', x.menu_description);
      if (!(+x.ticket_price.value > 0)) return fail(f, 'Enter a valid ticket price.', x.ticket_price);
      if (!(+x.capacity.value >= 1)) return fail(f, 'Capacity must be at least 1.', x.capacity);

      await api('POST', '/events', {
        booking_id: x.booking_id.value,
        title: v('title'),
        menu_description: v('menu_description'),
        ticket_price: +x.ticket_price.value,
        capacity: +x.capacity.value
      });
      closeModal();
      toast('Pop-up supper club published!');
      setRoute('#events');
    }
    else if (t === 'reserve') {
      if (role() === 'guest') {
        toast('Please sign in or select a guest demo role to reserve.');
        setRoute('#login');
        return;
      }
      var q = x.quantity, n = parseInt(q.value, 10), left = +f.dataset.left;
      if (!q.value.trim() || isNaN(n) || n < 1) return fail(f, 'Enter how many seats you would like to reserve.', q);
      if (n > left) return fail(f, 'Only ' + left + ' seats remain.', q);

      var res = await api('POST', '/tickets', {
        event_id: f.dataset.id,
        quantity: n
      });
      flash = { id: f.dataset.id, text: n + (n > 1 ? ' seats' : ' seat') + ' for ' + fmt(res.ticket.total_price) };
      toast('Seats reserved! Ticket confirmation #T-' + res.ticket.ref_no);
      route();
    }
  } catch (err) {
    fail(f, err.message);
  } finally {
    if (subBtn) {
      subBtn.disabled = false;
      subBtn.style.opacity = '';
    }
  }
});

// ── REAL-TIME SEARCH & TICKET PRICING ───────────────────────────────────────
var searchTimeout = null;
document.addEventListener('input', e => {
  if (e.target.id === 'kSearch') {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      S.searchQuery = e.target.value;
      renderFilteredKitchens();
    }, 150);
    return;
  }

  var q = e.target;
  if (q.name !== 'quantity') return;
  var f = q.form, n = Math.max(0, parseInt(q.value, 10) || 0);
  var tot = $1('.total', f);
  if (tot) tot.textContent = fmt(n * (+f.dataset.price || 0));
  q.removeAttribute('aria-invalid');
  var er = $1('.msg.err', f);
  if (er) er.hidden = true;
});

// ── INITIALIZE ──────────────────────────────────────────────────────────────
initSession();
initTheme();
window.addEventListener('hashchange', route);
window.addEventListener('popstate', route);
window.addEventListener('storage', () => { initSession(); route(); });
route();

})();

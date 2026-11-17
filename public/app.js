(function(){
'use strict';
var API = (window.location.origin && window.location.origin !== 'null' && window.location.protocol.indexOf('http') === 0) ? window.location.origin + '/api' : 'http://localhost:3000/api';
var K='gk_state_v3',HOME={host:'host',chef:'chef',attendee:'event',admin:'admin'};
var DEMO_USERS={
  host:     { name: 'Layla Host',       email: 'host@demo.eg',     password: 'password123', role: 'host' },
  chef:     { name: 'Omar Hassan',      email: 'chef@demo.eg',     password: 'password123', role: 'chef' },
  attendee: { name: 'Mariam Adel',      email: 'attendee@demo.eg', password: 'password123', role: 'attendee' },
  admin:    { name: 'Platform Admin',   email: 'admin@demo.eg',    password: 'password123', role: 'admin' }
};
var EQUIP=['Walk-in fridge','Convection ovens','Gas range','Induction hobs'];
var S, flash=null, R={};

var $=(s,r)=>[].slice.call((r||document).querySelectorAll(s)),$1=(s,r)=>(r||document).querySelector(s);
var fmt=n=>Number(n||0).toLocaleString('en-US')+' EGP',esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
var by=(a,id)=>a.filter(x=>x.id===id)[0];

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
    if (!res.ok) {
      throw new Error(data.error || 'Server error (' + res.status + ')');
    }
    return data;
  } catch (err) {
    if (err.message.indexOf('Failed to fetch') > -1) {
      toast('Cannot reach API on port 3000. Is "npm run dev" running?');
    }
    throw err;
  }
}

// ── SESSION & STATE ─────────────────────────────────────────────────────────
function initSession() {
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem(K)); } catch(e){}
  S = {
    session: saved && saved.session ? saved.session : null,
    entered: !!(saved && saved.entered),
    filters: [],
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
    localStorage.setItem(K, JSON.stringify({ session: S.session, entered: S.entered }));
  } catch(e){}
}

var role=()=>S.session?S.session.role:'guest';
var me=()=>S.session?S.session.name:'Guest';
var bundle=()=>$('[data-page]').length>1;

function go(p){
  if(bundle()){
    var same = location.hash === '#' + p;
    location.hash = '#' + p;
    if(same) route();
  } else {
    location.href = p + '.html';
  }
}

function toast(m){
  var t=$1('#toast');
  if(!t){
    t=document.createElement('div');
    t.id='toast';
    document.body.appendChild(t);
  }
  t.textContent=m;
  t.className='show';
  clearTimeout(t._h);
  t._h=setTimeout(()=>t.className='',3000);
}

function B(st,txt){
  var m={verified:'approved',approved:'approved',pending:'pending',booked:'pending',rejected:'declined',declined:'declined'};
  return '<span class="badge '+(m[st]||'')+'">'+esc(txt||st)+'</span>';
}

var ART={
  plate:'<circle cx="48" cy="48" r="26" fill="var(--card)" stroke="var(--accent)" stroke-width="3"/><circle cx="48" cy="48" r="14" fill="none" stroke="var(--accent)" stroke-width="2" opacity=".5"/><path d="M14 30v18M18 30v18M22 30v18M18 48v20M80 30c-5 6-5 18 0 22v16" fill="none" stroke="var(--accent-d)" stroke-width="3" stroke-linecap="round"/>',
  ticket:'<rect x="14" y="28" width="68" height="40" rx="8" fill="var(--card)" stroke="var(--accent)" stroke-width="3"/><path d="M62 31v34" stroke="var(--accent)" stroke-width="2.5" stroke-dasharray="4 4"/><path d="M26 44h24M26 54h16" stroke="var(--accent-d)" stroke-width="3" stroke-linecap="round"/>',
  shield:'<path d="M48 18l24 8v18c0 16-10 26-24 32C34 70 24 60 24 44V26z" fill="var(--card)" stroke="var(--accent)" stroke-width="3" stroke-linejoin="round"/><path d="M38 47l8 8 14-16" fill="none" stroke="var(--accent-d)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>'
};

function empty(k,t,p,cta){
  return '<div class="card empty"><svg viewBox="0 0 96 96" width="96" height="96" aria-hidden="true"><circle cx="48" cy="48" r="44" fill="var(--accent-l)"/>'+ART[k]+'</svg><h2>'+t+'</h2><p>'+p+'</p>'+(cta||'')+'</div>';
}

var tiles=a=>'<div class="stats">'+a.map(t=>'<div class="stat"><b>'+t[0]+'</b><span>'+t[1]+'</span></div>').join('')+'</div>';

function fmtSlot(s) {
  if (s.day && s.from) return s.day + ' · ' + s.from + '–' + s.to;
  if (!s.start_time) return 'Slot details';
  var a = new Date(s.start_time), z = new Date(s.end_time || s.start_time);
  var day = a.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  var from = a.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  var to = z.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return day + ' · ' + from + '–' + to;
}

function slotHours(s) {
  if (s.hours) return s.hours;
  if (!s.start_time || !s.end_time) return 4;
  return Math.max(1, Math.round((new Date(s.end_time) - new Date(s.start_time)) / 36e5));
}

function banner(){
  var st = S.stats || { kitchens_verified: 0, kitchens_pending: 0, total_bookings: 0, seats_sold: 0, revenue_egp: 0 };
  return '<div class="banner"><div class="bn-h">🛡️ Platform overview <span class="badge">Live Database</span></div><div class="bn-g">'+
    [[st.kitchens_verified,'Verified kitchens'],
     [st.kitchens_pending,'Awaiting review'],
     [st.total_bookings,'Bookings'],
     [st.seats_sold,'Seats sold']].map(t=>'<div><b>'+t[0]+'</b><span>'+t[1]+'</span></div>').join('')+
    '</div><div class="bn-f">Seat revenue to date: <b>'+fmt(st.revenue_egp)+'</b></div></div>';
}

function slotRow(s,k){
  var mine = S.bookings.filter(b=>b.slot_id===s.id && (b.chef_id===S.session?.id || b.chef===me()))[0];
  var a;
  var hrs = slotHours(s);
  var rate = k.hourly_rate || 250;
  var cost = hrs * rate;

  if (s.status === 'booked') a = B('booked','Booked');
  else if (k.verification_status !== 'verified' && k.status !== 'verified') a = '<span class="muted">Not bookable yet</span>';
  else if (mine) a = B(mine.status, 'Request ' + mine.status);
  else if (role() === 'chef') a = '<button data-act="request" data-id="' + s.id + '">Request</button>';
  else a = '<span class="muted">Chef account needed</span>';

  return '<div class="slot"><div><div>'+fmtSlot(s)+'</div><div class="muted">'+hrs+' hrs × '+fmt(rate)+' = <b>'+fmt(cost)+'</b></div></div>'+a+'</div>';
}

function kCard(k){
  var sl = S.slots.filter(s=>s.kitchen_id===k.id);
  var st = k.verification_status || k.status || 'pending';
  var equip = k.equipment || k.equip || [];
  var emoji = k.emoji || '🥘';

  var h = '<div class="card lift"><div class="thumb t1">' + emoji + '</div><div class="row"><b class="kt">' + esc(k.name) + '</b>' +
    B(st, st==='verified'?'Verified':st==='pending'?'Pending review':'Rejected') + '</div>' +
    '<div class="muted">📍 ' + esc(k.address) + '</div>' +
    '<div class="rate"><span class="price">' + fmt(k.hourly_rate) + '</span><span class="muted"> / hour</span></div>' +
    '<div class="chips sm">' + equip.map(e=>'<span class="chip">' + esc(e) + '</span>').join('') + '</div>' +
    '<div class="muted">License: ' + esc(k.license_info) + '</div>';

  if (role() === 'admin') {
    h += '<div class="admin-strip">🛡️ <span><b>Admin</b> · verification: ' + st + '</span>' +
      (st === 'verified' ? '<button class="bad" data-act="revoke" data-id="' + k.id + '">Revoke</button>' : '<button data-act="verify" data-id="' + k.id + '">Verify</button>') + '</div>';
  }
  return h + '<div class="slots">' + (sl.length ? sl.map(s => slotRow(s, k)).join('') : '<div class="muted">No slots published yet.</div>') + '</div></div>';
}

function bCard(b, host){
  var s = by(S.slots, b.slot_id) || { start_time: b.start_time, end_time: b.end_time };
  var kName = b.kitchen_name || (by(S.kitchens, s.kitchen_id) || {}).name || 'Kitchen';
  var num = b.booking_no ? '#' + b.booking_no : '#' + (b.id||'').slice(0,6);
  var chefLabel = b.chef_name || b.chef || 'Chef';

  return '<div class="card"><div class="row"><b>Booking ' + num + '</b>' + B(b.status) + '</div>' +
    '<div class="muted">' + (host ? '👩‍🍳 ' + esc(chefLabel) + ' · ' : '') + esc(kName) + '</div>' +
    '<div>' + fmtSlot(s) + '</div>' +
    (host && b.status === 'pending' ? '<div class="row act" style="margin-top:10px"><button data-act="approve" data-id="' + b.id + '">Approve</button><button class="bad" data-act="decline" data-id="' + b.id + '">Decline</button></div>' : '') +
    '</div>';
}

var browse = '<a class="btn" href="kitchens.html" data-go="kitchens">Browse kitchens</a>';

// ── PAGE RENDERERS (CALL REAL API) ──────────────────────────────────────────

R.login = async () => {
  $1('#session').innerHTML = S.session ?
    '<div class="card row"><div><div class="muted">Signed in as</div><b>' + esc(me()) + '</b> ' + B('approved', role()) + '</div><button class="ghost" data-act="logout">Log out</button></div>' : '';
};

R.kitchens = async () => {
  $1('#sysStats').innerHTML = role() === 'admin' ? banner() : '';
  $1('#chips').innerHTML = EQUIP.map(t => '<button type="button" class="chip' + (S.filters.indexOf(t) > -1 ? ' on' : '') + '" data-act="filter" data-tag="' + t + '">' + t + '</button>').join('') +
    (S.filters.length ? '<button type="button" class="chip clear" data-act="clearfilter">Clear</button>' : '');

  try {
    var qs = S.filters.length ? '?equipment=' + encodeURIComponent(S.filters.join(',')) : '';
    var data = await api('GET', '/kitchens' + qs);
    S.kitchens = data.kitchens || [];

    // Also fetch slots for each kitchen so they can be viewed
    var allSlots = [];
    for (var k of S.kitchens) {
      try {
        var sData = await api('GET', '/slots?kitchen_id=' + k.id);
        allSlots = allSlots.concat(sData.slots || []);
      } catch(e){}
    }
    S.slots = allSlots;

    var l = S.kitchens;
    $1('#count').textContent = l.length + (l.length === 1 ? ' kitchen ' : ' kitchens ') + (S.filters.length ? 'match your filters' : 'available');
    $1('#kitchenList').innerHTML = l.length ? l.map(kCard).join('') : empty('plate', 'No kitchens match', 'Try removing a filter or add new kitchens.', '<button class="ghost" data-act="clearfilter">Clear filters</button>');
  } catch (err) {
    $1('#kitchenList').innerHTML = empty('plate', 'Unable to load kitchens', err.message, '');
  }
};

R.host = async () => {
  $1('#hostSub').textContent = 'Signed in as ' + me() + '. Manage kitchens, slots and booking requests.';
  try {
    var [bData, kData] = await Promise.all([
      api('GET', '/bookings').catch(() => ({ bookings: [] })),
      api('GET', '/kitchens').catch(() => ({ kitchens: [] }))
    ]);
    S.bookings = bData.bookings || [];
    S.kitchens = kData.kitchens || [];

    var pCount = S.bookings.filter(b=>b.status==='pending').length;
    var aCount = S.bookings.filter(b=>b.status==='approved').length;
    $1('#hostStats').innerHTML = tiles([[pCount, 'Pending'], [aCount, 'Approved'], [S.kitchens.length, 'Kitchens']]);

    var l = S.bookings;
    $1('#hostBookings').innerHTML = l.length ? l.map(b => bCard(b, 1)).join('') : empty('plate', 'No booking requests yet', 'Requests from guest chefs will appear here.', '');

    var sel = $1('#slotKitchen');
    if (sel) {
      sel.innerHTML = S.kitchens.map(k => '<option value="' + k.id + '">' + esc(k.name) + '</option>').join('');
    }
  } catch (err) {
    toast(err.message);
  }
};

R.chef = async () => {
  try {
    var [bData, evData] = await Promise.all([
      api('GET', '/bookings').catch(() => ({ bookings: [] })),
      api('GET', '/events/mine').catch(() => ({ events: [] }))
    ]);
    S.bookings = bData.bookings || [];
    S.events = evData.events || [];

    var pCount = S.bookings.filter(b=>b.status==='pending').length;
    var aCount = S.bookings.filter(b=>b.status==='approved').length;
    var dCount = S.bookings.filter(b=>b.status==='declined').length;
    $1('#chefStats').innerHTML = tiles([[pCount, 'Pending'], [aCount, 'Approved'], [dCount, 'Declined']]);

    $1('#chefBookings').innerHTML = S.bookings.length ?
      S.bookings.map(b => bCard(b, 0)).join('') :
      empty('plate', 'No active bookings yet', 'Find a verified kitchen and request an off-peak slot.', browse);

    // Filter approved or pending bookings for the publish form
    var el = S.bookings.filter(b => b.status !== 'declined' && !S.events.some(e => e.booking_id === b.id));
    var sel = $1('#evBooking');
    if (sel) {
      sel.innerHTML = el.map(b => '<option value="' + b.id + '">#' + (b.booking_no || b.id.slice(0,6)) + ' · ' + esc(b.kitchen_name || 'Kitchen') + ' · ' + b.status + '</option>').join('');
      $1('#evFields').disabled = !el.length;
      $1('#evNote').hidden = !!el.length;
    }

    $1('#chefEvents').innerHTML = S.events.length ?
      S.events.map(ev => '<div class="card"><div class="row"><b>' + esc(ev.title) + '</b>' + (ev.booking_status === 'approved' ? B('approved', 'Live') : B('pending', 'Awaiting host approval')) + '</div><div class="muted">' + esc(ev.kitchen_name) + '</div><div class="row" style="margin-top:8px"><span>' + fmt(ev.ticket_price) + ' per seat</span><span class="muted">' + (ev.seats_sold || 0) + ' of ' + ev.capacity + ' seats sold</span></div></div>').join('') :
      empty('plate', 'No events yet', 'Publish your first pop-up below once you have a kitchen booking.', '');
  } catch (err) {
    toast(err.message);
  }
};

function eCard(ev){
  var left = ev.seats_left != null ? ev.seats_left : ev.capacity;
  var f = flash && flash.id === ev.id;
  var dateStr = ev.starts_at ? new Date(ev.starts_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'Upcoming';

  return '<div class="card lift"><div class="thumb t1">🍽️</div>' +
    '<div class="row"><b class="kt">' + esc(ev.title) + '</b>' +
    (left > 5 ? B('approved', left + ' of ' + ev.capacity + ' seats left') : left > 0 ? B('pending', 'Only ' + left + ' left') : B('declined', 'Sold out')) + '</div>' +
    '<div class="muted">By Chef ' + esc(ev.chef_name) + ' · ' + esc(ev.kitchen_name) + '</div>' +
    '<div class="muted">📅 ' + dateStr + ' · 📍 ' + esc(ev.address) + '</div>' +
    '<p class="menu">' + esc(ev.menu_description) + '</p>' +
    '<div class="price big">' + fmt(ev.ticket_price) + ' <span class="muted">per seat</span></div>' +
    '<form novalidate data-form="reserve" data-id="' + ev.id + '" data-price="' + ev.ticket_price + '" data-left="' + left + '">' +
    '<input type="hidden" name="event_id" value="' + ev.id + '">' +
    '<label>quantity <span class="muted">(reserving as ' + esc(me()) + ')</span></label>' +
    '<input name="quantity" type="number" inputmode="numeric" min="1" max="' + left + '" placeholder="How many seats?"' + (left ? '' : ' disabled') + '>' +
    '<div class="row" style="margin-top:12px"><span class="muted">Total</span><b class="price total">0 EGP</b></div>' +
    '<div class="msg err" role="alert" hidden></div>' +
    (f ? '<div class="msg ok" role="status">✓ <b>Reservation confirmed!</b> ' + flash.text + ' <a href="tickets.html" data-go="tickets">View My Tickets</a></div>' : '') +
    '<button type="submit"' + (left ? '' : ' disabled') + '>' + (left ? 'Reserve seats' : 'Sold out') + '</button>' +
    '</form></div>';
}

R.event = async () => {
  try {
    var data = await api('GET', '/events');
    var live = data.events || [];
    $1('#eventList').innerHTML = live.length ?
      live.map(eCard).join('') :
      empty('plate', 'No pop-ups published yet', 'Chefs publish an event once a kitchen booking is approved.', '');
    flash = null;
  } catch (err) {
    $1('#eventList').innerHTML = empty('plate', 'Could not load events', err.message, '');
  }
};

R.tickets = async () => {
  try {
    var data = await api('GET', '/tickets');
    var list = data.tickets || [];
    $1('#ticketList').innerHTML = list.length ?
      list.map(t => {
        var dateStr = t.starts_at ? new Date(t.starts_at).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Confirmed date';
        return '<div class="card ticket-card">' +
          '<div class="row" style="margin-bottom:6px">' +
            '<div><span class="ticket-badge">DINING RESERVATION</span><h3 style="margin:4px 0 0;font-size:18.5px;font-weight:800">' + esc(t.event_title) + '</h3></div>' +
            B('approved', 'Confirmed') +
          '</div>' +
          '<div class="ticket-divider"></div>' +
          '<div class="ticket-body">' +
            '<div class="ticket-info"><span>Date & Time</span><b>📅 ' + dateStr + '</b></div>' +
            '<div class="ticket-info"><span>Venue & Chef</span><b>📍 ' + esc(t.kitchen_name) + '</b><div class="muted" style="font-size:12.5px;margin-top:2px">By Chef ' + esc(t.chef_name) + '</div></div>' +
            '<div class="ticket-info"><span>Seats Reserved</span><b>' + t.quantity + ' seat' + (t.quantity > 1 ? 's' : '') + ' (' + fmt(t.unit_price) + '/seat)</b></div>' +
            '<div class="ticket-info"><span>Total Amount</span><b class="price" style="font-size:18px">' + fmt(t.total_price) + '</b></div>' +
          '</div>' +
          '<div class="ticket-footer">' +
            '<span class="ticket-ref">REF T-' + t.ref_no + '</span>' +
            '<span class="muted" style="font-size:12px">Show this ticket confirmation upon arrival</span>' +
          '</div>' +
        '</div>';
      }).join('') :
      empty('ticket', 'No tickets yet', 'Reserve seats at a pop-up dinner and your tickets will show up here.', '<a class="btn" href="event.html" data-go="event">Browse events</a>');
  } catch (err) {
    $1('#ticketList').innerHTML = empty('ticket', 'Unable to load tickets', err.message, '<a class="btn" href="login.html">Sign in</a>');
  }
};

R.admin = async () => {
  try {
    var [sData, kData] = await Promise.all([
      api('GET', '/admin/stats'),
      api('GET', '/admin/kitchens?status=pending')
    ]);
    S.stats = sData.stats;
    $1('#adminStats').innerHTML = banner();

    var p = kData.kitchens || [];
    $1('#adminPending').innerHTML = p.length ?
      p.map(k => '<div class="card"><div class="row"><b>' + esc(k.name) + '</b>' + B('pending', 'Pending review') + '</div>' +
        '<div class="muted">📍 ' + esc(k.address) + '</div>' +
        '<div class="muted">License: ' + esc(k.license_info) + ' · ' + fmt(k.hourly_rate) + ' / hour</div>' +
        '<div class="row act" style="margin-top:10px"><button data-act="verify" data-id="' + k.id + '">Approve license</button><button class="bad" data-act="reject" data-id="' + k.id + '">Reject</button></div></div>').join('') :
      empty('shield', 'All caught up', 'No kitchen licenses are waiting for review.', '');
  } catch (err) {
    toast(err.message);
  }
};

// ── AUTH GATE & DIALOG ──────────────────────────────────────────────────────

function gate(show){
  var g=$1('#gate');
  if(!g){
    if(!show)return;
    g=document.createElement('div');
    g.id='gate';
    g.innerHTML=`<div class="gate-card" role="dialog" aria-modal="true" aria-labelledby="gt"><div class="brand">🍳 GhostKitchen</div><h1 id="gt">Welcome</h1><p class="sub">Rent idle kitchens. Host unforgettable dinners.</p>
    <div id="gChoice"><button data-act="gate-signin" style="width:100%">Sign in</button><button class="ghost" data-act="gate-guest" style="width:100%;margin-top:10px">Enter as guest</button></div>
    <form id="gForm" hidden novalidate data-form="login"><label>name</label><input name="name" placeholder="Your name"><label>email</label><input name="email" type="email" placeholder="you@example.com"><label>password_hash</label><input name="password_hash" type="password" placeholder="Password"><label>role</label><div class="seg"><label><input type="radio" name="role" value="host"><span>host</span></label><label><input type="radio" name="role" value="chef" checked><span>chef</span></label><label><input type="radio" name="role" value="attendee"><span>attendee</span></label><label><input type="radio" name="role" value="admin"><span>admin</span></label></div><div class="msg err" role="alert" hidden></div><button type="submit">Sign in</button><button type="button" class="ghost" data-act="gate-back" style="width:100%;margin-top:10px">Back</button></form>
    <p class="muted" style="margin:16px 0 8px">Or try a demo role</p><div class="demo"><button class="ghost" data-act="demo" data-role="host">🏪 Host</button><button class="ghost" data-act="demo" data-role="chef">🧑‍🍳 Chef</button><button class="ghost" data-act="demo" data-role="attendee">🎟️ Attendee</button><button class="ghost" data-act="demo" data-role="admin">🛡️ Admin</button></div></div>`;
    document.body.appendChild(g);
  }
  g.hidden=!show;
  g.style.display = show ? 'flex' : 'none';
  document.body.classList.toggle('locked',show);
}

function route(){
  var pages=$('[data-page]'),multi=pages.length>1;
  var cur=multi?(location.hash||'').slice(1):location.pathname.split('/').pop().replace('.html','');
  var cp=pages.filter(p=>p.dataset.page===cur)[0]||pages[0];
  cur=cp.dataset.page;

  if(cp.dataset.roles && cp.dataset.roles.split(' ').indexOf(role())<0){
    toast('Sign in with the right role to open that page');
    if(multi){ location.replace('#login'); return; }
    location.replace('login.html');
    return;
  }

  if(multi){ pages.forEach(p=>p.hidden=p!==cp); window.scrollTo(0,0); }
  $('nav [data-roles]').forEach(el=>el.hidden=el.dataset.roles.split(' ').indexOf(role())<0);
  $('.links a').forEach(a=>{
    var on=a.getAttribute('href').replace('#','').replace('.html','')===cur;
    a.classList.toggle('on',on);
    on?a.setAttribute('aria-current','page'):a.removeAttribute('aria-current');
  });

  var c=$1('#roleChip');
  if(c) c.textContent=S.session?role()[0].toUpperCase()+role().slice(1)+' · '+me().split(' ')[0]:'Guest';

  if(R[cur]) R[cur]();
  gate(!S.session && !S.entered);
}

// ── AUTHENTICATION (CALL BACKEND API) ────────────────────────────────────────

async function loginOrRegister(name, email, password, r) {
  try {
    // 1. Try login first
    var data = await api('POST', '/login', { email: email, password: password });
    localStorage.setItem('gk_token', data.token);
    S.session = data.user;
    saveSession();
    toast('Signed in as ' + data.user.name);
    go(HOME[data.user.role]);
  } catch (err) {
    // 2. If user not found, automatically register
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
        go(HOME[regData.user.role]);
        return;
      } catch (regErr) {
        toast('Auth error: ' + regErr.message);
        throw regErr;
      }
    }
    toast('Login error: ' + err.message);
    throw err;
  }
}

// ── EVENT LISTENERS (CLICK ACTIONS) ─────────────────────────────────────────

document.addEventListener('click', async e => {
  if(e.target.closest('#roleChip') && !S.session){
    e.preventDefault();
    S.entered=false;
    saveSession();
    route();
    return;
  }
  var g=e.target.closest('[data-go]');
  if(g && bundle()){
    e.preventDefault();
    go(g.dataset.go);
    return;
  }

  var b=e.target.closest('[data-act]');
  if(!b) return;
  var a = b.dataset.act;
  var id = b.dataset.id;

  if(a==='demo'){
    var d = DEMO_USERS[b.dataset.role];
    if(d) await loginOrRegister(d.name, d.email, d.password, d.role);
    return;
  }
  if(a==='gate-signin'||a==='gate-back'){
    var s = a==='gate-signin';
    $1('#gChoice').hidden=s;
    $1('#gForm').hidden=!s;
    if(s) $1('#gForm').elements.name.focus();
    return;
  }
  if(a==='gate-guest'){
    S.entered=true;
    saveSession();
    toast('Browsing as a guest');
    return route();
  }
  if(a==='logout'){
    localStorage.removeItem('gk_token');
    S.session=null;
    S.entered=false;
    saveSession();
    toast('Logged out');
    route();
    return;
  }
  if(a==='filter'){
    var i=S.filters.indexOf(b.dataset.tag);
    i>-1?S.filters.splice(i,1):S.filters.push(b.dataset.tag);
    route();
    return;
  }
  if(a==='clearfilter'){
    S.filters=[];
    route();
    return;
  }

  // Live Backend Mutations
  try {
    if(a==='request' && role()==='chef'){
      await api('POST', '/bookings', { slot_id: id });
      toast('Request sent to kitchen host!');
      route();
    }
    else if(a==='approve'){
      await api('PATCH', '/bookings/' + id + '/approve');
      toast('Booking approved! Slot marked booked.');
      route();
    }
    else if(a==='decline'){
      await api('PATCH', '/bookings/' + id + '/decline');
      toast('Booking request declined.');
      route();
    }
    else if(a==='verify' && role()==='admin'){
      await api('PATCH', '/kitchens/' + id + '/verify');
      toast('Kitchen verified successfully!');
      route();
    }
    else if(a==='reject' && role()==='admin'){
      await api('PATCH', '/kitchens/' + id + '/reject');
      toast('Kitchen license rejected.');
      route();
    }
    else if(a==='revoke' && role()==='admin'){
      await api('PATCH', '/kitchens/' + id + '/revoke');
      toast('Kitchen verification revoked to pending.');
      route();
    }
  } catch (err) {
    toast(err.message);
  }
});

// ── FORM SUBMISSIONS (CREATE ENTITIES IN SUPABASE) ───────────────────────────

function fail(f,m,el){
  var er=$1('.msg.err',f);
  if(er){ er.textContent=m; er.hidden=false; }
  if(el){ el.setAttribute('aria-invalid','true'); el.focus(); }
}

document.addEventListener('submit', async e => {
  var f=e.target, t=f.dataset.form;
  if(!t) return;
  e.preventDefault();
  var x=f.elements, er=$1('.msg.err',f);
  if(er) er.hidden=true;
  $('[aria-invalid]',f).forEach(i=>i.removeAttribute('aria-invalid'));

  var v=n=>(x[n]?x[n].value:'').trim();

  try {
    if(t==='login'){
      if(!v('name')) return fail(f,'Please enter your name.',x.name);
      if(!/^\S+@\S+\.\S+$/.test(v('email'))) return fail(f,'Please enter a valid email address.',x.email);
      if(!x.password_hash.value) return fail(f,'Please enter a password.',x.password_hash);
      await loginOrRegister(v('name'), v('email'), x.password_hash.value, x.role.value);
    }
    else if(t==='kitchen'){
      if(!v('name')||!v('address')||!v('license_info')) return fail(f,'Name, address and license info are required.');
      if(!(+x.hourly_rate.value>0)) return fail(f,'Enter an hourly rate above 0 EGP.',x.hourly_rate);

      var equipArr = v('equip') ? v('equip').split(',').map(s=>s.trim()).filter(Boolean) : [];
      await api('POST', '/kitchens', {
        name: v('name'),
        address: v('address'),
        license_info: v('license_info'),
        hourly_rate: +x.hourly_rate.value,
        equipment: equipArr
      });
      f.reset();
      toast('Kitchen submitted for admin review!');
      route();
    }
    else if(t==='slot'){
      if(!x.start_time.value||!x.end_time.value) return fail(f,'Choose a start and end time.');
      var a=new Date(x.start_time.value), z=new Date(x.end_time.value);
      if(z<=a) return fail(f,'End time must be after start time.',x.end_time);

      await api('POST', '/slots', {
        kitchen_id: x.kitchen_id.value,
        start_time: a.toISOString(),
        end_time: z.toISOString()
      });
      f.reset();
      toast('Availability slot added to kitchen!');
      route();
    }
    else if(t==='event'){
      if(!v('title')) return fail(f,'Give your event a title.',x.title);
      if(!(+x.ticket_price.value>0)) return fail(f,'Enter a ticket price above 0 EGP.',x.ticket_price);
      if(!(+x.capacity.value>=1)) return fail(f,'Capacity must be at least 1.',x.capacity);

      await api('POST', '/events', {
        booking_id: x.booking_id.value,
        title: v('title'),
        menu_description: v('menu_description'),
        ticket_price: +x.ticket_price.value,
        capacity: +x.capacity.value
      });
      f.reset();
      toast('Pop-up event published!');
      go('event');
    }
    else if(t==='reserve'){
      var q=x.quantity, n=parseInt(q.value,10), left=+f.dataset.left;
      if(!q.value.trim()) return fail(f,'Please enter how many seats you want.',q);
      if(isNaN(n)||n<1) return fail(f,'Quantity must be at least 1.',q);
      if(n>left) return fail(f,'Only '+left+' seats are left.',q);

      var res = await api('POST', '/tickets', {
        event_id: f.dataset.id,
        quantity: n
      });
      flash={ id: f.dataset.id, text: n + (n>1?' seats':' seat') + ' for ' + fmt(res.ticket.total_price) + '.' };
      toast('Seats reserved successfully! Ref #' + res.ticket.ref_no);
      route();
    }
  } catch (err) {
    fail(f, err.message);
  }
});

document.addEventListener('input', e => {
  var q=e.target;
  if(q.name!=='quantity') return;
  var f=q.form, n=Math.max(0, parseInt(q.value,10)||0);
  var tot = $1('.total', f);
  if(tot) tot.textContent = fmt(n * (+f.dataset.price || 0));
  q.removeAttribute('aria-invalid');
  var er = $1('.msg.err', f);
  if(er) er.hidden = true;
});

// ── INITIALIZE ──────────────────────────────────────────────────────────────
initSession();
window.addEventListener('hashchange', route);
window.addEventListener('storage', () => { initSession(); route(); });
route();

})();

// init-db.js — creates all tables, triggers, and constraints in Supabase
'use strict';
const pool = require('./db/pool');

const ddl = `
BEGIN;

-- 1. Users
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('host', 'chef', 'attendee', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_password_hash_format CHECK (password_hash ~ '^\\$(2[aby]\\$|argon2(id|i|d)\\$)') NOT VALID
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON users (lower(email));

-- 2. Kitchens
CREATE TABLE IF NOT EXISTS kitchens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  license_info text NOT NULL,
  hourly_rate numeric(10, 2) NOT NULL CHECK (hourly_rate > 0),
  equipment text[] NOT NULL DEFAULT '{}',
  verification_status text NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected')),
  verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS kitchens_equipment_gin ON kitchens USING gin (equipment);
CREATE INDEX IF NOT EXISTS kitchens_verification_status_idx ON kitchens (verification_status);
CREATE INDEX IF NOT EXISTS kitchens_host_id_idx ON kitchens (host_id);

-- 3. Slots
CREATE TABLE IF NOT EXISTS slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kitchen_id uuid NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'booked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS slots_kitchen_start_idx ON slots (kitchen_id, start_time);

-- 4. Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_no integer GENERATED ALWAYS AS IDENTITY (START WITH 1001),
  slot_id uuid NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  chef_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_booking_no_key ON bookings (booking_no);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_slot_chef_key ON bookings (slot_id, chef_id);
CREATE UNIQUE INDEX IF NOT EXISTS bookings_one_approved_per_slot ON bookings (slot_id) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS bookings_chef_id_idx ON bookings (chef_id);

-- 5. Events
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id) ON DELETE CASCADE,
  title text NOT NULL,
  menu_description text NOT NULL,
  ticket_price numeric(10, 2) NOT NULL CHECK (ticket_price >= 0),
  capacity integer NOT NULL CHECK (capacity > 0),
  starts_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION events_booking_not_declined() RETURNS trigger AS $$
DECLARE s text;
BEGIN
  SELECT status INTO s FROM bookings WHERE id = NEW.booking_id;
  IF s = 'declined' THEN
    RAISE EXCEPTION 'Cannot publish an event on a declined booking';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_events_booking_status ON events;
CREATE TRIGGER trg_events_booking_status BEFORE INSERT OR UPDATE OF booking_id ON events
  FOR EACH ROW EXECUTE FUNCTION events_booking_not_declined();

-- 6. Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_no integer GENERATED ALWAYS AS IDENTITY (START WITH 1001),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  attendee_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10, 2) NOT NULL CHECK (unit_price >= 0),
  total_price numeric(12, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS tickets_ref_no_key ON tickets (ref_no);
CREATE INDEX IF NOT EXISTS tickets_event_id_idx ON tickets (event_id);
CREATE INDEX IF NOT EXISTS tickets_attendee_idx ON tickets (attendee_id);

CREATE OR REPLACE FUNCTION tickets_before_write() RETURNS trigger AS $$
DECLARE
  cap   integer;
  price numeric(10, 2);
  sold  integer;
BEGIN
  SELECT capacity, ticket_price INTO cap, price FROM events WHERE id = NEW.event_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Event not found';
  END IF;
  IF NEW.unit_price IS NULL THEN
    NEW.unit_price := price;
  END IF;
  SELECT COALESCE(SUM(quantity), 0) INTO sold
    FROM tickets WHERE event_id = NEW.event_id AND id IS DISTINCT FROM NEW.id;
  IF sold + NEW.quantity > cap THEN
    RAISE EXCEPTION 'Not enough seats left for this event';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tickets_before_write ON tickets;
CREATE TRIGGER trg_tickets_before_write BEFORE INSERT OR UPDATE OF quantity, event_id ON tickets
  FOR EACH ROW EXECUTE FUNCTION tickets_before_write();

-- 7. Updated at trigger
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_kitchens_updated_at ON kitchens;
CREATE TRIGGER trg_kitchens_updated_at BEFORE UPDATE ON kitchens FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_slots_updated_at ON slots;
CREATE TRIGGER trg_slots_updated_at BEFORE UPDATE ON slots FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON bookings;
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_events_updated_at ON events;
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
`;

async function main() {
  try {
    console.log('Running database setup script...');
    await pool.query(ddl);
    console.log('Database tables and triggers created successfully!');
    
    const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log('Verified tables:', res.rows.map(x => x.table_name));
    process.exit(0);
  } catch (err) {
    console.error('Database setup error:', err);
    process.exit(1);
  }
}

main();

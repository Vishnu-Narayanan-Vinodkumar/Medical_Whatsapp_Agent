CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email_hash TEXT UNIQUE NOT NULL,
  profile TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'patient' CHECK (role IN ('patient', 'admin')),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verify_hash TEXT,
  verify_expires TIMESTAMPTZ,
  reset_hash TEXT,
  reset_expires TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf TEXT NOT NULL,
  context TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,
  action TEXT NOT NULL,
  intent TEXT,
  confidence REAL,
  success BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT,
  response_ms INTEGER NOT NULL DEFAULT 0,
  groq_ms INTEGER NOT NULL DEFAULT 0,
  groq_called BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_date ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS audit_user_date ON audit_logs(user_id, created_at);
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting', 'assigned', 'resolved')),
  assigned_to UUID REFERENCES users(id),
  context TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS one_open_ticket ON tickets(user_id) WHERE status <> 'resolved';
CREATE TABLE IF NOT EXISTS ticket_messages (
  id BIGSERIAL PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  author TEXT NOT NULL CHECK (author IN ('patient', 'agent')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS bookings (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  request_id UUID NOT NULL,
  centre_id TEXT NOT NULL,
  centre_name TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'inr',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired')),
  payment_mode TEXT NOT NULL CHECK (payment_mode IN ('demo', 'stripe_test', 'stripe_live', 'disabled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'simulated', 'paid')),
  checkout_id TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, request_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS booked_slot ON bookings (centre_id, starts_at) WHERE status IN ('pending', 'confirmed');
CREATE INDEX IF NOT EXISTS bookings_user ON bookings (user_id, created_at);
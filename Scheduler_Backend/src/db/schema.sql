CREATE TABLE IF NOT EXISTS senders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT NOT NULL,
  password TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Senders are explicitly assigned to tenants; authenticated users cannot enumerate
-- or schedule with another tenant's SMTP credentials.
CREATE TABLE IF NOT EXISTS sender_tenants (
  sender_id TEXT NOT NULL REFERENCES senders(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (sender_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS emails (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  sender_id TEXT NOT NULL REFERENCES senders(id),
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED','PROCESSING','SENT','FAILED','CANCELLED')),
  attempts INTEGER NOT NULL DEFAULT 0,
  provider_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS emails_tenant_status_schedule_idx
  ON emails (tenant_id, status, scheduled_at);

CREATE INDEX IF NOT EXISTS emails_sender_schedule_idx
  ON emails (sender_id, scheduled_at);

CREATE TABLE IF NOT EXISTS slack_connections (
  id UUID PRIMARY KEY,
  tenant_id TEXT NOT NULL UNIQUE,
  team_id TEXT,
  team_name TEXT,
  bot_token TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONNECTED' CHECK (status IN ('CONNECTED','DISCONNECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

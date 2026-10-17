BEGIN;

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  shop_name TEXT NOT NULL CHECK (length(trim(shop_name)) > 0),
  pickup_details TEXT,
  destination TEXT NOT NULL CHECK (length(trim(destination)) > 0),
  destination_x NUMERIC(6, 2) NOT NULL CHECK (destination_x BETWEEN 0 AND 12),
  destination_y NUMERIC(6, 2) NOT NULL CHECK (destination_y BETWEEN 0 AND 12),
  capacity_units INTEGER NOT NULL CHECK (capacity_units > 0),
  deadline TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Preparing', 'Ready', 'Approved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_status_deadline_idx
  ON orders (status, deadline);

COMMIT;
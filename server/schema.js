export const schema = `
-- App settings (Shopify + DB connection from UI)
CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cron/schedule config
CREATE TABLE IF NOT EXISTS cron_jobs (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  schedule TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync run history
CREATE TABLE IF NOT EXISTS sync_runs (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  sync_type TEXT NOT NULL DEFAULT 'full',
  entities JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  progress JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sync cursor — tracks last updated_at per entity for incremental sync
CREATE TABLE IF NOT EXISTS sync_cursors (
  entity TEXT PRIMARY KEY,
  last_synced_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shopify orders
CREATE TABLE IF NOT EXISTS shopify_orders (
  id BIGINT PRIMARY KEY,
  order_number INTEGER,
  name TEXT,
  email TEXT,
  total_price NUMERIC(12,2),
  subtotal_price NUMERIC(12,2),
  total_tax NUMERIC(12,2),
  total_discounts NUMERIC(12,2),
  currency TEXT,
  financial_status TEXT,
  fulfillment_status TEXT,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  tags TEXT,
  note TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  raw JSONB
);

-- Order line items
CREATE TABLE IF NOT EXISTS shopify_order_line_items (
  id BIGINT PRIMARY KEY,
  order_id BIGINT REFERENCES shopify_orders(id) ON DELETE CASCADE,
  product_id BIGINT,
  variant_id BIGINT,
  title TEXT,
  variant_title TEXT,
  sku TEXT,
  quantity INTEGER,
  price NUMERIC(12,2),
  total_discount NUMERIC(12,2),
  fulfillment_status TEXT,
  requires_shipping BOOLEAN,
  taxable BOOLEAN,
  raw JSONB
);

-- Shopify products
CREATE TABLE IF NOT EXISTS shopify_products (
  id BIGINT PRIMARY KEY,
  title TEXT,
  handle TEXT,
  vendor TEXT,
  product_type TEXT,
  status TEXT,
  tags TEXT,
  body_html TEXT,
  template_suffix TEXT,
  published_scope TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  raw JSONB
);

-- Product variants
CREATE TABLE IF NOT EXISTS shopify_product_variants (
  id BIGINT PRIMARY KEY,
  product_id BIGINT REFERENCES shopify_products(id) ON DELETE CASCADE,
  title TEXT,
  sku TEXT,
  barcode TEXT,
  price NUMERIC(12,2),
  compare_at_price NUMERIC(12,2),
  position INTEGER,
  inventory_quantity INTEGER,
  inventory_item_id BIGINT,
  weight NUMERIC(10,4),
  weight_unit TEXT,
  requires_shipping BOOLEAN,
  taxable BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  raw JSONB
);

-- Product images
CREATE TABLE IF NOT EXISTS shopify_product_images (
  id BIGINT PRIMARY KEY,
  product_id BIGINT REFERENCES shopify_products(id) ON DELETE CASCADE,
  position INTEGER,
  src TEXT,
  alt TEXT,
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);

-- Shopify customers
CREATE TABLE IF NOT EXISTS shopify_customers (
  id BIGINT PRIMARY KEY,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  orders_count INTEGER,
  total_spent NUMERIC(12,2),
  state TEXT,
  tags TEXT,
  note TEXT,
  verified_email BOOLEAN,
  tax_exempt BOOLEAN,
  currency TEXT,
  address1 TEXT,
  address2 TEXT,
  city TEXT,
  province TEXT,
  province_code TEXT,
  country TEXT,
  country_code TEXT,
  zip TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  raw JSONB
);

-- Shopify collections (smart + custom)
CREATE TABLE IF NOT EXISTS shopify_collections (
  id BIGINT PRIMARY KEY,
  title TEXT,
  handle TEXT,
  collection_type TEXT,
  body_html TEXT,
  sort_order TEXT,
  published_scope TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  raw JSONB
);

-- Inventory locations
CREATE TABLE IF NOT EXISTS shopify_inventory_levels (
  inventory_item_id BIGINT NOT NULL,
  location_id BIGINT NOT NULL,
  available INTEGER,
  updated_at TIMESTAMPTZ,
  PRIMARY KEY (inventory_item_id, location_id)
);

-- Sync log lines for real-time progress in UI
CREATE TABLE IF NOT EXISTS sync_logs (
  id SERIAL PRIMARY KEY,
  run_id INTEGER REFERENCES sync_runs(id) ON DELETE CASCADE,
  level TEXT DEFAULT 'info',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sync_logs_run_id ON sync_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_order_line_items_order ON shopify_order_line_items(order_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON shopify_product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON shopify_product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_created ON shopify_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_updated ON shopify_orders(updated_at);
CREATE INDEX IF NOT EXISTS idx_products_updated ON shopify_products(updated_at);
CREATE INDEX IF NOT EXISTS idx_customers_updated ON shopify_customers(updated_at);

-- Migrations: add columns that may be missing on older installs
-- sync_runs
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS sync_type TEXT NOT NULL DEFAULT 'full';
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS entities JSONB NOT NULL DEFAULT '{}';
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS progress JSONB DEFAULT '{}';
ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS error_message TEXT;

-- shopify_orders
ALTER TABLE shopify_orders ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE shopify_orders ADD COLUMN IF NOT EXISTS subtotal_price NUMERIC(12,2);
ALTER TABLE shopify_orders ADD COLUMN IF NOT EXISTS total_tax NUMERIC(12,2);
ALTER TABLE shopify_orders ADD COLUMN IF NOT EXISTS total_discounts NUMERIC(12,2);
ALTER TABLE shopify_orders ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE shopify_orders ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE shopify_orders ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE shopify_orders ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE shopify_orders ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE shopify_orders ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;
ALTER TABLE shopify_orders ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- shopify_customers
ALTER TABLE shopify_customers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE shopify_customers ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE shopify_customers ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE shopify_customers ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE shopify_customers ADD COLUMN IF NOT EXISTS verified_email BOOLEAN;
ALTER TABLE shopify_customers ADD COLUMN IF NOT EXISTS tax_exempt BOOLEAN;
ALTER TABLE shopify_customers ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE shopify_customers ADD COLUMN IF NOT EXISTS address1 TEXT;
ALTER TABLE shopify_customers ADD COLUMN IF NOT EXISTS address2 TEXT;
ALTER TABLE shopify_customers ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE shopify_customers ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE shopify_customers ADD COLUMN IF NOT EXISTS province_code TEXT;
ALTER TABLE shopify_customers ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE shopify_customers ADD COLUMN IF NOT EXISTS country_code TEXT;
ALTER TABLE shopify_customers ADD COLUMN IF NOT EXISTS zip TEXT;

-- shopify_products
ALTER TABLE shopify_products ADD COLUMN IF NOT EXISTS tags TEXT;
ALTER TABLE shopify_products ADD COLUMN IF NOT EXISTS body_html TEXT;
ALTER TABLE shopify_products ADD COLUMN IF NOT EXISTS template_suffix TEXT;
ALTER TABLE shopify_products ADD COLUMN IF NOT EXISTS published_scope TEXT;
ALTER TABLE shopify_products ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

INSERT INTO cron_jobs (name, schedule, enabled)
SELECT 'shopify_sync', '0 * * * *', true
WHERE NOT EXISTS (SELECT 1 FROM cron_jobs LIMIT 1);
`;

export async function runSchema(connectionString) {
  const pg = await import('pg');
  const client = new pg.default.Client({ connectionString });
  try {
    await client.connect();
    await client.query(schema);
  } finally {
    await client.end();
  }
}

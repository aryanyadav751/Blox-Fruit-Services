import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema.ts';

/**
 * Neon PostgreSQL Client with Drizzle ORM
 * Connected via @neondatabase/serverless over HTTPS / HTTP pooling
 * Ideal for serverless environments (Vercel, Cloud Functions)
 */

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;
let rawSqlInstance: any = null;

export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL;
}

export function isNeonConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

/**
 * Ensures database configuration exists in production.
 * In-memory fallback is strictly restricted to development & testing.
 */
export function ensureDatabaseConfigured(): void {
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !isNeonConfigured()) {
    throw new Error(
      'FATAL CONFIGURATION ERROR: Production environment detected, but DATABASE_URL is not set. ' +
      'In-memory / local JSON fallback is strictly restricted to development and testing environments. ' +
      'Please configure DATABASE_URL in Vercel or your production environment settings.'
    );
  }
}

export const NEON_SCHEMA_DDL = [
  `CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price_hundredths INTEGER NOT NULL,
    price_m NUMERIC(12, 2) NOT NULL,
    prerequisites TEXT,
    exclusions TEXT,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    needs_confirmation BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    public_token TEXT NOT NULL UNIQUE,
    order_code TEXT NOT NULL UNIQUE,
    service_id TEXT NOT NULL REFERENCES services(id),
    roblox_username TEXT NOT NULL,
    timezone TEXT NOT NULL,
    availability TEXT NOT NULL,
    payment_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_review',
    total_price_hundredths INTEGER NOT NULL,
    deposit_hundredths INTEGER NOT NULL,
    remaining_hundredths INTEGER NOT NULL,
    customer_note TEXT,
    staff_notes TEXT,
    consent_public_proofs BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS order_items (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    proposed_value_hundredths INTEGER NOT NULL,
    agreed_value_hundredths INTEGER,
    verified BOOLEAN NOT NULL DEFAULT FALSE
  );`,

  `CREATE TABLE IF NOT EXISTS order_audit (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    kind TEXT NOT NULL,
    amount_hundredths INTEGER NOT NULL,
    items_json TEXT NOT NULL,
    recorded_by TEXT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS enquiries (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL DEFAULT 'website',
    customer_name TEXT,
    roblox_username TEXT NOT NULL,
    discord_tag TEXT,
    order_code_or_id TEXT,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    staff_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS service_evidence (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    service_id TEXT NOT NULL REFERENCES services(id),
    evidence_type TEXT NOT NULL,
    media_url TEXT NOT NULL,
    notes TEXT,
    customer_consent_public BOOLEAN NOT NULL DEFAULT FALSE,
    staff_approved_public BOOLEAN NOT NULL DEFAULT FALSE,
    is_ongoing BOOLEAN NOT NULL DEFAULT FALSE,
    is_completed BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by TEXT
  );`,

  `CREATE TABLE IF NOT EXISTS research_results (
    id TEXT PRIMARY KEY,
    item_id TEXT,
    item_name TEXT NOT NULL,
    category TEXT NOT NULL,
    current_value_m TEXT NOT NULL,
    previous_value_m TEXT,
    researched_value_m TEXT NOT NULL,
    change_percent NUMERIC(8, 2),
    status TEXT NOT NULL DEFAULT 'pending_approval',
    confidence TEXT NOT NULL DEFAULT 'medium',
    sources_count INTEGER NOT NULL DEFAULT 0,
    discrepancy_note TEXT,
    researched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    notes TEXT
  );`,

  `CREATE TABLE IF NOT EXISTS research_sources (
    id TEXT PRIMARY KEY,
    research_id TEXT NOT NULL REFERENCES research_results(id) ON DELETE CASCADE,
    source_name TEXT NOT NULL,
    source_url TEXT NOT NULL,
    reported_value_m TEXT NOT NULL,
    snippets TEXT,
    retrieved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  `CREATE TABLE IF NOT EXISTS value_history (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    item_name TEXT NOT NULL,
    old_value_m TEXT NOT NULL,
    new_value_m TEXT NOT NULL,
    change_reason TEXT NOT NULL,
    source_research_id TEXT,
    updated_by TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );`,

  `CREATE INDEX IF NOT EXISTS idx_services_slug ON services(slug);`,
  `CREATE INDEX IF NOT EXISTS idx_orders_public_token ON orders(public_token);`,
  `CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code);`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);`,
  `CREATE INDEX IF NOT EXISTS idx_order_audit_order_id ON order_audit(order_id);`,
  `CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);`,
  `CREATE INDEX IF NOT EXISTS idx_enquiries_status ON enquiries(status);`,
  `CREATE INDEX IF NOT EXISTS idx_service_evidence_order_id ON service_evidence(order_id);`,
  `CREATE INDEX IF NOT EXISTS idx_research_results_status ON research_results(status);`,
  `CREATE INDEX IF NOT EXISTS idx_research_sources_research_id ON research_sources(research_id);`,
  `CREATE INDEX IF NOT EXISTS idx_value_history_item_id ON value_history(item_id);`
];

let schemaInitialized = false;
let schemaInitPromise: Promise<void> | null = null;
let neonTablesAvailable = false;

export function areNeonTablesAvailable(): boolean {
  return neonTablesAvailable;
}

export async function ensureNeonSchema(): Promise<void> {
  const url = getDatabaseUrl();
  if (!url) return;
  if (schemaInitialized) return;
  if (schemaInitPromise) return schemaInitPromise;

  schemaInitPromise = (async () => {
    try {
      const sql = neon(url);

      // 1. Check existing tables in public schema to avoid redundant CREATE TABLE DDL
      const existingTableNames = new Set<string>();
      try {
        const rows = await (sql as any).query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public';
        `);
        if (Array.isArray(rows)) {
          rows.forEach((r: any) => {
            if (r.table_name) existingTableNames.add(String(r.table_name).toLowerCase());
          });
        }
      } catch (checkErr) {
        console.warn('Could not query information_schema.tables:', checkErr);
      }

      const coreTables = ['services', 'orders', 'order_items', 'order_audit', 'payments', 'enquiries', 'service_evidence'];
      const allExist = coreTables.every(t => existingTableNames.has(t));

      if (allExist) {
        console.log('Neon PostgreSQL core tables verified in public schema.');
        neonTablesAvailable = true;
        schemaInitialized = true;
        return;
      }

      // 2. Check if the current connected role has CREATE privilege on public schema
      let canCreate = true;
      try {
        const privRows = await (sql as any).query(`SELECT has_schema_privilege(current_user, 'public', 'CREATE') as can_create;`);
        const privRow = Array.isArray(privRows) ? privRows[0] : privRows;
        if (privRow && (privRow.can_create === false || privRow.can_create === 'f')) {
          canCreate = false;
        }
      } catch {
        // If privilege query is unsupported, proceed to attempt individual statements
      }

      if (!canCreate) {
        console.warn(
          'Notice: Connected Neon PostgreSQL role does not have CREATE permission on schema "public". ' +
          'Skipping automatic DDL table creation. To allow automatic migrations, run: GRANT ALL ON SCHEMA public TO <user>; in Neon SQL Editor or connect using neondb_owner.'
        );
        neonTablesAvailable = existingTableNames.has('services');
        schemaInitialized = true;
        return;
      }

      // 3. Execute DDL for missing tables and indexes
      for (const statement of NEON_SCHEMA_DDL) {
        try {
          await (sql as any).query(statement);
        } catch (stmtErr: any) {
          if (stmtErr?.message?.includes('permission denied for schema public')) {
            console.warn(`DDL skipped due to schema permissions: ${stmtErr.message}`);
          } else {
            throw stmtErr;
          }
        }
      }
      neonTablesAvailable = true;
      schemaInitialized = true;
      console.log('Neon PostgreSQL schema verified / created successfully.');
    } catch (err: any) {
      if (err?.message?.includes('permission denied for schema public')) {
        console.warn(
          'Notice: Neon role lacks CREATE permission on schema "public". ' +
          'Proceeding. If tables are not yet created, run: GRANT ALL ON SCHEMA public TO <user>; in Neon Console.'
        );
        neonTablesAvailable = false;
        schemaInitialized = true;
        return;
      }
      schemaInitialized = false;
      neonTablesAvailable = false;
      console.error('Failed to initialize Neon PostgreSQL schema:', err);
      throw err;
    } finally {
      schemaInitPromise = null;
    }
  })();

  return schemaInitPromise;
}

export function getNeonDb() {
  const url = getDatabaseUrl();
  if (!url) {
    ensureDatabaseConfigured();
    return null;
  }

  if (!dbInstance) {
    const sql = neon(url);
    rawSqlInstance = sql;
    dbInstance = drizzle(sql, { schema });
  }
  return dbInstance;
}

export { schema };

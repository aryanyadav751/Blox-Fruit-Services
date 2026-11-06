/**
 * Drizzle / Neon Schema Migration Runner
 * Run via: npx tsx src/db/migrate.ts
 */
import dotenv from 'dotenv';
import { ensureNeonSchema, isNeonConfigured } from './neon.ts';
import { dbRepository } from './index.ts';

dotenv.config();

async function runMigration() {
  if (!isNeonConfigured()) {
    console.warn('DATABASE_URL or POSTGRES_URL is not set. Skipping SQL migration runner.');
    return;
  }

  console.log('Connecting to Neon PostgreSQL and applying schema migrations...');
  await ensureNeonSchema();
  console.log('Schema verified / created successfully!');

  console.log('Verifying services catalog seed in Neon PostgreSQL...');
  const services = await dbRepository.getServices();
  console.log(`Database ready with ${services.length} catalogue items.`);
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});


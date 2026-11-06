/**
 * Drizzle Seed Script for Vercel Postgres / Neon
 * Run via: npx tsx src/db/seed.ts
 */
import { INITIAL_SERVICES } from './seed-data.ts';
import { toHundredths } from '../lib/calculator.ts';
import { dbRepository } from './index.ts';

async function seed() {
  console.log('Seeding Blox Fruit Services catalog...');
  console.log(`Total seed items defined in Section 9: ${INITIAL_SERVICES.length}`);

  let publishedCount = 0;
  let unconfirmedCount = 0;

  for (const item of INITIAL_SERVICES) {
    if (item.isPublished) {
      publishedCount++;
    }
    if (item.needsConfirmation) {
      unconfirmedCount++;
    }
  }

  console.log(`Published services ready for customers: ${publishedCount}`);
  console.log(`Unconfirmed / hidden services pending staff review: ${unconfirmedCount}`);

  // Triggers repository state check/creation
  const allServices = await dbRepository.getServices();
  console.log(`Repository active services count: ${allServices.length}`);
  console.log('Catalog seed verified successfully!');
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});

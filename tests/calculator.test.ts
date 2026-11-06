import assert from 'node:assert/strict';
import { 
  roundHalfUp, 
  toHundredths, 
  toMillionString, 
  calculateDepositAndRemaining, 
  calculateItemsTotal, 
  validatePaymentCoverage,
  generateOrderCode,
  generatePublicToken
} from '../src/lib/calculator.ts';
import { INITIAL_SERVICES } from '../src/db/seed-data.ts';

console.log('--- RUNNING CALCULATOR & SEED SPECIFICATION TESTS ---');

// Test 1: Round Half Up Math
assert.equal(roundHalfUp(2.4), 2, '2.4 rounds down to 2');
assert.equal(roundHalfUp(2.5), 3, '2.5 rounds half up to 3');
assert.equal(roundHalfUp(2.6), 3, '2.6 rounds up to 3');
assert.equal(roundHalfUp(7.5), 8, '7.5 rounds half up to 8');
assert.equal(roundHalfUp(0), 0, '0 stays 0');
console.log('✓ Round Half Up precision passed');

// Test 2: Hundredths conversions
assert.equal(toHundredths(45), 4500, '45M is 4500 hundredths');
assert.equal(toHundredths(0.15), 15, '0.15M is 15 hundredths');
assert.equal(toHundredths('2.5'), 250, '"2.5" is 250 hundredths');
assert.equal(toHundredths('0.1'), 10, '"0.1" is 10 hundredths');
assert.equal(toHundredths('175.00'), 17500, '"175.00" is 17500 hundredths');
assert.equal(toMillionString(4500), '45.00M', '4500 hundredths formats to 45.00M');
assert.equal(toMillionString(15), '0.15M', '15 hundredths formats to 0.15M');
assert.equal(toMillionString(5), '0.05M', '5 hundredths formats to 0.05M');
console.log('✓ Hundredths conversion & string formatting passed');

// Test 3: Invariant: deposit + remaining === total
const testTotalsM = [45, 85, 120, 170, 0.15, 0.1, 2, 75, 55, 35, 5, 15, 150, 125, 90, 1, 100, 175, 40, 2.5, 7, 10, 17, 30, 0.01, 0.03];
for (const totalM of testTotalsM) {
  const totalH = toHundredths(totalM);
  const { depositHundredths, remainingHundredths } = calculateDepositAndRemaining(totalH);

  // Invariant 1: sum equals exact total
  assert.equal(
    depositHundredths + remainingHundredths, 
    totalH, 
    `Deposit (${depositHundredths}) + Remaining (${remainingHundredths}) must strictly equal Total (${totalH}) for ${totalM}M`
  );

  // Invariant 2: deposit is at least half of the total
  assert.ok(
    depositHundredths >= totalH / 2, 
    `Deposit must be round half up of half total for ${totalM}M`
  );
}
console.log('✓ Invariant deposit + remaining === total verified across all catalog price points');

// Test 4: Odd hundredths rounding check
// For 0.15M (15 hundredths): 15 * 0.5 = 7.5 -> round half up = 8 hundredths (0.08M)
// Remaining = 15 - 8 = 7 hundredths (0.07M)
{
  const calcOdd = calculateDepositAndRemaining(15);
  assert.equal(calcOdd.depositHundredths, 8, '0.15M deposit is 8 hundredths (0.08M)');
  assert.equal(calcOdd.remainingHundredths, 7, '0.15M remaining is 7 hundredths (0.07M)');
  assert.equal(calcOdd.depositString, '0.08M');
  assert.equal(calcOdd.remainingString, '0.07M');
  assert.equal(calcOdd.depositHundredths + calcOdd.remainingHundredths, 15);
}
console.log('✓ Odd hundredths 50% split (0.15M -> 0.08M deposit + 0.07M remaining) passed');

// Test 5: Proposed items total calculation
{
  const items = [
    { itemName: 'Dough Fruit', quantity: 2, proposedValueM: 25 }, // 2 * 25 = 50M (5000)
    { itemName: 'Buddha Fruit', quantity: 1, proposedValueM: 7 },  // 1 * 7 = 7M (700)
    { itemName: 'Dark Fruit', quantity: 3, proposedValueM: 0.5 },  // 3 * 0.5 = 1.5M (150)
  ];
  const result = calculateItemsTotal(items);
  assert.equal(result.totalProposedHundredths, 5850, 'Total proposed is 58.50M (5850 hundredths)');
  assert.equal(result.totalProposedString, '58.50M');
}
console.log('✓ Multi-item trade value calculation passed');

// Test 6: Payment coverage validation
{
  // Service price: 100M (10000 hundredths). Deposit required: 50M (5000 hundredths).
  // Case A: Customer offers 40M (4000) -> Does not meet deposit (deficit 10M)
  const caseA = validatePaymentCoverage(10000, 4000);
  assert.equal(caseA.hasMetDeposit, false);
  assert.equal(caseA.hasMetTotal, false);
  assert.equal(caseA.depositDeficitHundredths, 1000);

  // Case B: Customer offers 50M (5000) -> Exactly meets deposit, not total
  const caseB = validatePaymentCoverage(10000, 5000);
  assert.equal(caseB.hasMetDeposit, true);
  assert.equal(caseB.hasMetTotal, false);
  assert.equal(caseB.depositDeficitHundredths, 0);
  assert.equal(caseB.totalDeficitHundredths, 5000);

  // Case C: Customer offers 120M (12000) -> Exceeds total
  const caseC = validatePaymentCoverage(10000, 12000);
  assert.equal(caseC.hasMetDeposit, true);
  assert.equal(caseC.hasMetTotal, true);
  assert.equal(caseC.depositDeficitHundredths, 0);
  assert.equal(caseC.totalDeficitHundredths, 0);
}
console.log('✓ Payment coverage thresholds & deposit deficit calculation passed');

// Test 7: Order Code & Unguessable Token Generation
{
  const code = generateOrderCode(1042);
  assert.equal(code, 'BFS-1042', 'Code matches format BFS-1042');

  const randomCode = generateOrderCode();
  assert.match(randomCode, /^BFS-\d{4,6}$/, 'Random code matches BFS-XXXX format');

  const token1 = generatePublicToken();
  const token2 = generatePublicToken();
  assert.equal(token1.length, 32, 'Public token is 32 hex chars');
  assert.notEqual(token1, token2, 'Public tokens are unique and non-sequential');
}
console.log('✓ Order code format and unguessable token entropy passed');

// Test 8: Catalog Seed Specification Integrity (§9)
{
  // Total services check
  assert.ok(INITIAL_SERVICES.length >= 35, `Catalog contains ${INITIAL_SERVICES.length} items`);

  // Section 9 uncertain items must be unpublished and flagged needsConfirmation=true
  const uncertainSlugs = [
    'trial-4-completions',
    'other-materials-bundle',
    'tyrant-of-the-skies',
    'cyborg-v1-unlock',
    'v2-v3-race-combo',
    'level-100-boost-bundle',
    'upgrade-accessories-service',
    'prehistoric-island-ph',
    'prehistoric-island-magnets',
    'dough-full-awakening',
    'custom-fruit-raid-awakening',
    'low-raids-single',
    'raids-until-core-break',
    'hard-dungeon-carry',
    'challenging-dungeon-carry',
    '10m-beli-carry',
  ];

  for (const slug of uncertainSlugs) {
    const item = INITIAL_SERVICES.find(s => s.slug === slug);
    assert.ok(item, `Uncertain item with slug "${slug}" exists in seed`);
    assert.equal(item.isPublished, false, `Item "${item.name}" must be unpublished`);
    assert.equal(item.needsConfirmation, true, `Item "${item.name}" must have needsConfirmation=true`);
  }

  // Published items must have isPublished=true and needsConfirmation=false
  const confirmedSlugs = [
    'trial-1-completion',
    'trial-2-completions',
    'trial-3-completions',
    'trial-5-completions',
    'vampire-fang-farm',
    'scrap-metal-farm',
    'dough-king-kill',
    'cake-prince-kill',
    'darkbeard-kill',
    'swan-glasses-drop',
    'pale-scarf-drop',
    'true-triple-katana',
    'shark-anchor-sword',
    'leviathan-hunt',
    'terror-shark-kill',
    '1m-beli-carry',
  ];

  for (const slug of confirmedSlugs) {
    const item = INITIAL_SERVICES.find(s => s.slug === slug);
    assert.ok(item, `Confirmed item with slug "${slug}" exists in seed`);
    assert.equal(item.isPublished, true, `Item "${item.name}" must be published`);
    assert.equal(item.needsConfirmation, false, `Item "${item.name}" must have needsConfirmation=false`);
  }
}
console.log('✓ Initial catalog seed rules & uncertainty flag isolation passed');

console.log('\nALL STAGE 1 TESTS PASSED SUCCESSFULLY!');

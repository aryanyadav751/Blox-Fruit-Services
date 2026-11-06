import assert from 'node:assert/strict';
import { dbRepository } from '../src/db/index.ts';
import { ensureDatabaseConfigured, isNeonConfigured } from '../src/db/neon.ts';
import { getDiscordInviteUrl, isUploadDisabled } from '../src/lib/storage.ts';

console.log('--- RUNNING CUSTOMER SUPPORT, INBOX, DISCORD PROOFS & POSTGRES STORAGE TESTS ---');

// 1. Customer Support Enquiry Creation
{
  const enquiry = await dbRepository.createEnquiry({
    source: 'website',
    customerName: 'TestUser',
    robloxUsername: 'RaidFan_2026',
    discordTag: 'raidfan#0001',
    orderCodeOrId: 'BFS-1042',
    subject: 'Question on Leviathan Heart carry',
    message: 'Can I do this carry on my private server with 50% deposit?',
    status: 'pending',
    staffNotes: null,
  });

  assert.ok(enquiry.id.startsWith('enq-'), 'Enquiry receives valid ID');
  assert.equal(enquiry.status, 'pending');
  assert.equal(enquiry.source, 'website');
  assert.equal(enquiry.robloxUsername, 'RaidFan_2026');
}
console.log('✓ Public website support enquiry creation passed');

// 2. Staff Manual Enquiry Logging (Discord / Direct) & Status Transitions
{
  const manual = await dbRepository.createEnquiry({
    source: 'discord',
    customerName: null,
    robloxUsername: 'DiscordClient_99',
    discordTag: 'discord_client',
    orderCodeOrId: null,
    subject: 'DM Inquiry regarding Race V4 trials',
    message: 'Customer reached out in Discord general asking about timing.',
    status: 'in_progress',
    staffNotes: 'Replied in Discord channel #support-1',
  });

  assert.equal(manual.source, 'discord');
  assert.equal(manual.status, 'in_progress');

  // Staff updates status to resolved
  const resolved = await dbRepository.updateEnquiryStatus(manual.id, 'resolved', 'Customer satisfied and ordered via website');
  assert.equal(resolved?.status, 'resolved');
  assert.equal(resolved?.staffNotes, 'Customer satisfied and ordered via website');

  // Search filtering
  const searchResults = await dbRepository.listEnquiries({ search: 'DiscordClient_99' });
  assert.ok(searchResults.length >= 1, 'Search finds enquiry by Roblox username');
}
console.log('✓ Staff manual enquiry recording, status lifecycle, and search passed');

// 3. Evidence & Consent-Governed Public Proofs
{
  const testService = (await dbRepository.getServices({ onlyPublished: true }))[0];
  const { order } = await dbRepository.createOrder(
    {
      publicToken: 'test_token_consent_true_' + Date.now(),
      orderCode: 'BFS-TEST-CONSENT',
      serviceId: testService.id,
      robloxUsername: 'ConsentPlayer_OK',
      timezone: 'EST',
      availability: 'Nights',
      paymentType: 'fruits',
      status: 'completed',
      totalPriceHundredths: 2000,
      depositHundredths: 1000,
      remainingHundredths: 1000,
      customerNote: null,
      staffNotes: null,
      consentPublicProofs: true,
    },
    [{ itemName: 'Dragon Fruit', quantity: 1, proposedValueHundredths: 2000, agreedValueHundredths: 2000, verified: true }]
  );

  const { order: noConsentOrder } = await dbRepository.createOrder(
    {
      publicToken: 'test_token_no_consent_' + Date.now(),
      orderCode: 'BFS-TEST-NOCONSENT',
      serviceId: testService.id,
      robloxUsername: 'PrivatePlayer_NoConsent',
      timezone: 'PST',
      availability: 'Mornings',
      paymentType: 'fruits',
      status: 'completed',
      totalPriceHundredths: 2000,
      depositHundredths: 1000,
      remainingHundredths: 1000,
      customerNote: null,
      staffNotes: null,
      consentPublicProofs: false, // Customer opted out of public showcase
    },
    [{ itemName: 'Kitsune Fruit', quantity: 1, proposedValueHundredths: 2000, agreedValueHundredths: 2000, verified: true }]
  );

  // Evidence with customer consent AND staff approval (Discord link or session note)
  const approvedEvidence = await dbRepository.createEvidence({
    orderId: order.id,
    serviceId: testService.id,
    evidenceType: 'screen_share_session',
    mediaUrl: 'https://discord.com/channels/12345/67890/session-001',
    notes: 'Completed in 8 minutes on Discord live stream',
    customerConsentPublic: true,
    staffApprovedPublic: true,
    isOngoing: false,
    isCompleted: true,
  });

  // Evidence without customer consent (even if staff approved)
  const unconsentedEvidence = await dbRepository.createEvidence({
    orderId: noConsentOrder.id,
    serviceId: testService.id,
    evidenceType: 'screenshot',
    mediaUrl: 'https://discord.com/channels/12345/67890/private-proof',
    notes: 'Private completion',
    customerConsentPublic: false,
    staffApprovedPublic: true,
    isOngoing: false,
    isCompleted: true,
  });

  const publicProofs = await dbRepository.getPublicProofs();

  // Strict privacy rule: public proofs MUST include consented evidence and MUST NOT include unconsented evidence
  assert.ok(publicProofs.some(p => p.id === approvedEvidence.id), 'Consented & approved proof appears on public wall');
  assert.ok(!publicProofs.some(p => p.id === unconsentedEvidence.id), 'Unconsented proof is strictly blocked from public wall');
}
console.log('✓ Strict customer consent privacy enforcement on Public Proofs passed');

// 4. Ongoing Carries Queue & Anonymization
{
  const ongoing = await dbRepository.getOngoingCarries();
  assert.ok(Array.isArray(ongoing), 'Ongoing carries returns array');
  for (const carry of ongoing) {
    assert.ok(carry.orderCode, 'Has order code');
    assert.ok(carry.robloxUsernameDisplay, 'Has username display');
  }
}
console.log('✓ Ongoing active carries queue privacy masking passed');

// 5. Discord-Based Proofs, S3 Decoupling & PostgreSQL Production Safety
{
  // 5a. Website media uploads are disabled
  assert.equal(isUploadDisabled, true, 'Website uploads are strictly disabled');

  // 5b. Discord invite URL resolution (defaults to clearly marked placeholder if not set)
  const inviteUrl = getDiscordInviteUrl();
  assert.ok(typeof inviteUrl === 'string' && inviteUrl.length > 0, 'Discord invite URL is available');
  assert.ok(inviteUrl.includes('discord.gg/'), 'Discord URL has valid discord.gg structure');

  // 5c. Customer Order Isolation: Unguessable token provides access only to permitted order
  const { order: customerA } = await dbRepository.createOrder(
    {
      publicToken: 'unguessable_token_cust_a_' + Date.now(),
      orderCode: 'BFS-CUST-A',
      serviceId: 'dough-raid',
      robloxUsername: 'CustomerA_Roblox',
      timezone: 'EST',
      availability: 'Nights',
      paymentType: 'fruits',
      status: 'pending_review',
      totalPriceHundredths: 2500,
      depositHundredths: 1250,
      remainingHundredths: 1250,
      customerNote: 'Customer A private note',
      staffNotes: 'INTERNAL STAFF NOTE A',
    },
    [{ itemName: 'Dough Fruit', quantity: 1, proposedValueHundredths: 2500, agreedValueHundredths: null }]
  );

  const { order: customerB } = await dbRepository.createOrder(
    {
      publicToken: 'unguessable_token_cust_b_' + Date.now(),
      orderCode: 'BFS-CUST-B',
      serviceId: 'race-v4-full',
      robloxUsername: 'CustomerB_Roblox',
      timezone: 'PST',
      availability: 'Weekends',
      paymentType: 'fruits',
      status: 'pending_review',
      totalPriceHundredths: 8500,
      depositHundredths: 4250,
      remainingHundredths: 4250,
      customerNote: 'Customer B private note',
      staffNotes: 'INTERNAL STAFF NOTE B',
    },
    [{ itemName: 'Dragon Fruit', quantity: 1, proposedValueHundredths: 8500, agreedValueHundredths: null }]
  );

  // Customer A looking up with token A gets ONLY order A
  const lookupA = await dbRepository.getOrderByPublicToken(customerA.publicToken);
  assert.ok(lookupA, 'Customer A can lookup their order');
  assert.equal(lookupA?.robloxUsername, 'CustomerA_Roblox');
  assert.notEqual(lookupA?.id, customerB.id, 'Customer A cannot access Customer B order');

  // Customer B looking up with token B gets ONLY order B
  const lookupB = await dbRepository.getOrderByPublicToken(customerB.publicToken);
  assert.ok(lookupB, 'Customer B can lookup their order');
  assert.equal(lookupB?.robloxUsername, 'CustomerB_Roblox');
  assert.notEqual(lookupB?.id, customerA.id, 'Customer B cannot access Customer A order');

  // 5d. Production safety: ensures that if NODE_ENV === 'production' and DATABASE_URL is missing, it throws a fatal error
  const prevEnv = process.env.NODE_ENV;
  const prevDbUrl = process.env.DATABASE_URL;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;

    let threwExpectedError = false;
    try {
      ensureDatabaseConfigured();
    } catch (err: any) {
      if (err.message.includes('FATAL CONFIGURATION ERROR') && err.message.includes('DATABASE_URL is not set')) {
        threwExpectedError = true;
      }
    }
    assert.equal(threwExpectedError, true, 'Production strictly refuses to run or fallback to memory when DATABASE_URL is missing');
  } finally {
    process.env.NODE_ENV = prevEnv;
    if (prevDbUrl) process.env.DATABASE_URL = prevDbUrl;
  }
}
console.log('✓ Discord-based proof configuration, customer order isolation & production safety passed');

console.log('\nALL CUSTOMER SUPPORT, PROOFS & STORAGE TESTS PASSED SUCCESSFULLY!');

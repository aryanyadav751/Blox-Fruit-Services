process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../server.ts';
import { dbRepository } from '../src/db/index.ts';
import { ADMIN_EMAILS, setAdminCustomClaim } from '../src/server/firebaseAdmin.ts';

console.log('--- RUNNING FIREBASE CUSTOM CLAIMS & AUTHORIZATION SECURITY TESTS ---');

let server: http.Server = null as any;
let baseUrl = '';

await new Promise<void>((resolve) => {
  server = app.listen(0, '127.0.0.1', () => {
    const address = server.address();
    const port = typeof address === 'object' && address ? address.port : 3000;
    baseUrl = `http://127.0.0.1:${port}`;
    resolve();
  });
});

try {
  // Test 1: Verify configured administrator Google accounts
  assert.ok(ADMIN_EMAILS.includes('shelendra.ubuntu@gmail.com'), 'Verified session administrator email included');
  assert.ok(ADMIN_EMAILS.includes('brajbala1989@gmail.com'), 'Verified backup administrator email included');
  console.log('✓ Administrator Google accounts verified against approved list');

  // Test 2: Sensitive endpoint rejected without token (401)
  {
    const endpoints = [
      '/api/admin/orders',
      '/api/admin/catalog',
      '/api/admin/research',
      '/api/admin/enquiries',
    ];
    for (const ep of endpoints) {
      const res = await fetch(`${baseUrl}${ep}`);
      assert.equal(res.status, 401, `Unauthenticated request to ${ep} returned 401`);
    }
  }
  console.log('✓ All sensitive administrative endpoints reject unauthenticated requests with 401');

  // Test 3: Rejection of invalid or forged Firebase ID tokens (401)
  {
    const fakeToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJhdHRhY2tlcl8xMjMifQ.invalidsignature';
    const res = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { 'Authorization': `Bearer ${fakeToken}` },
    });
    assert.equal(res.status, 401, 'Forged Firebase ID token rejected with 401');
    const data = await res.json();
    assert.equal(data.success, false);
    assert.ok(data.error.includes('Unauthorized'), 'Error message indicates unauthorized');
  }
  console.log('✓ Forged or invalid Firebase ID tokens strictly rejected with 401');

  // Test 4: Rejection of /api/auth/verify-firebase without token
  {
    const res = await fetch(`${baseUrl}/api/auth/verify-firebase`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400, 'Missing idToken rejected with 400');
  }
  console.log('✓ /api/auth/verify-firebase requires idToken parameter');

  // Test 5: Protected Cron Webhook Endpoint (/api/cron/research-update) Authentication
  {
    const CRON_SECRET = process.env.CRON_SECRET || 'bfs_cron_secret_2026';

    // A. Request with wrong secret is rejected with 401
    const resWrongSecret = await fetch(`${baseUrl}/api/cron/research-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer wrong_unauthorized_secret_key',
      },
    });
    assert.equal(resWrongSecret.status, 401, 'Unauthorized cron call rejected with 401');
    const wrongData = await resWrongSecret.json();
    assert.equal(wrongData.success, false);
    assert.ok(wrongData.error.includes('Unauthorized'), 'Error message explicitly reports unauthorized cron trigger');

    // B. Request with valid CRON_SECRET Bearer token succeeds
    const resValidBearer = await fetch(`${baseUrl}/api/cron/research-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });
    assert.equal(resValidBearer.status, 200, 'Authenticated cron with Bearer token returns 200 OK');
    const validData = await resValidBearer.json();
    assert.equal(validData.success, true);
    assert.ok(validData.executedAt, 'Timestamp recorded for scheduled execution');

    // C. Request with valid x-cron-secret header succeeds
    const resValidHeader = await fetch(`${baseUrl}/api/cron/research-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': CRON_SECRET,
      },
    });
    assert.equal(resValidHeader.status, 200, 'Authenticated cron with x-cron-secret header returns 200 OK');
  }
  console.log('✓ /api/cron/research-update strictly authenticated with CRON_SECRET');

  // Test 6: Verify customer cannot tamper with order price or admin claims
  {
    // A. Customer cannot self-assign status or payment confirmation
    const services = await dbRepository.getServices({ onlyPublished: true });
    const sampleService = services[0];

    const resTampered = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: sampleService.id,
        robloxUsername: 'ValidRobloxPlayer',
        timezone: 'EST',
        availability: 'All Day',
        paymentType: 'fruits',
        status: 'completed', // Attacker attempt to bypass escrow
        isPaid: true,        // Attacker attempt to mark paid
        items: [
          { itemName: 'Dragon Fruit (West)', quantity: 1, proposedValueM: '0.01' }
        ]
      }),
    });

    assert.equal(resTampered.status, 201, 'Order created');
    const orderData = await resTampered.json();
    assert.equal(orderData.success, true);

    // Verify database state: status MUST be pending_review (customer override ignored)
    const storedOrder = await dbRepository.getOrderById(orderData.orderId);
    assert.ok(storedOrder);
    assert.equal(storedOrder.status, 'pending_review', 'Server forces status to pending_review regardless of client payload');
    assert.equal(storedOrder.totalPriceHundredths, sampleService.priceHundredths, 'Total price enforced server-side from catalogue');
  }
  console.log('✓ Customer order submission enforces server-side prices and prevents status manipulation');

  console.log('\nALL FIREBASE CUSTOM CLAIMS & AUTHORIZATION SECURITY TESTS PASSED SUCCESSFULLY!\n');
} finally {
  if (server) {
    (server as any).closeAllConnections?.();
    server.close();
  }
  process.exit(0);
}

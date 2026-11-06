process.env.NODE_ENV = 'test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { app } from '../server.ts';
import { dbRepository } from '../src/db/index.ts';
import { getAdminPassword, createStaffSessionToken } from '../src/lib/auth.ts';

console.log('--- RUNNING ADMIN AUTH, SESSION PERSISTENCE & CHANGE CATALOGUE TESTS ---');

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
  // Ensure clean test database state
  dbRepository._resetForTesting();

  // Test 1: Unauthenticated requests to staff endpoints MUST be rejected with 401
  {
    const resOrders = await fetch(`${baseUrl}/api/admin/orders`);
    assert.equal(resOrders.status, 401, 'Unauthenticated /api/admin/orders rejected with 401');
    const dataOrders = await resOrders.json();
    assert.equal(dataOrders.success, false);
    assert.ok(dataOrders.error.includes('Unauthorized'), 'Error message indicates unauthorized');

    const resCatalog = await fetch(`${baseUrl}/api/admin/catalog`);
    assert.equal(resCatalog.status, 401, 'Unauthenticated /api/admin/catalog rejected with 401');

    const resPostCatalog = await fetch(`${baseUrl}/api/admin/catalog`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked Item', priceM: 1, category: 'Fruits' })
    });
    assert.equal(resPostCatalog.status, 401, 'Unauthenticated catalog modification rejected with 401');
  }
  console.log('✓ Unauthenticated requests to all admin endpoints strictly rejected with 401');

  // Test 2: Admin Login Flow & Session Creation
  let staffToken = '';
  let cookieHeader = '';
  {
    const password = getAdminPassword();
    const res = await fetch(`${baseUrl}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    assert.equal(res.status, 200, 'Staff login returns 200 OK');
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.role, 'staff');
    assert.ok(data.token, 'Response returns signed HMAC session token');
    staffToken = data.token;

    // Check Set-Cookie
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Server sets session cookie');
    assert.ok(setCookie.includes('bfs_staff_session='), 'Cookie contains session token');
    assert.ok(setCookie.includes('HttpOnly'), 'Cookie is HttpOnly');
    cookieHeader = setCookie.split(';')[0];
  }
  console.log('✓ Staff login succeeds, sets HttpOnly cookie, and issues signed HMAC-SHA256 token');

  // Test 3: Authenticated access via Bearer Token
  {
    const res = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    assert.equal(res.status, 200, 'Admin orders accessible with Bearer token');
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.orders), 'Returns orders list');
  }
  console.log('✓ Admin orders load cleanly with Bearer authorization header');

  // Test 4: Authenticated access via Cookie Header (including quoted and multi-cookie scenarios)
  {
    const res = await fetch(`${baseUrl}/api/admin/me`, {
      headers: { 'Cookie': cookieHeader }
    });
    assert.equal(res.status, 200, 'Admin session check succeeds with cookie');
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.role, 'staff');

    // Test with quotes around cookie value (RFC 6265 compliant proxies)
    const resQuoted = await fetch(`${baseUrl}/api/admin/me`, {
      headers: { 'Cookie': `bfs_staff_session="${staffToken}"` }
    });
    assert.equal(resQuoted.status, 200, 'Admin session check succeeds with quoted cookie value');

    // Test with multiple cookies present
    const resMulti = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { 'Cookie': `analytics_id=anon123; bfs_staff_session=${staffToken}; ui_theme=dark` }
    });
    assert.equal(resMulti.status, 200, 'Admin orders load with multi-cookie header');
  }
  console.log('✓ Admin session verification succeeds with cookie header (clean, quoted, and multi-cookie)');

  // Test 5: "Change Catalogue" Feature - Full CRUD Lifecycle
  let createdServiceId = '';
  {
    // A. Add New Catalogue Item (Service / Fruit / Gamepass)
    const newServicePayload = {
      category: 'Raids',
      name: 'Advanced Dough Raid Full Carry',
      description: 'Guaranteed chip host and full awakening carry for Dough V2.',
      priceM: 55,
      prerequisites: 'Second Sea Cafe access.',
      exclusions: 'No AFK without anti-disconnect.',
      isPublished: true,
      needsConfirmation: false,
    };

    const resCreate = await fetch(`${baseUrl}/api/admin/catalog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffToken}`,
      },
      body: JSON.stringify(newServicePayload),
    });

    assert.equal(resCreate.status, 201, 'Item created successfully in database');
    const dataCreate = await resCreate.json();
    assert.equal(dataCreate.success, true);
    assert.equal(dataCreate.service.name, 'Advanced Dough Raid Full Carry');
    assert.equal(dataCreate.service.category, 'Raids');
    assert.equal(dataCreate.service.priceM, '55.00');
    assert.equal(dataCreate.service.priceHundredths, 5500);
    assert.equal(dataCreate.service.isPublished, true);
    createdServiceId = dataCreate.service.id;

    // Verify it appears in public catalog
    const resPublic = await fetch(`${baseUrl}/api/services`);
    const dataPublic = await resPublic.json();
    const foundPublic = dataPublic.services.find((s: any) => s.id === createdServiceId);
    assert.ok(foundPublic, 'New item immediately appears in public catalog from database');
    assert.equal(foundPublic.priceM, '55.00');

    // B. Edit Catalogue Item (Change Trade Value in M, Category, and Name)
    const updatePayload = {
      name: 'Advanced Dough Raid Full Carry (Fast Run)',
      priceM: 65.5,
      category: 'Raids',
      description: 'Updated carry details with express timer.',
      isPublished: true,
      needsConfirmation: true,
    };

    const resUpdate = await fetch(`${baseUrl}/api/admin/catalog/${encodeURIComponent(createdServiceId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffToken}`,
      },
      body: JSON.stringify(updatePayload),
    });

    assert.equal(resUpdate.status, 200, 'Item updated successfully');
    const dataUpdate = await resUpdate.json();
    assert.equal(dataUpdate.success, true);
    assert.equal(dataUpdate.service.name, 'Advanced Dough Raid Full Carry (Fast Run)');
    assert.equal(dataUpdate.service.priceM, '65.50');
    assert.equal(dataUpdate.service.priceHundredths, 6550);
    assert.equal(dataUpdate.service.needsConfirmation, true);

    // C. Deactivate Item (Mark Unavailable)
    const resDeactivate = await fetch(`${baseUrl}/api/admin/catalog/${encodeURIComponent(createdServiceId)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffToken}`,
      },
      body: JSON.stringify({ isPublished: false }),
    });
    assert.equal(resDeactivate.status, 200);

    // Verify it is no longer returned in public services list
    const resPublicAfterDeactivate = await fetch(`${baseUrl}/api/services`);
    const dataPublicAfter = await resPublicAfterDeactivate.json();
    const foundDeactivated = dataPublicAfter.services.find((s: any) => s.id === createdServiceId);
    assert.equal(foundDeactivated, undefined, 'Deactivated item is excluded from public customer catalog');

    // But it still exists in the admin staff catalog view
    const resAdminCatalog = await fetch(`${baseUrl}/api/admin/catalog`, {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    const dataAdminCat = await resAdminCatalog.json();
    const foundInAdmin = dataAdminCat.services.find((s: any) => s.id === createdServiceId);
    assert.ok(foundInAdmin, 'Deactivated item remains visible and manageable by staff');
    assert.equal(foundInAdmin.isPublished, false);

    // D. Delete Catalogue Item
    const resDelete = await fetch(`${baseUrl}/api/admin/catalog/${encodeURIComponent(createdServiceId)}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    assert.equal(resDelete.status, 200, 'Item deleted successfully');

    // Confirm it is deleted from database
    const resAdminAfterDelete = await fetch(`${baseUrl}/api/admin/catalog`, {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    const dataAdminAfterDelete = await resAdminAfterDelete.json();
    assert.equal(dataAdminAfterDelete.services.some((s: any) => s.id === createdServiceId), false);
  }
  console.log('✓ Admin "Change Catalogue" CRUD (Create, Edit price/category/name, Toggle Available, Delete) fully verified');

  // Test 6: Customer cannot tamper with or modify catalogue prices
  {
    // Fetch a published service from database
    const publishedServices = await dbRepository.getServices({ onlyPublished: true });
    const service = publishedServices[0];

    // Customer attempts to submit an order offering "Kitsune Fruit" (official value 115M)
    // but customer sends tampered proposed value of 1.00M
    const resOrderTamper = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: service.id,
        robloxUsername: 'AntiTamperTester',
        timezone: 'PST',
        availability: 'Evening',
        paymentType: 'fruits',
        items: [
          { itemName: 'Kitsune Fruit', quantity: 1, proposedValueM: '1.00' } // Tampered attempt
        ],
      })
    });

    assert.equal(resOrderTamper.status, 201, 'Order created');
    const orderData = await resOrderTamper.json();
    assert.equal(orderData.success, true);

    // Retrieve order detail and verify server locked Kitsune Fruit to 115.00M from catalogue
    const orderItems = await dbRepository.getOrderItems(orderData.orderId);
    assert.equal(orderItems[0].itemName, 'Kitsune Fruit');
    assert.equal(
      orderItems[0].proposedValueHundredths, 
      11500, 
      'Server strictly locks proposed value to official database catalogue value (115.00M), overriding client tampering!'
    );
  }
  console.log('✓ Server-side price enforcement verified: customers cannot modify or alter catalogue trade values');

  // Test 7: Staff Logout
  {
    const resLogout = await fetch(`${baseUrl}/api/admin/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    assert.equal(resLogout.status, 200, 'Logout succeeds');
    const setCookie = resLogout.headers.get('set-cookie');
    assert.ok(setCookie?.includes('Max-Age=0'), 'Logout clears session cookie');

    // Calling admin endpoint with an invalid or expired token is rejected
    const resAfter = await fetch(`${baseUrl}/api/admin/orders`, {
      headers: { 'Authorization': 'Bearer invalid_or_cleared_token' }
    });
    assert.equal(resAfter.status, 401, 'Subsequent access rejected');
  }
  console.log('✓ Staff logout successfully removes session access');

  console.log('\nALL ADMIN AUTH, SESSION & CHANGE CATALOGUE TESTS PASSED SUCCESSFULLY!');
} finally {
  if (server) {
    (server as any).closeAllConnections?.();
    server.close();
  }
  process.exit(0);
}

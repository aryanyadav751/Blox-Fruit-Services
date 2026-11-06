import assert from 'node:assert/strict';
import { dbRepository } from '../src/db/index.ts';
import { 
  toHundredths, 
  calculateDepositAndRemaining, 
  generatePublicToken 
} from '../src/lib/calculator.ts';

console.log('--- RUNNING STAGE 2 PUBLIC ORDER & CATALOG TESTS ---');

// Test 1: Only published services are returned for customers
{
  const publishedServices = await dbRepository.getServices({ onlyPublished: true });
  assert.ok(publishedServices.length > 0, 'There are published services');
  for (const s of publishedServices) {
    assert.equal(s.isPublished, true, `Service "${s.name}" must have isPublished=true`);
  }

  // Ensure uncertain items are strictly excluded
  const uncertainInPublished = publishedServices.find(s => s.needsConfirmation);
  assert.equal(uncertainInPublished, undefined, 'Uncertain/unconfirmed items must NOT appear in customer catalog');
}
console.log('✓ Public catalog strictly filters unpublished and uncertain services');

// Test 2: Order Creation Invariant & Item Attachment
{
  const targetService = (await dbRepository.getServices({ onlyPublished: true }))[0];
  const { depositHundredths, remainingHundredths } = calculateDepositAndRemaining(targetService.priceHundredths);
  const token = generatePublicToken();
  const code = await dbRepository.getNextOrderCode();

  const { order, items } = await dbRepository.createOrder(
    {
      publicToken: token,
      orderCode: code,
      serviceId: targetService.id,
      robloxUsername: 'TestPirate_88',
      timezone: 'PST',
      availability: 'Evenings',
      paymentType: 'fruits',
      status: 'pending_review',
      totalPriceHundredths: targetService.priceHundredths,
      depositHundredths,
      remainingHundredths,
      customerNote: 'First test order',
      staffNotes: null,
    },
    [
      { itemName: 'Leopard Fruit', quantity: 1, proposedValueHundredths: 4000, agreedValueHundredths: null },
      { itemName: 'Buddha Fruit', quantity: 1, proposedValueHundredths: 700, agreedValueHundredths: null },
    ]
  );

  assert.equal(order.orderCode, code);
  assert.equal(order.publicToken, token);
  assert.equal(order.status, 'pending_review');
  assert.equal(order.depositHundredths + order.remainingHundredths, targetService.priceHundredths);
  assert.equal(items.length, 2);
  assert.equal(items[0].verified, false);

  // Retrieval by public token
  const retrieved = await dbRepository.getOrderByPublicToken(token);
  assert.ok(retrieved, 'Order can be retrieved by unguessable publicToken');
  assert.equal(retrieved.id, order.id);

  // Audit log was created
  const auditLogs = await dbRepository.getOrderAuditLogs(order.id);
  assert.ok(auditLogs.length >= 1, 'Initial customer order audit log was recorded');
  assert.equal(auditLogs[0].action, 'ORDER_SUBMITTED');
}
console.log('✓ Order creation, unguessable token lookup, and customer audit trail passed');

console.log('\nALL STAGE 2 TESTS PASSED SUCCESSFULLY!');

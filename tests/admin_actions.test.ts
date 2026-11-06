import assert from 'node:assert/strict';
import { 
  verifyAdminPassword, 
  getAdminPassword,
  createStaffSessionToken, 
  verifyStaffSessionToken 
} from '../src/lib/auth.ts';
import { dbRepository } from '../src/db/index.ts';
import { calculateDepositAndRemaining, generatePublicToken } from '../src/lib/calculator.ts';

console.log('--- RUNNING STAGE 3 ADMIN AUTH & STAFF ACTIONS TESTS ---');

// Test 1: Password Verification
{
  const activePassword = getAdminPassword();
  assert.equal(verifyAdminPassword(activePassword), true, 'Correct configured password passes');
  assert.equal(verifyAdminPassword('wrong_password_incorrect_123'), false, 'Incorrect password fails');
  assert.equal(verifyAdminPassword(''), false, 'Empty password fails');
}
console.log('✓ Admin password constant-time verification passed');

// Test 2: Cryptographic Session Tokens
{
  const token = createStaffSessionToken('staff_alex');
  assert.ok(token.includes('.'), 'Token has signature separator');

  const session = verifyStaffSessionToken(token);
  assert.ok(session !== null, 'Valid token verifies cleanly');
  assert.equal(session?.role, 'staff');
  assert.equal(session?.staffId, 'staff_alex');

  // Tampered payload
  const parts = token.split('.');
  const tampered = `eyJyYW5kb20iOjF9.${parts[1]}`;
  assert.equal(verifyStaffSessionToken(tampered), null, 'Tampered token is rejected');

  // Tampered signature
  const fakeSig = `${parts[0]}.bad_signature_here`;
  assert.equal(verifyStaffSessionToken(fakeSig), null, 'Invalid signature is rejected');
}
console.log('✓ HMAC-SHA256 session token generation, verification, and tamper rejection passed');

// Test 3: Staff Order Lifecycle & Audit Invariants
{
  // 1. Create a test order
  const service = (await dbRepository.getServices({ onlyPublished: true }))[0];
  const { depositHundredths, remainingHundredths } = calculateDepositAndRemaining(service.priceHundredths);
  const code = await dbRepository.getNextOrderCode();
  const token = generatePublicToken();

  const { order, items } = await dbRepository.createOrder(
    {
      publicToken: token,
      orderCode: code,
      serviceId: service.id,
      robloxUsername: 'Stage3Tester',
      timezone: 'EST',
      availability: 'Nightly',
      paymentType: 'fruits',
      status: 'pending_review',
      totalPriceHundredths: service.priceHundredths,
      depositHundredths,
      remainingHundredths,
      customerNote: 'Testing stage 3',
      staffNotes: null,
    },
    [
      { itemName: 'Dough Fruit', quantity: 1, proposedValueHundredths: 2500, agreedValueHundredths: null },
      { itemName: 'T-Rex Fruit', quantity: 1, proposedValueHundredths: 2000, agreedValueHundredths: null },
    ]
  );

  assert.equal(order.status, 'pending_review');

  // 2. Staff inspects & confirms item valuation
  const updatedItem1 = await dbRepository.updateOrderItem(items[0].id, {
    agreedValueHundredths: 2500,
    verified: true,
  });
  assert.equal(updatedItem1?.verified, true);
  assert.equal(updatedItem1?.agreedValueHundredths, 2500);

  // 3. Staff accepts order
  const acceptedOrder = await dbRepository.updateOrderStatus(order.id, 'accepted', 'staff', 'Offer accepted by Alex');
  assert.equal(acceptedOrder?.status, 'accepted');

  // 4. Staff records 50% deposit received in-game
  const depositPayment = await dbRepository.recordPayment(
    order.id,
    'deposit',
    depositHundredths,
    JSON.stringify([{ itemName: 'Dough Fruit', value: '25.00M' }]),
    'Staff_Alex'
  );
  assert.equal(depositPayment.kind, 'deposit');
  assert.equal(depositPayment.amountHundredths, depositHundredths);
  assert.equal(depositPayment.recordedBy, 'Staff_Alex');

  await dbRepository.updateOrderStatus(order.id, 'deposit_received', 'staff', '50% deposit received in-game');
  assert.equal((await dbRepository.getOrderById(order.id))?.status, 'deposit_received');

  // 5. Staff marks in_progress
  await dbRepository.updateOrderStatus(order.id, 'in_progress', 'staff', 'Carry commenced');
  assert.equal((await dbRepository.getOrderById(order.id))?.status, 'in_progress');

  // 6. Staff marks completed
  await dbRepository.updateOrderStatus(order.id, 'completed', 'staff', 'Carry finished');
  assert.equal((await dbRepository.getOrderById(order.id))?.status, 'completed');

  // 7. Staff records remaining payment -> fully_paid
  const remainingPayment = await dbRepository.recordPayment(
    order.id,
    'remaining',
    remainingHundredths,
    JSON.stringify([{ itemName: 'T-Rex Fruit', value: '20.00M' }]),
    'Staff_Alex'
  );
  assert.equal(remainingPayment.kind, 'remaining');
  await dbRepository.updateOrderStatus(order.id, 'fully_paid', 'staff', 'Remaining balance received in-game');
  assert.equal((await dbRepository.getOrderById(order.id))?.status, 'fully_paid');

  // 8. Audit trail check: every single action above generated an immutable log
  const auditLogs = await dbRepository.getOrderAuditLogs(order.id);
  assert.ok(auditLogs.length >= 6, `Expected at least 6 audit log entries, found ${auditLogs.length}`);

  const actions = auditLogs.map(l => l.action);
  assert.ok(actions.includes('ORDER_SUBMITTED'));
  assert.ok(actions.includes('STATUS_CHANGE_PENDING_REVIEW_TO_ACCEPTED'));
  assert.ok(actions.includes('PAYMENT_RECORDED_DEPOSIT'));
  assert.ok(actions.includes('STATUS_CHANGE_ACCEPTED_TO_DEPOSIT_RECEIVED'));
  assert.ok(actions.includes('STATUS_CHANGE_DEPOSIT_RECEIVED_TO_IN_PROGRESS'));
  assert.ok(actions.includes('STATUS_CHANGE_IN_PROGRESS_TO_COMPLETED'));
  assert.ok(actions.includes('PAYMENT_RECORDED_REMAINING'));
  assert.ok(actions.includes('STATUS_CHANGE_COMPLETED_TO_FULLY_PAID'));

  // Verify internal staff notes update
  await dbRepository.updateOrderStaffNotes(order.id, 'Client was friendly, traded at Mansion in Third Sea.');
  assert.equal(
    (await dbRepository.getOrderById(order.id))?.staffNotes,
    'Client was friendly, traded at Mansion in Third Sea.'
  );
}
console.log('✓ Complete staff workflow (accept, item verification, deposit payment, in-progress, complete, remaining payment, audit) passed');

console.log('\nALL STAGE 3 TESTS PASSED SUCCESSFULLY!');

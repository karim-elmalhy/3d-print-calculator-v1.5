const test = require('node:test');
const assert = require('node:assert/strict');
const DB = require('../js/core/db.js');
const Orders = require('../js/modules/orders.js');

test('Workflow: order moves through 11 lifecycle stages properly', () => {
  DB.resetToDefaults();
  const order = Orders.createOrder({
    customerName: 'تجربة دورة الحياة',
    items: [{ name: 'قطعة اختبار', weight: 50, hours: 2, quantity: 1 }]
  });

  const expectedStages = [
    'new',
    'quotation',
    'approved',
    'file_prep',
    'print_queue',
    'printing',
    'qc',
    'post_process',
    'packaging',
    'shipping',
    'delivered'
  ];

  // Stage 1: new
  assert.equal(order.stage, 'new');

  // Verify transition across all stages
  for (let i = 1; i < expectedStages.length; i++) {
    const nextStage = expectedStages[i];
    const update = Orders.updateOrderStage(order.id, nextStage);
    assert.equal(update.success, true);
    assert.equal(update.newStage, nextStage);
  }

  const finalOrder = Orders.getOrderById(order.id);
  assert.equal(finalOrder.stage, 'delivered');
  assert.ok(finalOrder.deliveredAt, 'deliveredAt date must be recorded on delivery');
});

test('Workflow: payment recording updates balance correctly', () => {
  DB.resetToDefaults();
  const order = Orders.createOrder({
    customerName: 'عميل دفعات',
    items: [{ unitPrice: 500, quantity: 2, weight: 100, hours: 4 }],
    shippingFee: 50,
    depositPaid: 300
  });

  // Total = 1000 + 50 = 1050, Deposit = 300, Remaining = 750
  assert.equal(order.financials.grandTotal, 1050);
  assert.equal(order.financials.depositPaid, 300);
  assert.equal(order.financials.remainingBalance, 750);

  // Pay remaining 750
  const payRes = Orders.recordPayment(order.id, 750, 'تحويل بنكي');
  assert.equal(payRes.success, true);
  assert.equal(payRes.order.financials.depositPaid, 1050);
  assert.equal(payRes.order.financials.remainingBalance, 0);
});

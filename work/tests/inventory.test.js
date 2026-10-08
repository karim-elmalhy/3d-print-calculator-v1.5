const test = require('node:test');
const assert = require('node:assert/strict');
const DB = require('../js/core/db.js');
const Inventory = require('../js/modules/inventory.js');
const Orders = require('../js/modules/orders.js');

test('Inventory: saving quotation does NOT deduct stock', () => {
  DB.resetToDefaults();
  const dbBefore = DB.loadDB();
  const plaBefore = dbBefore.inventory.filaments.find(f => f.id === 'fil_pla_blk').remainingWeightG;
  const ledgerCountBefore = dbBefore.stockLedger.length;

  const quote = Orders.createOrder({
    customerName: 'تجربة عرض سعر',
    isQuotation: true,
    items: [
      {
        sku: 'GFT-CUST-KEY',
        filamentId: 'fil_pla_blk',
        partWeightG: 50,
        printHours: 2,
        quantity: 5
      }
    ]
  });

  const dbAfter = DB.loadDB();
  const plaAfter = dbAfter.inventory.filaments.find(f => f.id === 'fil_pla_blk').remainingWeightG;
  const ledgerCountAfter = dbAfter.stockLedger.length;

  assert.equal(quote.stage, 'quotation');
  assert.equal(plaAfter, plaBefore, 'Filament stock must NOT change when quotation is saved');
  assert.equal(ledgerCountAfter, ledgerCountBefore, 'No stock ledger entry should be created for quotation');
});

test('Inventory: moving to "printing" stage deducts stock exactly once (idempotent)', () => {
  DB.resetToDefaults();
  const quote = Orders.createOrder({
    customerName: 'عميل إنتاج',
    isQuotation: true,
    items: [
      {
        sku: 'GFT-CUST-KEY', // requires 2 magnets per item and fil_pla_blk
        filamentId: 'fil_pla_blk',
        partWeightG: 20,
        printHours: 1,
        quantity: 5 // total 100g filament, 10 magnets
      }
    ]
  });

  const dbInitial = DB.loadDB();
  const filInitial = dbInitial.inventory.filaments.find(f => f.id === 'fil_pla_blk').remainingWeightG;
  const magInitial = dbInitial.inventory.hardware.find(h => h.id === 'hw_mag_10x2').currentQty;

  // الانتقال للطباعة -> يخصم المخزون
  const stageRes = Orders.updateOrderStage(quote.id, 'printing');
  assert.equal(stageRes.success, true);
  assert.equal(stageRes.stockResult.success, true);

  const dbAfterPrint = DB.loadDB();
  const filAfterPrint = dbAfterPrint.inventory.filaments.find(f => f.id === 'fil_pla_blk').remainingWeightG;
  const magAfterPrint = dbAfterPrint.inventory.hardware.find(h => h.id === 'hw_mag_10x2').currentQty;

  assert.equal(filAfterPrint, filInitial - 100, '100g filament must be deducted');
  assert.equal(magAfterPrint, magInitial - 10, '10 magnets must be deducted');

  // محاولة إعادة الخصم أو الانتقال لنفس المرحلة مرة أخرى
  const repeatDeduction = Inventory.deductStockForProduction(quote.id);
  assert.equal(repeatDeduction.success, false);
  assert.equal(repeatDeduction.alreadyDeducted, true, 'Must prevent double deduction');

  // التأكد من أن الرصيد لم ينقص مرة ثانية
  const dbAfterRepeat = DB.loadDB();
  const filAfterRepeat = dbAfterRepeat.inventory.filaments.find(f => f.id === 'fil_pla_blk').remainingWeightG;
  assert.equal(filAfterRepeat, filAfterPrint, 'Stock must remain the same after repeated call');
});

test('Inventory: low stock alerts should trigger when below threshold', () => {
  DB.resetToDefaults();
  const alerts = Inventory.getLowStockAlerts();
  // We have fil_petg_gry with 180g remaining and 250g reorder level
  const petgAlert = alerts.find(a => a.id === 'fil_petg_gry');
  assert.ok(petgAlert, 'Should trigger low stock alert for PETG');
  assert.equal(petgAlert.current, 180);
});

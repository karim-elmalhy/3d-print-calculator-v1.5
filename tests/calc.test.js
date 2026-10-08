const test = require('node:test');
const assert = require('node:assert/strict');
const Calc = require('../js/core/calc.js');

test('Calc: should calculate basic direct costs and profit margin correctly', () => {
  const params = {
    partWeight: 100, // 100g
    printHours: 5,   // 5 hours
    quantity: 1,
    spoolPrice: 750, // 750 EGP / 1000g = 0.75 EGP/g -> 75 EGP
    spoolWeight: 1000,
    printerPowerKw: 0.2, // 0.2 kW * 5h * 2.5 EGP/kWh = 2.5 EGP
    electricityRate: 2.5,
    printerPrice: 20000,
    printerLifespanHours: 5000, // 4 EGP/h * 5h = 20 EGP
    consumablesPerHour: 5, // 5 * 5 = 25 EGP
    laborHours: 0.5,
    laborRatePerHour: 60, // 30 EGP
    hardwareCost: 10,
    postProcessCost: 15,
    packagingCost: 12.5,
    setupFee: 0,
    failureRatePercent: 0,
    profitMarginPercent: 40 // Margin from selling price
  };

  const res = Calc.calculateCost(params);

  assert.equal(res.materialCost, 75);
  assert.equal(res.powerCost, 2.5);
  assert.equal(res.depreciationCost, 20);
  assert.equal(res.consumablesCost, 25);
  assert.equal(res.laborCost, 30);
  assert.equal(res.hardwareCost, 10);
  assert.equal(res.postProcessCost, 15);
  assert.equal(res.packagingCost, 12.5);

  const directSubtotal = 75 + 2.5 + 20 + 25 + 30 + 10 + 15 + 12.5; // 190 EGP
  assert.equal(res.totalUnitCost, directSubtotal);

  // Price with 40% margin: 190 / (1 - 0.4) = 190 / 0.6 = 316.67
  assert.equal(res.baseUnitPrice, 316.67);
  assert.equal(res.finalUnitPrice, 316.67);
  assert.equal(res.unitProfit, 126.67);
  assert.equal(res.actualMarginPercent, 40);
});

test('Calc: should apply quantity discounts correctly', () => {
  const tiers = [
    { min: 5, pct: 10 },
    { min: 20, pct: 25 }
  ];

  assert.equal(Calc.quantityDiscountPct(tiers, 1), 0);
  assert.equal(Calc.quantityDiscountPct(tiers, 5), 10);
  assert.equal(Calc.quantityDiscountPct(tiers, 19), 10);
  assert.equal(Calc.quantityDiscountPct(tiers, 25), 25);
});

test('Calc: compareEstimatedVsActual should compute variances correctly', () => {
  const estimated = {
    partWeight: 100,
    printHours: 5,
    quantity: 1
  };
  const actual = {
    partWeight: 110, // +10g (+10%)
    printHours: 6,   // +1h (+20%)
    quantity: 1
  };

  const comp = Calc.compareEstimatedVsActual(estimated, actual);
  assert.equal(comp.variance.weightDiff, 10);
  assert.equal(comp.variance.weightDiffPct, 10);
  assert.equal(comp.variance.timeDiff, 1);
  assert.equal(comp.variance.timeDiffPct, 20);
  assert.ok(comp.variance.costDiff > 0, 'Actual cost should be higher than estimated');
});

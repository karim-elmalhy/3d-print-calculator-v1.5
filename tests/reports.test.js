const test = require('node:test');
const assert = require('node:assert/strict');
const DB = require('../js/core/db.js');
const Dashboard = require('../js/modules/dashboard.js');
const Printer = require('../js/modules/printer.js');

test('Reports: dashboard stats calculate sales, profit and printer efficiency', () => {
  DB.resetToDefaults();
  const stats = Dashboard.getDashboardStats();

  assert.ok(stats.financials.totalSales > 0, 'Total sales should be positive');
  assert.ok(stats.financials.totalProfits > 0, 'Total profits should be positive');
  assert.ok(stats.efficiency.profitPerPrintHour > 0, 'Profit per print hour should be calculated');
  assert.ok(stats.inventory.lowStockAlertsCount > 0, 'Low stock alerts should be detected');
});

test('Printer: hourly operating cost calculates power, depreciation and consumables', () => {
  DB.resetToDefaults();
  const hourly = Printer.calculateHourlyCost();

  assert.equal(hourly.printerName, 'Elegoo Neptune 4 Pro');
  // Power: 0.22 kW * 2.5 EGP = 0.55 EGP
  assert.equal(hourly.powerCostPerHour, 0.55);
  // Depreciation: 22000 / 6000 = 3.67 EGP
  assert.equal(hourly.depreciationPerHour, 3.67);
  // Consumables: 5 EGP
  assert.equal(hourly.consumablesPerHour, 5);
  // Total hourly: 0.55 + 3.67 + 5 = 9.22 EGP
  assert.equal(hourly.totalHourlyCost, 9.22);
});

/**
 * ELMALHY.3D Workshop Manager - Integrated Calculator Module
 * حاسبة تسعير متكاملة ضمن نظام الورشة
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../core/calc.js'), require('../core/db.js'));
  } else {
    root.WorkshopCalculator = factory(root.WorkshopCalc, root.WorkshopDB);
  }
})(typeof self !== 'undefined' ? self : this, function (Calc, DB) {
  'use strict';

  const MATERIALS = [
    { id: 'pla', name: 'PLA', density: 1.24, defaultSpoolPrice: 600 },
    { id: 'pla_plus', name: 'PLA+', density: 1.24, defaultSpoolPrice: 700 },
    { id: 'petg', name: 'PETG', density: 1.27, defaultSpoolPrice: 750 },
    { id: 'abs', name: 'ABS', density: 1.04, defaultSpoolPrice: 650 },
    { id: 'tpu', name: 'TPU 95A', density: 1.21, defaultSpoolPrice: 950 },
    { id: 'asa', name: 'ASA', density: 1.07, defaultSpoolPrice: 900 },
  ];

  function getMaterials() { return MATERIALS; }

  function getSpoolPricesFromInventory() {
    const db = DB.loadDB();
    return (db.inventory?.filaments || []).map(f => ({
      id: f.id,
      name: f.name,
      material: f.material,
      color: f.color,
      spoolPrice: f.spoolPrice,
      spoolWeightG: f.spoolWeightG,
      remainingWeightG: f.remainingWeightG
    }));
  }

  function getDefaultSettings() {
    const db = DB.loadDB();
    const printer = (db.printers || [])[0] || {};
    return {
      printerPowerKw: printer.powerKw || 0.22,
      printerPrice: printer.purchasePrice || 22000,
      printerLifespanHours: printer.lifespanHours || 6000,
      consumablesPerHour: printer.consumablesCostPerHour || 5,
      electricityRate: db.settings?.electricityRate || 2.5,
      defaultMarginPercent: db.settings?.defaultMarginPercent || 40,
      defaultFailureRate: db.settings?.defaultFailureRate || 5,
    };
  }

  function calculate(inputs) {
    const defaults = getDefaultSettings();
    const params = Object.assign({}, defaults, inputs);
    return Calc.calculateCost(params);
  }

  function convertFilamentLength(lengthMm, diameterMm, materialId) {
    const mat = MATERIALS.find(m => m.id === materialId) || MATERIALS[0];
    const radiusMm = (diameterMm || 1.75) / 2;
    const volumeCm3 = Math.PI * Math.pow(radiusMm / 10, 2) * (lengthMm / 10);
    return Math.round(volumeCm3 * mat.density * 100) / 100;
  }

  return { getMaterials, getSpoolPricesFromInventory, getDefaultSettings, calculate, convertFilamentLength };
});

const test = require('node:test');
const assert = require('node:assert/strict');
const Calc = require('../js/core/calc.js');
const CalculatorModule = require('../js/modules/calculator.js');

test('Calc Advanced: sliceVolume decomposes solid into shells and infill correctly', () => {
  const vol = 10000; // 10,000 mm3 = 10 cm3
  const res100 = Calc.sliceVolume(vol, 100, 3);
  assert.equal(res100.slicedNetVolumeMm3, 10000);
  assert.equal(res100.infillVolumeMm3, 0);

  const res20 = Calc.sliceVolume(vol, 20, 3);
  assert.ok(res20.shellVolumeMm3 > 0);
  assert.ok(res20.infillVolumeMm3 > 0);
  assert.ok(res20.slicedNetVolumeMm3 < vol);
});

test('Calc Advanced: calculateSupportWaste returns correct volumes', () => {
  const vol = 10000;
  const none = Calc.calculateSupportWaste(vol, 'none');
  assert.equal(none.supportVolumeMm3, 0);

  const tree = Calc.calculateSupportWaste(vol, 'tree');
  assert.equal(tree.supportVolumeMm3, 1200); // 12%
  assert.equal(tree.supportWastePercent, 12);

  const grid = Calc.calculateSupportWaste(vol, 'normal');
  assert.equal(grid.supportVolumeMm3, 2200); // 22%

  const custom = Calc.calculateSupportWaste(vol, 'custom', 30);
  assert.equal(custom.supportVolumeMm3, 3000); // 30%
});

test('Calc Advanced: calculatePlateNesting optimizes pieces per bed plate', () => {
  const footprint = { x: 50, y: 50 };
  const height = 40;
  const bedSize = { x: 256, y: 256, z: 256 };

  // (256 + 5) / (50 + 5) = 261 / 55 = 4.74 -> 4 pieces per axis -> 4 * 4 = 16 pieces
  const pieces = Calc.calculatePlateNesting(footprint, height, bedSize, false);
  assert.equal(pieces, 16);
});

test('Calc Advanced: parseSTL parses binary STL and computes volume', () => {
  // Create a minimal synthetic binary STL buffer for a single tetrahedron or triangle
  // 80 bytes header + 4 bytes triangle count (1) + 50 bytes triangle data = 134 bytes
  const buf = new ArrayBuffer(134);
  const dv = new DataView(buf);
  dv.setUint32(80, 1, true); // 1 triangle

  // Normal vector: 0, 0, 1
  dv.setFloat32(84, 0, true);
  dv.setFloat32(88, 0, true);
  dv.setFloat32(92, 1, true);

  // V1: 0, 0, 0
  dv.setFloat32(96, 0, true);
  dv.setFloat32(100, 0, true);
  dv.setFloat32(104, 0, true);

  // V2: 20, 0, 0
  dv.setFloat32(108, 20, true);
  dv.setFloat32(112, 0, true);
  dv.setFloat32(116, 0, true);

  // V3: 0, 30, 10
  dv.setFloat32(120, 0, true);
  dv.setFloat32(124, 30, true);
  dv.setFloat32(128, 10, true);

  const res = Calc.parseSTL(buf);
  assert.equal(res.triangleCount, 1);
  assert.equal(res.dimensions.width, 20);
  assert.equal(res.dimensions.depth, 30);
  assert.equal(res.dimensions.height, 10);
  assert.ok(res.surfaceAreaMm2 > 0);
});

test('Calculator Module: calculateIntegrated computes 3D printing economics properly', () => {
  const result = CalculatorModule.calculateIntegrated({
    marketId: 'EG',
    printerProfileId: 'neptune_4_pro',
    materialId: 'pla_plus',
    solidVolumeMm3: 11350, // 3DBenchy volume
    infillPercent: 15,
    wallCount: 3,
    supportType: 'tree',
    quantity: 5,
    targetMarginPercent: 40
  });

  assert.ok(result.geometry.netModelVolumeMm3 > 0);
  assert.ok(result.mass.netModelMassGrams > 0);
  assert.ok(result.mass.supportMassGrams > 0);
  assert.ok(result.nesting.autoPiecesPerPlate >= 1);
  assert.ok(result.costs.suggestedRetailPrice > result.costs.totalManufacturingCost);
  assert.equal(result.costs.targetMarginPercent, 40);
  assert.equal(result.currency.code, 'EGP');
});

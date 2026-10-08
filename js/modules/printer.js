/**
 * ELMALHY.3D Workshop Manager - Printer Settings Module
 * إعدادات الطابعات وتكاليف التشغيل (افتراضياً: Elegoo Neptune 4 Pro)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../core/db.js'),
      require('../core/events.js')
    );
  } else {
    root.WorkshopPrinter = factory(root.WorkshopDB, root.WorkshopEvents);
  }
})(typeof self !== 'undefined' ? self : this, function (DB, Events) {
  'use strict';

  function getPrinters() {
    const db = DB.loadDB();
    return db.printers || [DB.DEFAULT_PRINTER];
  }

  function getPrimaryPrinter() {
    const printers = getPrinters();
    return printers[0] || DB.DEFAULT_PRINTER;
  }

  function updatePrinter(id, updates) {
    const db = DB.loadDB();
    const printer = (db.printers || []).find(p => p.id === id);
    if (!printer) return { success: false, error: 'الطابعة غير موجودة' };

    Object.assign(printer, updates);
    DB.saveDB(db);

    if (Events && Events.emit) {
      Events.emit('printer:updated', printer);
    }

    return { success: true, printer };
  }

  /**
   * حساب تكلفة ساعة تشغيل الماكينة الشاملة (كهرباء + إهلاك + مستهلكات)
   */
  function calculateHourlyCost(printerId = null) {
    const db = DB.loadDB();
    const printer = printerId
      ? (db.printers || []).find(p => p.id === printerId) || getPrimaryPrinter()
      : getPrimaryPrinter();

    const electricityRate = db.settings?.electricityRate || 2.5;
    const powerKw = printer.powerKw || 0.22;
    const powerCostPerHour = powerKw * electricityRate;

    const purchasePrice = printer.purchasePrice || 22000;
    const lifespanHours = Math.max(1, printer.lifespanHours || 6000);
    const depreciationPerHour = purchasePrice / lifespanHours;

    const consumablesPerHour = printer.consumablesCostPerHour || 5.0;

    const totalHourlyCost = powerCostPerHour + depreciationPerHour + consumablesPerHour;

    return {
      printerId: printer.id,
      printerName: printer.name,
      powerCostPerHour: Math.round(powerCostPerHour * 100) / 100,
      depreciationPerHour: Math.round(depreciationPerHour * 100) / 100,
      consumablesPerHour: Math.round(consumablesPerHour * 100) / 100,
      totalHourlyCost: Math.round(totalHourlyCost * 100) / 100
    };
  }

  /**
   * إضافة ساعات تشغيل وتحديث حالة الطابعة
   */
  function logPrintHours(printerId, hours) {
    const db = DB.loadDB();
    const printer = (db.printers || []).find(p => p.id === printerId);
    if (!printer) return;

    printer.totalPrintHoursLogged = (printer.totalPrintHoursLogged || 0) + (Number(hours) || 0);
    DB.saveDB(db);

    if (Events && Events.emit) {
      Events.emit('printer:hours_logged', { printerId, totalHours: printer.totalPrintHoursLogged });
    }
  }

  return {
    getPrinters,
    getPrimaryPrinter,
    updatePrinter,
    calculateHourlyCost,
    logPrintHours
  };
});

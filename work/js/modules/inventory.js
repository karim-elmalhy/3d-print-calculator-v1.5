/**
 * ELMALHY.3D Workshop Manager - Inventory Module
 * إدارة المخزون (فلمنت، إكسسوارات، تغليف، منتجات تامة) وحركات الصرف والإضافة
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../core/db.js'),
      require('../core/events.js')
    );
  } else {
    root.WorkshopInventory = factory(root.WorkshopDB, root.WorkshopEvents);
  }
})(typeof self !== 'undefined' ? self : this, function (DB, Events) {
  'use strict';

  function getInventory() {
    const db = DB.loadDB();
    return db.inventory || {
      filaments: [],
      hardware: [],
      packaging: [],
      finishedGoods: []
    };
  }

  function getLowStockAlerts() {
    const inv = getInventory();
    const alerts = [];

    // 1. الفلمنت
    (inv.filaments || []).forEach(f => {
      if (f.remainingWeightG <= f.reorderLevelG) {
        alerts.push({
          type: 'filament',
          id: f.id,
          name: `${f.brand} - ${f.material} (${f.color})`,
          current: f.remainingWeightG,
          threshold: f.reorderLevelG,
          unit: 'جرام',
          urgency: f.remainingWeightG <= (f.reorderLevelG / 2) ? 'critical' : 'warning'
        });
      }
    });

    // 2. الملحقات والمعدات
    (inv.hardware || []).forEach(h => {
      if (h.currentQty <= h.reorderLevel) {
        alerts.push({
          type: 'hardware',
          id: h.id,
          name: h.name,
          current: h.currentQty,
          threshold: h.reorderLevel,
          unit: h.unit || 'قطعة',
          urgency: h.currentQty <= 0 ? 'critical' : 'warning'
        });
      }
    });

    // 3. مواد التغليف
    (inv.packaging || []).forEach(p => {
      if (p.currentQty <= p.reorderLevel) {
        alerts.push({
          type: 'packaging',
          id: p.id,
          name: p.name,
          current: p.currentQty,
          threshold: p.reorderLevel,
          unit: p.unit || 'قطعة',
          urgency: p.currentQty <= 0 ? 'critical' : 'warning'
        });
      }
    });

    // 4. المنتجات تامة الصنع
    (inv.finishedGoods || []).forEach(g => {
      if (g.currentStockQty <= g.minStockQty) {
        alerts.push({
          type: 'finishedGood',
          id: g.id,
          name: g.name,
          current: g.currentStockQty,
          threshold: g.minStockQty,
          unit: 'قطعة',
          urgency: g.currentStockQty === 0 ? 'critical' : 'warning'
        });
      }
    });

    return alerts;
  }

  /**
   * تسجيل حركة يدوية للمخزون (توريد، هالك، تسوية)
   */
  function recordTransaction(itemType, itemId, changeType, qty, notes = '', referenceJobId = null) {
    const db = DB.loadDB();
    const inv = db.inventory;
    const ledger = db.stockLedger || [];
    let item = null;
    let unit = 'قطعة';

    if (itemType === 'filament') {
      item = (inv.filaments || []).find(x => x.id === itemId);
      unit = 'جرام';
      if (item) {
        item.remainingWeightG = Math.max(0, (item.remainingWeightG || 0) + qty);
      }
    } else if (itemType === 'hardware') {
      item = (inv.hardware || []).find(x => x.id === itemId);
      unit = item?.unit || 'قطعة';
      if (item) {
        item.currentQty = Math.max(0, (item.currentQty || 0) + qty);
      }
    } else if (itemType === 'packaging') {
      item = (inv.packaging || []).find(x => x.id === itemId);
      unit = item?.unit || 'قطعة';
      if (item) {
        item.currentQty = Math.max(0, (item.currentQty || 0) + qty);
      }
    } else if (itemType === 'finishedGood') {
      item = (inv.finishedGoods || []).find(x => x.id === itemId);
      unit = 'قطعة';
      if (item) {
        item.currentStockQty = Math.max(0, (item.currentStockQty || 0) + qty);
      }
    }

    if (!item) {
      return { success: false, error: 'العنصر غير موجود في المخزون' };
    }

    const currentBalance = itemType === 'filament' ? item.remainingWeightG :
      (itemType === 'finishedGood' ? item.currentStockQty : item.currentQty);

    const transaction = {
      id: 'led_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      itemId,
      itemType,
      itemName: item.name,
      changeType, // in, out_production, waste, adjustment
      qty,
      unit,
      balanceAfter: currentBalance,
      referenceJobId,
      notes
    };

    ledger.unshift(transaction);
    db.stockLedger = ledger;
    DB.saveDB(db);

    if (Events && Events.emit) {
      Events.emit('inventory:updated', { itemType, itemId, transaction });
    }

    return { success: true, item, transaction };
  }

  /**
   * خصم الخامات عند بدء الإنتاج الفعلي للطلب
   * يُمنع التكرار نهائياً (Idempotent)
   * @param {string} orderId
   */
  function deductStockForProduction(orderId) {
    const db = DB.loadDB();
    const order = (db.orders || []).find(o => o.id === orderId);

    if (!order) {
      return { success: false, error: 'الطلب غير موجود' };
    }

    // تحقق من الأمان: هل تم الخصم مسبقاً؟
    if (order.productionJob && order.productionJob.stockDeducted) {
      return {
        success: false,
        alreadyDeducted: true,
        message: 'تم خصم خامات ومستلزمات هذا الطلب مسبقاً، لن يتم الخصم مرة أخرى.'
      };
    }

    const jobId = order.productionJob?.jobId || 'job_' + Date.now();
    const deductions = [];

    // 1. تجميع الخامات والمكونات المطلوبة من بنود الطلب
    (order.items || []).forEach(item => {
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      const partWeight = Number(item.partWeightG) || 0;
      const totalFilamentG = partWeight * qty;

      // أ) خصم الفلمنت
      if (totalFilamentG > 0) {
        let fil = (db.inventory.filaments || []).find(f => f.id === item.filamentId);
        // في حال لم يحدد الـ ID مباشرة نحاول المطابقة بالخامة أو أخذ أول بكرة متوفرة
        if (!fil) {
          fil = db.inventory.filaments[0];
        }

        if (fil) {
          fil.remainingWeightG = Math.max(0, (fil.remainingWeightG || 0) - totalFilamentG);
          deductions.push({
            itemId: fil.id,
            itemType: 'filament',
            name: `${fil.brand} - ${fil.material} (${fil.color})`,
            qty: -totalFilamentG,
            unit: 'جرام',
            balanceAfter: fil.remainingWeightG
          });

          db.stockLedger.unshift({
            id: 'led_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
            timestamp: new Date().toISOString(),
            itemId: fil.id,
            itemType: 'filament',
            itemName: fil.name,
            changeType: 'out_production',
            qty: -totalFilamentG,
            unit: 'جرام',
            balanceAfter: fil.remainingWeightG,
            referenceJobId: jobId,
            notes: `صرف خامة لإنتاج طلب ${order.code} (${qty} قطعة)`
          });
        }
      }

      // ب) خصم المستلزمات المرتبطة بالمنتج من الكتالوج إن وجدت
      const catalogProd = (db.products || []).find(p => p.id === item.productId || p.sku === item.sku);
      if (catalogProd) {
        // المستلزمات (مسامير، مغناطيس...)
        (catalogProd.hardwareRequired || []).forEach(hwReq => {
          const totalHwQty = (hwReq.qty || 1) * qty;
          const hw = (db.inventory.hardware || []).find(h => h.id === hwReq.hardwareId);
          if (hw) {
            hw.currentQty = Math.max(0, (hw.currentQty || 0) - totalHwQty);
            deductions.push({
              itemId: hw.id,
              itemType: 'hardware',
              name: hw.name,
              qty: -totalHwQty,
              unit: hw.unit || 'قطعة',
              balanceAfter: hw.currentQty
            });

            db.stockLedger.unshift({
              id: 'led_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              timestamp: new Date().toISOString(),
              itemId: hw.id,
              itemType: 'hardware',
              itemName: hw.name,
              changeType: 'out_production',
              qty: -totalHwQty,
              unit: hw.unit || 'قطعة',
              balanceAfter: hw.currentQty,
              referenceJobId: jobId,
              notes: `صرف مستلزمات (${hw.name}) لطلب ${order.code}`
            });
          }
        });

        // مواد التغليف
        (catalogProd.packagingRequired || []).forEach(pkgReq => {
          const totalPkgQty = (pkgReq.qty || 1) * qty;
          const pkg = (db.inventory.packaging || []).find(p => p.id === pkgReq.packagingId);
          if (pkg) {
            pkg.currentQty = Math.max(0, (pkg.currentQty || 0) - totalPkgQty);
            deductions.push({
              itemId: pkg.id,
              itemType: 'packaging',
              name: pkg.name,
              qty: -totalPkgQty,
              unit: pkg.unit || 'قطعة',
              balanceAfter: pkg.currentQty
            });

            db.stockLedger.unshift({
              id: 'led_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
              timestamp: new Date().toISOString(),
              itemId: pkg.id,
              itemType: 'packaging',
              itemName: pkg.name,
              changeType: 'out_production',
              qty: -totalPkgQty,
              unit: pkg.unit || 'قطعة',
              balanceAfter: pkg.currentQty,
              referenceJobId: jobId,
              notes: `صرف مواد تغليف (${pkg.name}) لطلب ${order.code}`
            });
          }
        });
      }
    });

    // تحديث حالة الطلب ومهمة الإنتاج وتثبيت الخصم لمنع تكراره
    if (!order.productionJob) {
      order.productionJob = {
        jobId,
        printerId: 'printer_neptune_4_pro',
        startedAt: new Date().toISOString(),
        status: 'in_progress',
        estimatedWeightG: (order.items || []).reduce((sum, it) => sum + (it.partWeightG * it.quantity), 0),
        actualWeightG: null,
        estimatedHours: (order.items || []).reduce((sum, it) => sum + (it.printHours * it.quantity), 0),
        actualHours: null,
        estimatedCost: order.financials?.totalCost || 0,
        actualCost: null,
        stockDeducted: true
      };
    } else {
      order.productionJob.stockDeducted = true;
      order.productionJob.startedAt = order.productionJob.startedAt || new Date().toISOString();
    }

    DB.saveDB(db);

    if (Events && Events.emit) {
      Events.emit('inventory:updated', { deductions, orderId });
    }

    return {
      success: true,
      jobId,
      deductions,
      message: `تم خصم ${deductions.length} بند من المخزون بنجاح لبدء إنتاج الطلب ${order.code}.`
    };
  }

  // إضافة بكرة فلمنت جديدة
  function addFilament(data) {
    const db = DB.loadDB();
    const id = 'fil_' + Date.now();
    const newItem = {
      id,
      name: `${data.brand || ''} ${data.material || 'PLA'} ${data.color || ''}`.trim(),
      material: data.material || 'PLA',
      color: data.color || 'أسود',
      brand: data.brand || 'عام',
      spoolPrice: Number(data.spoolPrice) || 750,
      spoolWeightG: Number(data.spoolWeightG) || 1000,
      remainingWeightG: Number(data.remainingWeightG || data.spoolWeightG) || 1000,
      reorderLevelG: Number(data.reorderLevelG) || 200
    };
    db.inventory.filaments.push(newItem);

    // تسجيل حركة توريد
    recordTransaction('filament', id, 'in', newItem.remainingWeightG, 'رصيد أول المدة / شراء بكرة جديدة');
    return newItem;
  }

  // إضافة صنف مستلزمات
  function addHardware(data) {
    const db = DB.loadDB();
    const id = 'hw_' + Date.now();
    const newItem = {
      id,
      name: data.name,
      category: data.category || 'ملحقات',
      currentQty: Number(data.currentQty) || 0,
      unit: data.unit || 'قطعة',
      costPerUnit: Number(data.costPerUnit) || 1,
      reorderLevel: Number(data.reorderLevel) || 10
    };
    db.inventory.hardware.push(newItem);
    if (newItem.currentQty > 0) {
      recordTransaction('hardware', id, 'in', newItem.currentQty, 'رصيد افتتاحي / شراء');
    }
    DB.saveDB(db);
    return newItem;
  }

  // إضافة مادة تغليف
  function addPackaging(data) {
    const db = DB.loadDB();
    const id = 'pkg_' + Date.now();
    const newItem = {
      id,
      name: data.name,
      type: data.type || 'تغليف',
      currentQty: Number(data.currentQty) || 0,
      unit: data.unit || 'قطعة',
      costPerUnit: Number(data.costPerUnit) || 1,
      reorderLevel: Number(data.reorderLevel) || 10
    };
    db.inventory.packaging.push(newItem);
    if (newItem.currentQty > 0) {
      recordTransaction('packaging', id, 'in', newItem.currentQty, 'رصيد افتتاحي / شراء');
    }
    DB.saveDB(db);
    return newItem;
  }

  return {
    getInventory,
    getLowStockAlerts,
    recordTransaction,
    deductStockForProduction,
    addFilament,
    addHardware,
    addPackaging
  };
});

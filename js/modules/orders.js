/**
 * ELMALHY.3D Workshop Manager - Orders & Workflow Module
 * دورة حياة الطلبات (11 مرحلة) وعروض الأسعار وتتبع المراحل
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../core/db.js'),
      require('../core/calc.js'),
      require('../core/events.js'),
      require('./inventory.js')
    );
  } else {
    root.WorkshopOrders = factory(
      root.WorkshopDB,
      root.WorkshopCalc,
      root.WorkshopEvents,
      root.WorkshopInventory
    );
  }
})(typeof self !== 'undefined' ? self : this, function (DB, Calc, Events, Inventory) {
  'use strict';

  function getAllOrders() {
    const db = DB.loadDB();
    return db.orders || [];
  }

  function getOrderById(id) {
    const orders = getAllOrders();
    return orders.find(o => o.id === id);
  }

  /**
   * إنشاء طلب أو عرض سعر جديد
   * حفظ عرض السعر لا يخصم أي خامات من المخزون مطلقاً!
   */
  function createOrder(orderData) {
    const db = DB.loadDB();
    const id = 'ord_' + Date.now();
    const count = (db.orders || []).length + 1;
    const code = orderData.code || ('ELM-' + (2600 + count));

    // حساب التكاليف والأسعار
    const items = (orderData.items || []).map(item => {
      const calcResult = Calc.calculateCost({
        partWeight: item.partWeightG || item.weight,
        printHours: item.printHours || item.hours,
        quantity: item.quantity || 1,
        spoolPrice: item.spoolPrice || 750,
        laborHours: item.laborHours || 0,
        postProcessCost: item.postProcessCost || 0,
        profitMarginPercent: item.marginPercent || db.settings.defaultMarginPercent,
        discountTiers: item.wholesaleTiers || []
      });

      return {
        productId: item.productId || null,
        sku: item.sku || 'CUSTOM',
        name: item.name || 'قطعة طباعة مخصصة',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || calcResult.finalUnitPrice,
        partWeightG: item.partWeightG || item.weight || 0,
        printHours: item.printHours || item.hours || 0,
        filamentId: item.filamentId || null,
        calcDetails: calcResult
      };
    });

    const subtotal = items.reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0);
    const shippingFee = Number(orderData.shippingFee) || 0;
    const discount = Number(orderData.discount) || 0;
    const grandTotal = Math.max(0, subtotal - discount + shippingFee);
    const depositPaid = Number(orderData.depositPaid) || 0;
    const remainingBalance = Math.max(0, grandTotal - depositPaid);
    const totalCost = items.reduce((sum, it) => sum + ((it.calcDetails?.totalUnitCost || 0) * it.quantity), 0);
    const netProfit = grandTotal - totalCost - shippingFee;

    const newOrder = {
      id,
      code,
      customerId: orderData.customerId || null,
      customerName: orderData.customerName || 'عميل نقدي',
      customerPhone: orderData.customerPhone || '',
      stage: orderData.isQuotation ? 'quotation' : (orderData.stage || 'new'),
      createdAt: new Date().toISOString(),
      deadlineDate: orderData.deadlineDate || null,
      notes: orderData.notes || '',
      items,
      financials: {
        subtotal: Calc.round(subtotal),
        discount: Calc.round(discount),
        shippingFee: Calc.round(shippingFee),
        grandTotal: Calc.round(grandTotal),
        depositPaid: Calc.round(depositPaid),
        remainingBalance: Calc.round(remainingBalance),
        totalCost: Calc.round(totalCost),
        netProfit: Calc.round(netProfit)
      },
      productionJob: null // لا يتم إنشاء مهمة ولا خصم مخزون الآن
    };

    db.orders.unshift(newOrder);

    // تحديث بيانات العميل في حال وجوده
    if (newOrder.customerId) {
      const cust = (db.customers || []).find(c => c.id === newOrder.customerId);
      if (cust) {
        cust.ordersCount = (cust.ordersCount || 0) + 1;
        cust.totalSpent = (cust.totalSpent || 0) + newOrder.financials.grandTotal;
      }
    }

    DB.saveDB(db);

    if (Events && Events.emit) {
      Events.emit('order:created', newOrder);
    }

    return newOrder;
  }

  /**
   * تحويل مرحلة الطلب في مسار المراحل الـ 11
   * عند الانتقال لمرحلة "جاري الطباعة (printing)" يتم استدعاء الخصم تلقائياً وبأمان
   */
  function updateOrderStage(orderId, newStage, extraDetails = {}) {
    let db = DB.loadDB();
    let order = (db.orders || []).find(o => o.id === orderId);

    if (!order) {
      return { success: false, error: 'الطلب غير موجود' };
    }

    const previousStage = order.stage;
    order.stage = newStage;

    if (newStage === 'delivered') {
      order.deliveredAt = new Date().toISOString();
    }

    DB.saveDB(db);

    let stockResult = null;
    // الخصم يحدث فقط عند بدء مرحلة الطباعة (printing)
    if (newStage === 'printing') {
      stockResult = Inventory.deductStockForProduction(orderId);
      db = DB.loadDB();
      order = (db.orders || []).find(o => o.id === orderId);
    }

    if (Events && Events.emit) {
      Events.emit('order:stage_changed', { orderId, previousStage, newStage, stockResult });
    }

    return {
      success: true,
      order,
      previousStage,
      newStage,
      stockResult
    };
  }

  /**
   * تسجيل دفعة مالية للطلب (عربون أو سداد متبقي)
   */
  function recordPayment(orderId, amount, paymentMethod = 'كاش / فودافون كاش') {
    const db = DB.loadDB();
    const order = (db.orders || []).find(o => o.id === orderId);
    if (!order) return { success: false, error: 'الطلب غير موجود' };

    const pay = Number(amount) || 0;
    order.financials.depositPaid = Calc.round((order.financials.depositPaid || 0) + pay);
    order.financials.remainingBalance = Math.max(0, Calc.round(order.financials.grandTotal - order.financials.depositPaid));

    if (!order.paymentHistory) order.paymentHistory = [];
    order.paymentHistory.push({
      id: 'pay_' + Date.now(),
      date: new Date().toISOString(),
      amount: pay,
      method: paymentMethod
    });

    DB.saveDB(db);

    if (Events && Events.emit) {
      Events.emit('order:payment_recorded', { orderId, amount: pay });
    }

    return { success: true, order };
  }

  /**
   * تسجيل إتمام مهمة الطباعة وفحص الجودة مع المقارنة بين الفعلي والمقدر
   */
  function completeProductionJob(orderId, jobData) {
    const db = DB.loadDB();
    const order = (db.orders || []).find(o => o.id === orderId);
    if (!order) return { success: false, error: 'الطلب غير موجود' };

    if (!order.productionJob) {
      order.productionJob = { jobId: 'job_' + Date.now() };
    }

    order.productionJob.completedAt = new Date().toISOString();
    order.productionJob.status = jobData.status || 'success'; // success / failed
    order.productionJob.actualWeightG = Number(jobData.actualWeightG) || order.productionJob.estimatedWeightG;
    order.productionJob.actualHours = Number(jobData.actualHours) || order.productionJob.estimatedHours;
    order.productionJob.failureReason = jobData.failureReason || '';
    order.productionJob.notes = jobData.notes || '';

    // حساب التكلفة الفعلية
    const est = {
      partWeight: order.productionJob.estimatedWeightG,
      printHours: order.productionJob.estimatedHours,
      quantity: 1
    };
    const act = {
      partWeight: order.productionJob.actualWeightG,
      printHours: order.productionJob.actualHours,
      quantity: 1
    };

    const comparison = Calc.compareEstimatedVsActual(est, act);
    order.productionJob.actualCost = comparison.actual.totalUnitCost;
    order.productionJob.variance = comparison.variance;

    // في حال نجاح الطباعة، تنتقل تلقائياً لمرحلة فحص الجودة QC
    if (order.productionJob.status === 'success') {
      order.stage = 'qc';
    }

    DB.saveDB(db);

    if (Events && Events.emit) {
      Events.emit('production:completed', { orderId, job: order.productionJob });
    }

    return { success: true, order, comparison };
  }

  return {
    getAllOrders,
    getOrderById,
    createOrder,
    updateOrderStage,
    recordPayment,
    completeProductionJob
  };
});

/**
 * ELMALHY.3D Workshop Manager - Core Calculation Engine
 * يعمل في المتصفح ونظام Node.js للاختبارات
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WorkshopCalc = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const num = (v, d = 0) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : d;
  };
  const pos = (v, d = 0) => Math.max(0, num(v, d));

  function quantityDiscountPct(tiers, qty) {
    if (!Array.isArray(tiers) || tiers.length === 0) return 0;
    return tiers
      .filter(t => qty >= num(t.min, Infinity))
      .reduce((m, t) => Math.max(m, Math.min(90, pos(t.pct))), 0);
  }

  /**
   * حساب التكلفة التقديرية أو الفعلية للقطعة والطلبية
   * @param {Object} p - مدخلات الحساب
   */
  function calculateCost(p = {}) {
    const partWeight = pos(p.partWeight); // بالجرام
    const printHours = pos(p.printHours); // بالساعات
    const qty = Math.max(1, parseInt(p.quantity, 10) || 1);

    // 1. تكلفة الخامة (فلمنت)
    const spoolPrice = pos(p.spoolPrice, 750); // بالجنيه
    const spoolWeight = Math.max(1, num(p.spoolWeight, 1000));
    const materialCost = (partWeight * spoolPrice) / spoolWeight;

    // 2. تكلفة الكهرباء
    const printerPowerKw = pos(p.printerPowerKw, 0.2); // 200W = 0.2 kW
    const electricityRate = pos(p.electricityRate, 2.5); // جنيه لكل كيلوواط/ساعة
    const powerCost = printHours * printerPowerKw * electricityRate;

    // 3. إهلاك الطابعة
    const printerPrice = pos(p.printerPrice, 20000);
    const printerLifespanHours = Math.max(1, num(p.printerLifespanHours, 6000));
    const depreciationPerHour = printerPrice / printerLifespanHours;
    const depreciationCost = depreciationPerHour * printHours;

    // 4. المستهلكات والصيانة لكل ساعة تشغيل (نوزل، سطح طباعة، شحم...)
    const consumablesCost = pos(p.consumablesPerHour, 5) * printHours;

    // 5. العمالة والتشطيب والملحقات (مسامير، مغناطيس، دهانات)
    const laborCost = pos(p.laborHours) * pos(p.laborRatePerHour, 50);
    const hardwareCost = pos(p.hardwareCost); // إكسسوارات (مغناطيس، مسامير...)
    const postProcessCost = pos(p.postProcessCost); // صنفرة / معجون / دهان
    const packagingCost = pos(p.packagingCost); // كرتونة، تغليف، استيكرات

    // 6. رسوم التجهيز مقسمة على كمية الباتش
    const setupFeePerUnit = pos(p.setupFee) / qty;
    const otherCosts = pos(p.otherCosts);

    // تكلفة الإنتاج المباشرة للقطعة
    const directCost = materialCost + powerCost + depreciationCost + consumablesCost +
      laborCost + hardwareCost + postProcessCost + packagingCost + setupFeePerUnit + otherCosts;

    // 7. التسويق والمصروفات العامة
    let marketingCost = 0;
    if (p.includeMarketing) {
      marketingCost = p.marketingType === 'fixed'
        ? pos(p.marketingAmount)
        : directCost * (pos(p.marketingPercent, 5) / 100);
    }

    // 8. معدل الفشل (يطبق على المتغيرات الأساسية: خامة + كهرباء + إهلاك + مستهلكات)
    const failureRatePercent = Math.min(100, pos(p.failureRatePercent, 5));
    const failureBase = materialCost + powerCost + depreciationCost + consumablesCost;
    const failureCost = failureBase * (failureRatePercent / 100);

    // التكلفة الإجمالية للقطعة الواحدة
    const totalUnitCost = directCost + marketingCost + failureCost;

    // 9. التسعير وهامش الربح
    // الهامش محسوب من سعر البيع: SellingPrice = Cost / (1 - Margin%)
    const profitMarginPercent = Math.min(99, pos(p.profitMarginPercent, 40));
    const marginFactor = 1 - (profitMarginPercent / 100);
    let baseUnitPrice = marginFactor > 0 ? (totalUnitCost / marginFactor) : totalUnitCost;

    // خصم الكميات
    const discountPercent = quantityDiscountPct(p.discountTiers, qty);
    let finalUnitPrice = baseUnitPrice * (1 - (discountPercent / 100));

    // الحد الأدنى لسعر الطلب أو القطعة
    const minOrderPrice = pos(p.minOrderPrice, 0);
    if (minOrderPrice > 0 && (finalUnitPrice * qty) < minOrderPrice) {
      finalUnitPrice = minOrderPrice / qty;
    }

    const unitProfit = finalUnitPrice - totalUnitCost;
    const markupPercent = totalUnitCost > 0 ? (unitProfit / totalUnitCost) * 100 : 0;
    const actualMarginPercent = finalUnitPrice > 0 ? (unitProfit / finalUnitPrice) * 100 : 0;

    // إجماليات الطلبية / الباتش
    const batchTotalCost = totalUnitCost * qty;
    const batchTotalPrice = finalUnitPrice * qty;
    const batchTotalProfit = unitProfit * qty;

    // 10. إضافات الطلبية الكلية (تصميم CAD، شحن، ضريبة)
    const cadDesignFee = pos(p.cadDesignHours) * pos(p.cadDesignRatePerHour, 150);
    const shippingFee = pos(p.shippingFee);
    const taxableSubtotal = batchTotalPrice + cadDesignFee;
    const vatPercent = p.includeVat ? Math.min(100, pos(p.vatPercent, 14)) : 0;
    const vatAmount = taxableSubtotal * (vatPercent / 100);
    const grandOrderTotal = taxableSubtotal + vatAmount + shippingFee;

    // الدفعات والعربون
    const depositPaid = pos(p.depositPaid);
    const remainingBalance = Math.max(0, grandOrderTotal - depositPaid);

    // مقاييس كفاءة
    const profitPerHour = printHours > 0 ? (unitProfit / printHours) : 0;
    const totalPrintHours = printHours * qty;
    const batchProfitPerHour = totalPrintHours > 0 ? (batchTotalProfit / totalPrintHours) : 0;

    return {
      quantity: qty,
      partWeight,
      printHours,
      totalPrintHours,
      materialCost: round(materialCost),
      powerCost: round(powerCost),
      depreciationCost: round(depreciationCost),
      consumablesCost: round(consumablesCost),
      laborCost: round(laborCost),
      hardwareCost: round(hardwareCost),
      postProcessCost: round(postProcessCost),
      packagingCost: round(packagingCost),
      setupFeePerUnit: round(setupFeePerUnit),
      marketingCost: round(marketingCost),
      failureCost: round(failureCost),
      totalUnitCost: round(totalUnitCost),
      baseUnitPrice: round(baseUnitPrice),
      discountPercent: round(discountPercent),
      finalUnitPrice: round(finalUnitPrice),
      unitProfit: round(unitProfit),
      markupPercent: round(markupPercent, 1),
      actualMarginPercent: round(actualMarginPercent, 1),
      batchTotalCost: round(batchTotalCost),
      batchTotalPrice: round(batchTotalPrice),
      batchTotalProfit: round(batchTotalProfit),
      cadDesignFee: round(cadDesignFee),
      shippingFee: round(shippingFee),
      vatAmount: round(vatAmount),
      grandOrderTotal: round(grandOrderTotal),
      depositPaid: round(depositPaid),
      remainingBalance: round(remainingBalance),
      profitPerHour: round(profitPerHour),
      batchProfitPerHour: round(batchProfitPerHour)
    };
  }

  /**
   * مقارنة التكلفة والزمن التقديري مقابل الفعلي
   */
  function compareEstimatedVsActual(estimated, actual) {
    const est = calculateCost(estimated);
    const act = calculateCost(actual);

    const weightDiff = act.partWeight - est.partWeight;
    const timeDiff = act.printHours - est.printHours;
    const costDiff = act.totalUnitCost - est.totalUnitCost;
    const profitDiff = act.unitProfit - est.unitProfit;

    return {
      estimated: est,
      actual: act,
      variance: {
        weightDiff: round(weightDiff, 1),
        weightDiffPct: est.partWeight > 0 ? round((weightDiff / est.partWeight) * 100, 1) : 0,
        timeDiff: round(timeDiff, 2),
        timeDiffPct: est.printHours > 0 ? round((timeDiff / est.printHours) * 100, 1) : 0,
        costDiff: round(costDiff),
        costDiffPct: est.totalUnitCost > 0 ? round((costDiff / est.totalUnitCost) * 100, 1) : 0,
        profitDiff: round(profitDiff),
        profitDiffPct: est.unitProfit > 0 ? round((profitDiff / est.unitProfit) * 100, 1) : 0
      }
    };
  }

  function round(val, dec = 2) {
    const factor = Math.pow(10, dec);
    return Math.round((num(val) + Number.EPSILON) * factor) / factor;
  }

  return {
    calculateCost,
    compareEstimatedVsActual,
    quantityDiscountPct,
    round
  };
});

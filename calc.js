// دالة حساب نقية (بدون DOM) — تُستخدم في app.js وفي الاختبارات
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CalcEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
  const pos = (v, d = 0) => Math.max(0, num(v, d));

  // خصم الكمية: tiers = [{min:10, pct:5}, {min:50, pct:12}]
  function quantityDiscountPct(tiers, qty) {
    if (!Array.isArray(tiers)) return 0;
    return tiers.filter(t => qty >= num(t.min, Infinity))
      .reduce((m, t) => Math.max(m, Math.min(90, pos(t.pct))), 0);
  }

  function calculateCost(s, opts = {}) {
    let partWeight = pos(s.partWeight);
    let printHours = pos(s.printHours);
    if (s.multiPartMode && Array.isArray(s.partsList) && s.partsList.length) {
      partWeight = s.partsList.reduce((a, p) => a + num(p.weight), 0);
      printHours = s.partsList.reduce((a, p) => a + num(p.hours), 0);
    }
    const qty = Math.max(1, parseInt(s.batchQuantity) || 1);

    const spoolPrice = pos(s.spoolPrice);
    const spoolWeight = Math.max(1, num(s.spoolWeight, 1000) || 1000);
    const materialCost = (partWeight * spoolPrice) / spoolWeight;

    const printerPowerKw = pos(s.printerPowerKw);
    const electricityRate = pos(s.electricityRate);
    const powerCost = printHours * printerPowerKw * electricityRate;

    const printerPrice = pos(s.printerPrice);
    const printerLifespanHours = Math.max(1, num(s.printerLifespanHours, 5000) || 5000);
    const depreciationPerHour = printerPrice / printerLifespanHours;
    const depreciationCost = depreciationPerHour * printHours;

    // مستهلكات (نوزل، بيلد بليت، تشحيم...) لكل ساعة طباعة
    const consumablesCost = pos(s.consumablesPerHour) * printHours;

    const laborCost = pos(s.laborHours) * pos(s.laborRatePerHour);
    const postProcessCost = pos(s.postProcessCost);          // صنفرة/دهان/تجميع
    const setupFeePerUnit = pos(s.setupFee) / qty;            // تحضير الطلب موزع على الكمية
    const additionalCost = pos(s.additionalCost);

    const directSubtotal = materialCost + powerCost + depreciationCost + consumablesCost +
      laborCost + postProcessCost + setupFeePerUnit + additionalCost;

    let marketingCost = 0;
    if (s.includeMarketingCost) {
      marketingCost = s.marketingType === 'fixed'
        ? pos(s.marketingFixedAmount)
        : directSubtotal * (pos(s.marketingPercent) / 100);
    }
    const subtotal = directSubtotal + marketingCost;

    // الفشل يؤثر على التكاليف المتغيرة فقط (خامة + كهرباء + إهلاك + مستهلكات)
    const failureRatePercent = Math.min(100, pos(s.failureRatePercent));
    const failureBase = materialCost + powerCost + depreciationCost + consumablesCost;
    const failureCost = failureBase * (failureRatePercent / 100);
    const totalCost = subtotal + failureCost;

    // الهامش من سعر البيع (margin) وليس markup
    const profitMarginPercent = Math.min(99, pos(s.profitMarginPercent));
    const marginFactor = 1 - profitMarginPercent / 100;
    let rawPrice = marginFactor > 0 ? totalCost / marginFactor : totalCost;

    const discountPct = quantityDiscountPct(s.discountTiers, qty);
    let finalSellingPrice = rawPrice * (1 - discountPct / 100);

    // حد أدنى لسعر القطعة
    const minOrderPrice = pos(s.minOrderPrice);
    const minPriceApplied = totalCost > 0 && finalSellingPrice * qty < minOrderPrice;
    if (minPriceApplied) finalSellingPrice = minOrderPrice / qty;

    const profitAmount = finalSellingPrice - totalCost;
    const markupPercent = totalCost > 0 ? (profitAmount / totalCost) * 100 : 0;
    const realMarginPercent = finalSellingPrice > 0 ? (profitAmount / finalSellingPrice) * 100 : 0;

    const costPerGram = partWeight > 0 ? totalCost / partWeight : 0;
    const costPerHour = printHours > 0 ? (powerCost + depreciationCost) / printHours : 0;

    const batchTotalCost = totalCost * qty;
    const batchTotalPrice = finalSellingPrice * qty;
    const batchTotalProfit = profitAmount * qty;

    const cadFee = pos(s.cadDesignHours) * pos(s.cadDesignRatePerHour);
    const shippingFee = pos(s.shippingCost);
    const includeVAT = Boolean(s.includeVAT);
    const vatPercent = Math.min(100, pos(s.vatPercent));
    const taxableSubtotal = batchTotalPrice + cadFee;
    const vatAmount = includeVAT ? taxableSubtotal * (vatPercent / 100) : 0;
    const grandOrderTotal = taxableSubtotal + vatAmount + shippingFee;
    const deposit = pos(s.depositPaid);
    const remainingBalance = Math.max(0, grandOrderTotal - deposit);

    return {
      partWeight, spoolPrice, spoolWeight, materialCost,
      printHours, printerPowerKw, electricityRate, powerCost,
      printerPrice, printerLifespanHours, depreciationPerHour, depreciationCost,
      consumablesCost, postProcessCost, setupFeePerUnit,
      laborHours: pos(s.laborHours), laborRatePerHour: pos(s.laborRatePerHour), laborCost,
      additionalCost, directSubtotal, marketingCost, subtotal, failureRatePercent, failureCost, totalCost,
      profitMarginPercent, discountPct, minPriceApplied, finalSellingPrice, profitAmount, markupPercent, realMarginPercent,
      costPerGram, costPerHour, qty, batchTotalCost, batchTotalPrice, batchTotalProfit,
      includeVAT, vatPercent, vatAmount, cadFee, shippingFee, grandOrderTotal, deposit, remainingBalance
    };
  }
  return { calculateCost, quantityDiscountPct };
});

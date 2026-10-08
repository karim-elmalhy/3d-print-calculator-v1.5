// تقارير مالية نقية (بدون DOM) — مغطاة باختبارات
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Reports = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const n = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
  const tsOf = p => n(p.createdAt) || n(String(p.id || '').replace('proj_', ''));
  const monthKey = ts => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); };

  // مصروفات ثابتة شهرية → تكلفة/ساعة طباعة
  function overheadPerHour(expenses, monthlyPrintHours) {
    const total = (expenses || []).reduce((a, e) => a + Math.max(0, n(e.monthly)), 0);
    const hrs = Math.max(1, n(monthlyPrintHours) || 1);
    return { monthlyTotal: total, perHour: total / hrs };
  }

  // تقرير آخر `months` شهور
  function monthlyReport(projects, expenses, months = 6, now = Date.now()) {
    const fixed = (expenses || []).reduce((a, e) => a + Math.max(0, n(e.monthly)), 0);
    const keys = [];
    const d = new Date(now);
    for (let i = months - 1; i >= 0; i--) keys.push(monthKey(new Date(d.getFullYear(), d.getMonth() - i, 1)));
    const rows = Object.fromEntries(keys.map(k => [k, { month: k, revenue: 0, variableCost: 0, profit: 0, jobs: 0, hours: 0, grams: 0 }]));
    (projects || []).forEach(p => {
      const r = rows[monthKey(tsOf(p))]; if (!r) return;
      const qty = Math.max(1, n(p.state && p.state.batchQuantity) || 1);
      r.revenue += n(p.sellingPrice) * qty; r.variableCost += n(p.totalCost) * qty;
      r.profit += n(p.profit) * qty; r.jobs += 1; r.hours += n(p.hours); r.grams += n(p.weight) * qty;
    });
    const list = keys.map(k => ({ ...rows[k], fixedExpenses: fixed, net: rows[k].profit - fixed }));
    const tot = list.reduce((a, r) => ({ jobs: a.jobs + r.jobs, profit: a.profit + r.profit }), { jobs: 0, profit: 0 });
    const avgProfitPerJob = tot.jobs ? tot.profit / tot.jobs : 0;
    return { months: list, avgProfitPerJob, breakEvenJobs: avgProfitPerJob > 0 ? Math.ceil(fixed / avgProfitPerJob) : null, fixedMonthly: fixed };
  }

  function topClients(projects, limit = 5) {
    const m = {};
    (projects || []).forEach(p => { const c = p.client || 'عميل عام'; (m[c] = m[c] || { name: c, jobs: 0, profit: 0, revenue: 0 });
      m[c].jobs++; m[c].profit += n(p.profit); m[c].revenue += n(p.sellingPrice); });
    return Object.values(m).sort((a, b) => b.profit - a.profit).slice(0, limit);
  }

  function materialUsage(projects, filamentName = p => (p.state && p.state.selectedFilamentPreset) || 'غير محدد') {
    const m = {};
    (projects || []).forEach(p => { const k = filamentName(p); m[k] = (m[k] || 0) + n(p.weight) * Math.max(1, n(p.state && p.state.batchQuantity) || 1); });
    return Object.entries(m).map(([name, grams]) => ({ name, grams })).sort((a, b) => b.grams - a.grams);
  }
  return { overheadPerHour, monthlyReport, topClients, materialUsage };
});

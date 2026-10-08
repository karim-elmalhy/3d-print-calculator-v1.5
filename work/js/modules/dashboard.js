/**
 * ELMALHY.3D Workshop Manager - Dashboard & Executive KPI Module
 * لوحة التحكم الإدارية: المبيعات، الأرباح، ساعات التشغيل، كفاءة الطابعات، وتنبيهات المخزون
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../core/db.js'),
      require('./inventory.js'),
      require('./printer.js')
    );
  } else {
    root.WorkshopDashboard = factory(
      root.WorkshopDB,
      root.WorkshopInventory,
      root.WorkshopPrinter
    );
  }
})(typeof self !== 'undefined' ? self : this, function (DB, Inventory, Printer) {
  'use strict';

  function getDashboardStats() {
    const db = DB.loadDB();
    const orders = db.orders || [];
    const products = db.products || [];

    // 1. المبيعات، الأرباح، التكاليف
    let totalSales = 0;
    let totalCosts = 0;
    let totalProfits = 0;
    let totalDeposits = 0;
    let totalRemaining = 0;

    // استثناء العروض غير المؤكدة أو الملغاة من المبيعات المحققة
    const confirmedOrders = orders.filter(o => o.stage !== 'quotation' && o.stage !== 'cancelled');

    confirmedOrders.forEach(o => {
      const fin = o.financials || {};
      totalSales += Number(fin.grandTotal) || 0;
      totalCosts += Number(fin.totalCost) || 0;
      totalProfits += Number(fin.netProfit) || 0;
      totalDeposits += Number(fin.depositPaid) || 0;
      totalRemaining += Number(fin.remainingBalance) || 0;
    });

    // 2. حالة الطلبات
    const newOrdersCount = orders.filter(o => o.stage === 'new').length;
    const quotationsCount = orders.filter(o => o.stage === 'quotation').length;
    const activeProductionCount = orders.filter(o =>
      ['file_prep', 'print_queue', 'printing', 'qc', 'post_process', 'packaging'].includes(o.stage)
    ).length;

    // الطلبات المتأخرة
    const now = new Date();
    const delayedOrders = orders.filter(o => {
      if (['delivered', 'cancelled', 'quotation'].includes(o.stage)) return false;
      if (!o.deadlineDate) return false;
      return new Date(o.deadlineDate) < now;
    });

    // 3. المنتجات الأكثر مبيعاً وربحية
    const productStats = {};
    confirmedOrders.forEach(o => {
      (o.items || []).forEach(item => {
        const key = item.productId || item.name;
        if (!productStats[key]) {
          productStats[key] = {
            id: item.productId,
            name: item.name,
            sku: item.sku,
            soldQty: 0,
            revenue: 0,
            profit: 0
          };
        }
        const qty = Number(item.quantity) || 1;
        const rev = (Number(item.unitPrice) || 0) * qty;
        const cost = (Number(item.calcDetails?.totalUnitCost) || 0) * qty;
        productStats[key].soldQty += qty;
        productStats[key].revenue += rev;
        productStats[key].profit += (rev - cost);
      });
    });

    const topSellingProducts = Object.values(productStats)
      .sort((a, b) => b.soldQty - a.soldQty)
      .slice(0, 5);

    const mostProfitableProducts = Object.values(productStats)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 5);

    // 4. مقاييس كفاءة الطابعة وساعات التشغيل
    let totalPrintHours = 0;
    let totalJobs = 0;
    let failedJobs = 0;

    orders.forEach(o => {
      if (o.productionJob) {
        totalJobs++;
        if (o.productionJob.status === 'failed') failedJobs++;
        const hours = Number(o.productionJob.actualHours) || Number(o.productionJob.estimatedHours) || 0;
        totalPrintHours += hours;
      }
    });

    const failureRate = totalJobs > 0 ? (failedJobs / totalJobs) * 100 : 0;
    const profitPerPrintHour = totalPrintHours > 0 ? (totalProfits / totalPrintHours) : 0;

    // استغلال وقت التشغيل (معدل تشغيل الطابعة خلال آخر 30 يوم مفترضين 24 ساعة/يوم = 720 ساعة)
    const monthlyCapacityHours = 720;
    const printerUtilizationRate = Math.min(100, (totalPrintHours / monthlyCapacityHours) * 100);

    // 5. تنبيهات انخفاض المخزون
    const lowStockAlerts = Inventory.getLowStockAlerts();

    // 6. تكلفة تشغيل ساعة الطابعة الحالية
    const hourlyPrinterCost = Printer.calculateHourlyCost();

    return {
      financials: {
        totalSales: Math.round(totalSales),
        totalCosts: Math.round(totalCosts),
        totalProfits: Math.round(totalProfits),
        totalDeposits: Math.round(totalDeposits),
        totalRemaining: Math.round(totalRemaining),
        marginPercent: totalSales > 0 ? Math.round((totalProfits / totalSales) * 1000) / 10 : 0
      },
      orders: {
        total: orders.length,
        new: newOrdersCount,
        quotations: quotationsCount,
        inProduction: activeProductionCount,
        delayed: delayedOrders.length,
        delayedList: delayedOrders
      },
      products: {
        topSelling: topSellingProducts,
        mostProfitable: mostProfitableProducts
      },
      efficiency: {
        totalPrintHours: Math.round(totalPrintHours * 10) / 10,
        profitPerPrintHour: Math.round(profitPerPrintHour * 10) / 10,
        failureRate: Math.round(failureRate * 10) / 10,
        totalJobs,
        failedJobs,
        utilizationRate: Math.round(printerUtilizationRate * 10) / 10,
        hourlyPrinterCost
      },
      inventory: {
        lowStockAlertsCount: lowStockAlerts.length,
        alerts: lowStockAlerts
      }
    };
  }

  return {
    getDashboardStats
  };
});

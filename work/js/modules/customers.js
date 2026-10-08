/**
 * ELMALHY.3D Workshop Manager - Customers Module
 * إدارة بيانات العملاء، سجل طلباتهم، ومتابعة الحسابات والمديونيات
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../core/db.js'),
      require('../core/events.js')
    );
  } else {
    root.WorkshopCustomers = factory(root.WorkshopDB, root.WorkshopEvents);
  }
})(typeof self !== 'undefined' ? self : this, function (DB, Events) {
  'use strict';

  function getCustomers() {
    const db = DB.loadDB();
    return db.customers || [];
  }

  function getCustomerById(id) {
    return getCustomers().find(c => c.id === id);
  }

  function addCustomer(data) {
    const db = DB.loadDB();
    const id = 'cust_' + Date.now();

    const newCust = {
      id,
      name: data.name,
      phone: data.phone || '',
      address: data.address || '',
      notes: data.notes || '',
      createdAt: new Date().toISOString(),
      totalSpent: 0,
      ordersCount: 0
    };

    db.customers.push(newCust);
    DB.saveDB(db);

    if (Events && Events.emit) {
      Events.emit('customer:added', newCust);
    }

    return newCust;
  }

  function updateCustomer(id, updates) {
    const db = DB.loadDB();
    const cust = (db.customers || []).find(c => c.id === id);
    if (!cust) return { success: false, error: 'العميل غير موجود' };

    Object.assign(cust, updates);
    DB.saveDB(db);

    if (Events && Events.emit) {
      Events.emit('customer:updated', cust);
    }

    return { success: true, customer: cust };
  }

  function getCustomerHistory(customerId) {
    const db = DB.loadDB();
    const orders = (db.orders || []).filter(o => o.customerId === customerId);

    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, o) => sum + (o.financials?.grandTotal || 0), 0);
    const totalRemaining = orders.reduce((sum, o) => sum + (o.financials?.remainingBalance || 0), 0);

    return {
      customerId,
      totalOrders,
      totalSpent,
      totalRemaining,
      orders
    };
  }

  return {
    getCustomers,
    getCustomerById,
    addCustomer,
    updateCustomer,
    getCustomerHistory
  };
});

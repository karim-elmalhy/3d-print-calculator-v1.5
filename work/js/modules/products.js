/**
 * ELMALHY.3D Workshop Manager - Products Catalog Module
 * إدارة كتالوج المنتجات، توليد أكواد SKU، وتفاصيل الإنتاج والتسعير
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(
      require('../core/db.js'),
      require('../core/events.js')
    );
  } else {
    root.WorkshopProducts = factory(root.WorkshopDB, root.WorkshopEvents);
  }
})(typeof self !== 'undefined' ? self : this, function (DB, Events) {
  'use strict';

  function getProducts() {
    const db = DB.loadDB();
    return db.products || [];
  }

  function getProductById(id) {
    return getProducts().find(p => p.id === id);
  }

  function generateSku(category, name) {
    const prefixMap = {
      'ديكور': 'DEC',
      'هدايا': 'GFT',
      'تنظيم': 'ORG',
      'قطع هندسية': 'ENG',
      'إكسسوارات': 'ACC'
    };
    const prefix = Object.keys(prefixMap).find(k => category.includes(k))
      ? prefixMap[Object.keys(prefixMap).find(k => category.includes(k))]
      : 'PRD';

    const cleanName = (name || 'ITEM')
      .replace(/[^\w\u0621-\u064A]/gi, '')
      .substring(0, 4)
      .toUpperCase();

    const random = Math.floor(100 + Math.random() * 900);
    return `${prefix}-${cleanName || 'PROD'}-${random}`;
  }

  function addProduct(data) {
    const db = DB.loadDB();
    const id = 'prod_' + Date.now();
    const sku = (data.sku && data.sku.trim()) || generateSku(data.category || '', data.name || '');

    const newProduct = {
      id,
      sku,
      name: data.name,
      category: data.category || 'عام',
      description: data.description || '',
      basePrice: Number(data.basePrice) || 0,
      defaultWeightG: Number(data.defaultWeightG) || 50,
      defaultPrintHours: Number(data.defaultPrintHours) || 2,
      filamentMaterial: data.filamentMaterial || 'PLA',
      filamentColor: data.filamentColor || 'أسود',
      hardwareRequired: Array.isArray(data.hardwareRequired) ? data.hardwareRequired : [],
      packagingRequired: Array.isArray(data.packagingRequired) ? data.packagingRequired : [],
      wholesaleTiers: Array.isArray(data.wholesaleTiers) ? data.wholesaleTiers : [
        { min: 5, pct: 10 },
        { min: 20, pct: 20 }
      ]
    };

    db.products.push(newProduct);
    DB.saveDB(db);

    if (Events && Events.emit) {
      Events.emit('product:added', newProduct);
    }

    return newProduct;
  }

  function updateProduct(id, updates) {
    const db = DB.loadDB();
    const prod = (db.products || []).find(p => p.id === id);
    if (!prod) return { success: false, error: 'المنتج غير موجود' };

    Object.assign(prod, updates);
    DB.saveDB(db);

    if (Events && Events.emit) {
      Events.emit('product:updated', prod);
    }

    return { success: true, product: prod };
  }

  function deleteProduct(id) {
    const db = DB.loadDB();
    db.products = (db.products || []).filter(p => p.id !== id);
    DB.saveDB(db);

    if (Events && Events.emit) {
      Events.emit('product:deleted', id);
    }

    return { success: true };
  }

  return {
    getProducts,
    getProductById,
    generateSku,
    addProduct,
    updateProduct,
    deleteProduct
  };
});

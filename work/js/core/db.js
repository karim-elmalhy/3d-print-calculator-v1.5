/**
 * ELMALHY.3D Workshop Manager - Database & Persistence Layer
 * تدعم التخزين المحلي، التصدير والاستيراد، والبيانات الأولية الجاهزة
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.WorkshopDB = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'ELMALHY_3D_WORKSHOP_DB_V1';

  // الـ 11 مرحلة المعتمدة لدورة حياة الطلب
  const ORDER_STAGES = [
    { id: 'new', name: 'طلب جديد', color: '#3b82f6', icon: '📝', step: 1 },
    { id: 'quotation', name: 'عرض سعر', color: '#6366f1', icon: '📑', step: 2 },
    { id: 'approved', name: 'موافقة العميل', color: '#10b981', icon: '✅', step: 3 },
    { id: 'file_prep', name: 'تجهيز الملف (Slicing)', color: '#06b6d4', icon: '💻', step: 4 },
    { id: 'print_queue', name: 'انتظار الطباعة', color: '#8b5cf6', icon: '⏳', step: 5 },
    { id: 'printing', name: 'جاري الطباعة', color: '#f59e0b', icon: '🖨️', step: 6 }, // Trigger الخصم
    { id: 'qc', name: 'فحص الجودة (QC)', color: '#ec4899', icon: '🔍', step: 7 },
    { id: 'post_process', name: 'التشطيب والتجميع', color: '#14b8a6', icon: '✨', step: 8 },
    { id: 'packaging', name: 'التغليف', color: '#d97706', icon: '📦', step: 9 },
    { id: 'shipping', name: 'الشحن والتسليم لشركة الشحن', color: '#2563eb', icon: '🚚', step: 10 },
    { id: 'delivered', name: 'تم التسليم والتحصيل', color: '#059669', icon: '🏁', step: 11 }
  ];

  const DEFAULT_PRINTER = {
    id: 'printer_neptune_4_pro',
    name: 'Elegoo Neptune 4 Pro',
    brand: 'Elegoo',
    powerKw: 0.22, // 220W متوسط
    purchasePrice: 22000,
    lifespanHours: 6000,
    consumablesCostPerHour: 5.0, // نوزل، شحم، بيلد بليت
    totalPrintHoursLogged: 120,
    status: 'idle', // idle, printing, maintenance
    notes: 'طابعة الورشة الأساسية - Klipper مدمج'
  };

  const DEFAULT_SETTINGS = {
    workshopName: 'ELMALHY.3D Workshop',
    owner: 'Karim Elmalhy',
    currency: 'ج.م',
    electricityRate: 2.5, // جنيه لكل kWh
    defaultLaborRate: 50, // جنيه في الساعة
    defaultMarginPercent: 40,
    defaultFailureRate: 5,
    vatPercent: 14,
    minOrderPrice: 100
  };

  const DEFAULT_SEED_DATA = {
    settings: DEFAULT_SETTINGS,
    printers: [DEFAULT_PRINTER],
    products: [
      {
        id: 'prod_1',
        sku: 'DEC-MOON-15',
        name: 'مصباح القمر المضيء 15cm',
        category: 'ديكور وإضاءة',
        description: 'مصباح قمر ثلاثي الأبعاد مع قاعدة خشبية وإضاءة LED',
        basePrice: 450,
        defaultWeightG: 180,
        defaultPrintHours: 14,
        filamentMaterial: 'PLA+',
        filamentColor: 'أبيض لؤلؤي',
        hardwareRequired: [
          { hardwareId: 'hw_led_unit', qty: 1, name: 'وحدة إضاءة LED مدمجة' }
        ],
        packagingRequired: [
          { packagingId: 'pkg_box_m', qty: 1, name: 'كرتونة مقاس M' },
          { packagingId: 'pkg_bubble', qty: 1.5, name: 'بابل راب 1.5 متر' }
        ],
        wholesaleTiers: [
          { min: 5, pct: 10 },
          { min: 20, pct: 20 }
        ]
      },
      {
        id: 'prod_2',
        sku: 'GFT-CUST-KEY',
        name: 'ميدالية اسم مخصصة مع مغناطيس',
        category: 'هدايا وتذكارات',
        description: 'ميدالية اسم منقوشة بالطلب مع فتحة لمغناطيس نيوديميوم قوي',
        basePrice: 65,
        defaultWeightG: 22,
        defaultPrintHours: 1.2,
        filamentMaterial: 'PLA',
        filamentColor: 'أسود مطفي',
        hardwareRequired: [
          { hardwareId: 'hw_mag_10x2', qty: 2, name: 'مغناطيس نيوديميوم 10x2mm' }
        ],
        packagingRequired: [
          { packagingId: 'pkg_poly_bag', qty: 1, name: 'كيس حماية شفاف صغير' }
        ],
        wholesaleTiers: [
          { min: 10, pct: 15 },
          { min: 50, pct: 30 }
        ]
      },
      {
        id: 'prod_3',
        sku: 'ORG-DESK-STAND',
        name: 'حامل مكتبي متعدد للأجهزة',
        category: 'تنظيم واكسسوارات',
        description: 'ستاند للهاتف والتابلت مع مكان لشاحن ساعة وسماعة',
        basePrice: 220,
        defaultWeightG: 110,
        defaultPrintHours: 6.5,
        filamentMaterial: 'PETG',
        filamentColor: 'رمادي فضي',
        hardwareRequired: [
          { hardwareId: 'hw_rubber_feet', qty: 4, name: 'أرجل مطاطية مانعة للانزلاق' }
        ],
        packagingRequired: [
          { packagingId: 'pkg_box_s', qty: 1, name: 'كرتونة مقاس S' }
        ],
        wholesaleTiers: [
          { min: 10, pct: 12 }
        ]
      }
    ],
    customers: [
      {
        id: 'cust_1',
        name: 'م. أحمد خالد',
        phone: '01012345678',
        address: 'مدينة نصر، القاهرة',
        notes: 'عميل دائم - يفضل خامة PETG',
        createdAt: '2026-09-01T10:00:00Z',
        totalSpent: 1850,
        ordersCount: 4
      },
      {
        id: 'cust_2',
        name: 'أ/ سارة محمود',
        phone: '01198765432',
        address: 'الدقي، الجيزة',
        notes: 'طلبات هدايا ومناسبات',
        createdAt: '2026-09-15T12:30:00Z',
        totalSpent: 900,
        ordersCount: 2
      }
    ],
    inventory: {
      filaments: [
        {
          id: 'fil_pla_blk',
          name: 'eSUN PLA+ Black',
          material: 'PLA+',
          color: 'أسود',
          brand: 'eSUN',
          spoolPrice: 750,
          spoolWeightG: 1000,
          remainingWeightG: 820,
          reorderLevelG: 250
        },
        {
          id: 'fil_pla_wht',
          name: 'Sunlu PLA White',
          material: 'PLA',
          color: 'أبيض',
          brand: 'Sunlu',
          spoolPrice: 700,
          spoolWeightG: 1000,
          remainingWeightG: 340,
          reorderLevelG: 250
        },
        {
          id: 'fil_petg_gry',
          name: 'Kingroon PETG Silver Grey',
          material: 'PETG',
          color: 'رمادي فضي',
          brand: 'Kingroon',
          spoolPrice: 720,
          spoolWeightG: 1000,
          remainingWeightG: 180, // تنبيه انخفاض المخزون
          reorderLevelG: 250
        },
        {
          id: 'fil_tpu_red',
          name: 'Creality TPU 95A Red',
          material: 'TPU',
          color: 'أحمر مرن',
          brand: 'Creality',
          spoolPrice: 950,
          spoolWeightG: 1000,
          remainingWeightG: 650,
          reorderLevelG: 200
        }
      ],
      hardware: [
        {
          id: 'hw_mag_10x2',
          name: 'مغناطيس نيوديميوم 10x2 مم',
          category: 'مغناطيس',
          currentQty: 140,
          unit: 'قطعة',
          costPerUnit: 4.5,
          reorderLevel: 30
        },
        {
          id: 'hw_m3_screws',
          name: 'طقم مسامير M3 x 12 مم + صواميل',
          category: 'مسامير وصواميل',
          currentQty: 250,
          unit: 'قطعة',
          costPerUnit: 1.2,
          reorderLevel: 50
        },
        {
          id: 'hw_glue_ca',
          name: 'سوبر جلو سريع الجفاف (أمير)',
          category: 'لواصق',
          currentQty: 8,
          unit: 'أنبوبة',
          costPerUnit: 15,
          reorderLevel: 3
        },
        {
          id: 'hw_paint_spray',
          name: 'سبراي برايمر ودهان رمادي مطفي',
          category: 'دهانات ومعجون',
          currentQty: 3,
          unit: 'عبوة',
          costPerUnit: 85,
          reorderLevel: 2
        },
        {
          id: 'hw_led_unit',
          name: 'وحدة إضاءة LED مدمجة مع مفتاح',
          category: 'إلكترونيات',
          currentQty: 12,
          unit: 'قطعة',
          costPerUnit: 40,
          reorderLevel: 5
        },
        {
          id: 'hw_rubber_feet',
          name: 'أرجل مطاطية 10 مم لاصقة',
          category: 'إكسسوارات',
          currentQty: 60,
          unit: 'قطعة',
          costPerUnit: 2.0,
          reorderLevel: 20
        }
      ],
      packaging: [
        {
          id: 'pkg_box_m',
          name: 'كرتونة شحن كرافت مقاس M (20x20x20)',
          type: 'كراتين',
          currentQty: 35,
          unit: 'كرتونة',
          costPerUnit: 12,
          reorderLevel: 10
        },
        {
          id: 'pkg_box_s',
          name: 'كرتونة شحن صغيرة مقاس S (15x15x10)',
          type: 'كراتين',
          currentQty: 40,
          unit: 'كرتونة',
          costPerUnit: 8,
          reorderLevel: 15
        },
        {
          id: 'pkg_bubble',
          name: 'رول بابل راب فقاعات هوائية',
          type: 'حماية',
          currentQty: 45, // بالمتر
          unit: 'متر',
          costPerUnit: 6,
          reorderLevel: 10
        },
        {
          id: 'pkg_poly_bag',
          name: 'أكياس حماية بلاستيك سيلد',
          type: 'أكياس',
          currentQty: 120,
          unit: 'كيس',
          costPerUnit: 1.5,
          reorderLevel: 25
        },
        {
          id: 'pkg_sticker',
          name: 'ملصق هوية ورشة ELMALHY.3D الفاخر',
          type: 'ملصقات',
          currentQty: 180,
          unit: 'ستيكر',
          costPerUnit: 1.0,
          reorderLevel: 30
        }
      ],
      finishedGoods: [
        {
          id: 'fg_1',
          sku: 'DEC-MOON-15',
          name: 'مصباح القمر 15cm (جاهز للتسليم الفوري)',
          currentStockQty: 2,
          minStockQty: 1,
          sellingPrice: 450
        },
        {
          id: 'fg_2',
          sku: 'ORG-DESK-STAND',
          name: 'حامل أجهزة مكتبي رمادي',
          currentStockQty: 3,
          minStockQty: 2,
          sellingPrice: 220
        }
      ]
    },
    orders: [
      {
        id: 'ord_101',
        code: 'ELM-2601',
        customerId: 'cust_1',
        customerName: 'م. أحمد خالد',
        customerPhone: '01012345678',
        stage: 'delivered', // تم التسليم
        createdAt: '2026-09-28T09:00:00Z',
        deliveredAt: '2026-10-02T16:00:00Z',
        items: [
          {
            productId: 'prod_1',
            sku: 'DEC-MOON-15',
            name: 'مصباح القمر المضيء 15cm',
            quantity: 2,
            unitPrice: 450,
            partWeightG: 180,
            printHours: 14,
            filamentId: 'fil_pla_wht'
          }
        ],
        financials: {
          subtotal: 900,
          discount: 0,
          shippingFee: 50,
          grandTotal: 950,
          depositPaid: 950,
          remainingBalance: 0,
          totalCost: 480,
          netProfit: 470
        },
        productionJob: {
          jobId: 'job_101',
          printerId: 'printer_neptune_4_pro',
          startedAt: '2026-09-29T10:00:00Z',
          completedAt: '2026-09-30T15:00:00Z',
          status: 'success', // success / failed
          estimatedWeightG: 360,
          actualWeightG: 370,
          estimatedHours: 28,
          actualHours: 28.5,
          estimatedCost: 480,
          actualCost: 495,
          stockDeducted: true // تم خصمه في الإنتاج
        }
      },
      {
        id: 'ord_102',
        code: 'ELM-2602',
        customerId: 'cust_2',
        customerName: 'أ/ سارة محمود',
        customerPhone: '01198765432',
        stage: 'printing', // جاري الطباعة حالياً
        createdAt: '2026-10-06T11:00:00Z',
        deadlineDate: '2026-10-10',
        items: [
          {
            productId: 'prod_2',
            sku: 'GFT-CUST-KEY',
            name: 'ميدالية اسم مخصصة مع مغناطيس',
            quantity: 10,
            unitPrice: 55.25, // بعد خصم الكمية 15%
            partWeightG: 22,
            printHours: 1.2,
            filamentId: 'fil_pla_blk'
          }
        ],
        financials: {
          subtotal: 552.5,
          discount: 97.5,
          shippingFee: 45,
          grandTotal: 597.5,
          depositPaid: 300,
          remainingBalance: 297.5,
          totalCost: 260,
          netProfit: 337.5
        },
        productionJob: {
          jobId: 'job_102',
          printerId: 'printer_neptune_4_pro',
          startedAt: '2026-10-07T14:00:00Z',
          status: 'in_progress',
          estimatedWeightG: 220,
          actualWeightG: null,
          estimatedHours: 12,
          actualHours: null,
          estimatedCost: 260,
          actualCost: null,
          stockDeducted: true // خصم عند الانتقال للطباعة
        }
      },
      {
        id: 'ord_103',
        code: 'ELM-2603',
        customerId: 'cust_1',
        customerName: 'م. أحمد خالد',
        customerPhone: '01012345678',
        stage: 'quotation', // عرض سعر فقط (لم يخصم أي مخزون)
        createdAt: '2026-10-08T10:00:00Z',
        deadlineDate: '2026-10-14',
        items: [
          {
            productId: 'prod_3',
            sku: 'ORG-DESK-STAND',
            name: 'حامل مكتبي متعدد للأجهزة',
            quantity: 4,
            unitPrice: 200,
            partWeightG: 110,
            printHours: 6.5,
            filamentId: 'fil_petg_gry'
          }
        ],
        financials: {
          subtotal: 800,
          discount: 80,
          shippingFee: 50,
          grandTotal: 850,
          depositPaid: 0,
          remainingBalance: 850,
          totalCost: 410,
          netProfit: 440
        },
        productionJob: null // لا يوجد مهمة إنتاج بعد
      }
    ],
    stockLedger: [
      {
        id: 'led_1',
        timestamp: '2026-09-29T10:00:00Z',
        itemId: 'fil_pla_wht',
        itemType: 'filament',
        changeType: 'out_production',
        qty: -360,
        unit: 'g',
        balanceAfter: 340,
        referenceJobId: 'job_101',
        notes: 'صرف خامة لطلب ELM-2601'
      },
      {
        id: 'led_2',
        timestamp: '2026-10-07T14:00:00Z',
        itemId: 'fil_pla_blk',
        itemType: 'filament',
        changeType: 'out_production',
        qty: -220,
        unit: 'g',
        balanceAfter: 820,
        referenceJobId: 'job_102',
        notes: 'صرف خامة لطلب ELM-2602'
      },
      {
        id: 'led_3',
        timestamp: '2026-10-07T14:00:00Z',
        itemId: 'hw_mag_10x2',
        itemType: 'hardware',
        changeType: 'out_production',
        qty: -20,
        unit: 'قطعة',
        balanceAfter: 140,
        referenceJobId: 'job_102',
        notes: 'صرف 20 مغناطيس لطلب ELM-2602'
      }
    ]
  };

  // ذاكرة مؤقتة لبيئة الاختبار أو عند تعذر التخزين
  let memoryStore = null;

  function loadDB() {
    if (typeof localStorage !== 'undefined') {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          return parsed;
        }
      } catch (err) {
        console.warn('Could not read from localStorage, using memory/defaults:', err);
      }
    }
    if (memoryStore) return JSON.parse(JSON.stringify(memoryStore));
    // نسخ عميق للبيانات المبدئية
    const initial = JSON.parse(JSON.stringify(DEFAULT_SEED_DATA));
    saveDB(initial);
    return initial;
  }

  function saveDB(data) {
    memoryStore = JSON.parse(JSON.stringify(data));
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      } catch (err) {
        console.warn('Could not write to localStorage:', err);
      }
    }
  }

  function resetToDefaults() {
    const copy = JSON.parse(JSON.stringify(DEFAULT_SEED_DATA));
    saveDB(copy);
    return copy;
  }

  function exportBackupJSON() {
    const db = loadDB();
    return JSON.stringify(db, null, 2);
  }

  function importBackupJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed.products || !parsed.inventory || !parsed.orders) {
        throw new Error('ملف النسخة الاحتياطية غير مكتمل الأركان الأساسية');
      }
      saveDB(parsed);
      return { success: true, data: parsed };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  return {
    ORDER_STAGES,
    DEFAULT_PRINTER,
    DEFAULT_SETTINGS,
    loadDB,
    saveDB,
    resetToDefaults,
    exportBackupJSON,
    importBackupJSON
  };
});

// Master Presets for 3D Printing in Egypt — الأسعار تقريبية، راجعها دورياً
const PRESETS_PRICES_UPDATED = '2026-10-07';
const PRESETS = {
  filaments: [
    // 🇪🇬 Patron 3D (Egyptian Local Brand)
    { id: 'patron-pla', name: '🇪🇬 Patron 3D PLA (محلي)', brand: 'Patron 3D', type: 'PLA', price: 600, weight: 1000, density: 1.24, isLocal: true },
    { id: 'patron-pla-plus', name: '🇪🇬 Patron 3D PLA+ (محلي)', brand: 'Patron 3D', type: 'PLA+', price: 700, weight: 1000, density: 1.24, isLocal: true },
    { id: 'patron-petg', name: '🇪🇬 Patron 3D PETG (محلي)', brand: 'Patron 3D', type: 'PETG', price: 650, weight: 1000, density: 1.27, isLocal: true },
    { id: 'patron-abs', name: '🇪🇬 Patron 3D ABS (محلي)', brand: 'Patron 3D', type: 'ABS', price: 750, weight: 1000, density: 1.04, isLocal: true },
    { id: 'patron-tpu', name: '🇪🇬 Patron 3D TPU 95A (محلي)', brand: 'Patron 3D', type: 'TPU', price: 950, weight: 1000, density: 1.21, isLocal: true },

    // Imported Brands (eSUN)
    { id: 'esun-pla', name: 'eSUN PLA+ (مستورد)', brand: 'eSUN', type: 'PLA+', price: 950, weight: 1000, density: 1.24 },
    { id: 'esun-petg', name: 'eSUN PETG (مستورد)', brand: 'eSUN', type: 'PETG', price: 900, weight: 1000, density: 1.27 },
    { id: 'esun-abs', name: 'eSUN ABS+ (مستورد)', brand: 'eSUN', type: 'ABS+', price: 850, weight: 1000, density: 1.04 },
    { id: 'esun-tpu', name: 'eSUN eTPU-95A (مستورد)', brand: 'eSUN', type: 'TPU', price: 1200, weight: 1000, density: 1.21 }
  ],

  printers: [
    { id: 'neptune-4-pro', name: 'Elegoo Neptune 4 Pro (الأساسية)', price: 26000, lifespanHours: 5000, powerKw: 0.16 },
    { id: 'neptune-4-plus', name: 'Elegoo Neptune 4 Plus', price: 34000, lifespanHours: 5000, powerKw: 0.22 },
    { id: 'neptune-4-max', name: 'Elegoo Neptune 4 Max', price: 42000, lifespanHours: 5000, powerKw: 0.28 },
    { id: 'bambu-p1s', name: 'Bambu Lab P1S', price: 58000, lifespanHours: 8000, powerKw: 0.18 },
    { id: 'bambu-a1-mini', name: 'Bambu Lab A1 Mini', price: 24000, lifespanHours: 4000, powerKw: 0.12 }
  ],

  electricityTiers: [
    { id: 'residential-tier-3', name: 'منزلي: شريحة 3 (حتى 200 ك.و.س) — 1.51 ج.م/ك.و.س (الموصى بها)', rate: 1.51 },
    { id: 'residential-tier-4', name: 'منزلي: شريحة 4 (حتى 350 ك.و.س) — 1.88 ج.م/ك.و.س', rate: 1.88 },
    { id: 'residential-tier-5', name: 'منزلي: شريحة 5 (حتى 650 ك.و.س) — 2.10 ج.م/ك.و.س', rate: 2.10 },
    { id: 'commercial-tier-1', name: 'تجاري / ورش: شريحة 1 (حتى 100 ك.و.س) — 1.95 ج.م/ك.و.س', rate: 1.95 },
    { id: 'commercial-tier-2', name: 'تجاري / ورش: شريحة 2 (حتى 250 ك.و.س) — 2.45 ج.م/ك.و.س', rate: 2.45 }
  ],

  shippingGovernorates: [
    { id: 'local-pickup', name: 'استلام من مقر الورشة (مجاناً)', cost: 0 },
    { id: 'cairo-giza', name: 'القاهرة والجيزة (شحن سريع)', cost: 50 },
    { id: 'alexandria', name: 'الإسكندرية والبحيرة', cost: 65 },
    { id: 'delta', name: 'محافظات الدلتا والقناة', cost: 70 },
    { id: 'upper-egypt', name: 'محافظات الصعيد', cost: 85 },
    { id: 'red-sea-sinai', name: 'البحر الأحمر وشمال/جنوب سيناء', cost: 110 }
  ],

  colors: [
    'أسود (Black)',
    'أبيض (White)',
    'رمادي (Grey)',
    'أحمر (Red)',
    'أزرق (Blue)',
    'أخضر (Green)',
    'أصفر (Yellow)',
    'برتقالي (Orange)',
    'فضي ميتاليك (Silver)',
    'ذهبي (Gold)',
    'شفاف طبيعي (Clear)',
    'خشب (Wood Infused)'
  ],

  hardwareAccessories: [
    { id: 'none', name: 'بدون إضافات', cost: 0 },
    { id: 'screws-m3', name: 'طقم مسامير وصواميل M3 (4 قطع)', cost: 10 },
    { id: 'screws-m4', name: 'طقم مسامير وصواميل M4 (4 قطع)', cost: 15 },
    { id: 'threaded-inserts', name: 'حلقات نحاسية حرارية Threaded Inserts (4 قطع)', cost: 20 },
    { id: 'magnets-neodymium', name: 'مغناطيس نيوديميوم قوي (قطعتين)', cost: 25 },
    { id: 'bearing-608', name: 'رولمان بلي Skate Bearing 608zz', cost: 30 },
    { id: 'packaging-bubble', name: 'تغليف خاص بابلز وكرتونة شحن فاخرة', cost: 20 }
  ]
};

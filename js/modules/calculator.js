/**
 * ELMALHY.3D Workshop Manager - Integrated Advanced Calculator Module
 * حاسبة تسعير متكاملة مع التقطيع، الدعامات، هدر الألوان، رص السطح، وتحليل ملفات STL ثلاثية الأبعاد
 * هندسة عكسية وتكامل متقدم مع Geniady 3D Cost Calculator
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('../core/calc.js'), require('../core/db.js'));
  } else {
    root.WorkshopCalculator = factory(root.WorkshopCalc, root.WorkshopDB);
  }
})(typeof self !== 'undefined' ? self : this, function (Calc, DB) {
  'use strict';

  const MARKETS = {
    EG: {
      id: 'EG',
      name: 'مصر (EGP)',
      flag: '🇪🇬',
      country: 'مصر',
      currency: { code: 'EGP', symbol: 'ج.م', position: 'suffix', decimals: 2 },
      electricityCostPerKwh: 2.5,
      laborHourlyRate: 95,
      defaultFailureRatePercent: 7,
      defaultMaintenancePercentOfDepreciation: 20,
      defaultProfitMarginPercent: 45,
      defaultPrinterCost: 22000,
      filamentPricePerKg: {
        pla: 900,
        pla_plus: 950,
        patron_pla: 600,
        patron_pla_plus: 700,
        patron_petg: 650,
        patron_abs: 750,
        patron_tpu: 950,
        esun_pla_plus: 950,
        petg: 950,
        abs: 920,
        tpu: 1450,
        asa: 1350,
        nylon: 2150,
        pc: 2000
      }
    },
    SA: {
      id: 'SA',
      name: 'السعودية (SAR)',
      flag: '🇸🇦',
      country: 'المملكة العربية السعودية',
      currency: { code: 'SAR', symbol: 'ر.س', position: 'prefix', decimals: 2 },
      electricityCostPerKwh: 0.21,
      laborHourlyRate: 50,
      defaultFailureRatePercent: 5,
      defaultMaintenancePercentOfDepreciation: 15,
      defaultProfitMarginPercent: 40,
      defaultPrinterCost: 2900,
      filamentPricePerKg: {
        pla: 85,
        pla_plus: 90,
        petg: 92,
        abs: 90,
        tpu: 135,
        asa: 120,
        nylon: 185,
        pc: 175
      }
    },
    AE: {
      id: 'AE',
      name: 'الإمارات (AED)',
      flag: '🇦🇪',
      country: 'دولة الإمارات',
      currency: { code: 'AED', symbol: 'د.إ', position: 'prefix', decimals: 2 },
      electricityCostPerKwh: 0.36,
      laborHourlyRate: 50,
      defaultFailureRatePercent: 5,
      defaultMaintenancePercentOfDepreciation: 15,
      defaultProfitMarginPercent: 40,
      defaultPrinterCost: 2850,
      filamentPricePerKg: {
        pla: 85,
        pla_plus: 90,
        petg: 90,
        abs: 90,
        tpu: 130,
        asa: 115,
        nylon: 180,
        pc: 170
      }
    },
    US: {
      id: 'US',
      name: 'الولايات المتحدة (USD)',
      flag: '🇺🇸',
      country: 'United States',
      currency: { code: 'USD', symbol: '$', position: 'prefix', decimals: 2 },
      electricityCostPerKwh: 0.182,
      laborHourlyRate: 25,
      defaultFailureRatePercent: 5,
      defaultMaintenancePercentOfDepreciation: 15,
      defaultProfitMarginPercent: 40,
      defaultPrinterCost: 699,
      filamentPricePerKg: {
        pla: 20,
        pla_plus: 22,
        petg: 22,
        abs: 22,
        tpu: 32,
        asa: 28,
        nylon: 45,
        pc: 42
      }
    },
    EU: {
      id: 'EU',
      name: 'أوروبا (EUR)',
      flag: '🇪🇺',
      country: 'European Union',
      currency: { code: 'EUR', symbol: '€', position: 'suffix', decimals: 2 },
      electricityCostPerKwh: 0.29,
      laborHourlyRate: 28,
      defaultFailureRatePercent: 5,
      defaultMaintenancePercentOfDepreciation: 15,
      defaultProfitMarginPercent: 40,
      defaultPrinterCost: 749,
      filamentPricePerKg: {
        pla: 22,
        pla_plus: 24,
        petg: 24,
        abs: 24,
        tpu: 35,
        asa: 30,
        nylon: 48,
        pc: 46
      }
    },
    GB: {
      id: 'GB',
      name: 'بريطانيا (GBP)',
      flag: '🇬🇧',
      country: 'United Kingdom',
      currency: { code: 'GBP', symbol: '£', position: 'prefix', decimals: 2 },
      electricityCostPerKwh: 0.263,
      laborHourlyRate: 22,
      defaultFailureRatePercent: 5,
      defaultMaintenancePercentOfDepreciation: 15,
      defaultProfitMarginPercent: 40,
      defaultPrinterCost: 599,
      filamentPricePerKg: {
        pla: 18,
        pla_plus: 20,
        petg: 20,
        abs: 20,
        tpu: 30,
        asa: 26,
        nylon: 42,
        pc: 40
      }
    }
  };

  const PRINTER_PROFILES = {
    neptune_4_pro: {
      id: 'neptune_4_pro',
      name: 'Elegoo Neptune 4 Pro (ورشة ELMALHY)',
      description: 'طابعة الورشة الأساسية - Direct Drive عالية السرعة حتى 500mm/s',
      maxVolumetricFlowMm3PerS: 18,
      maxAccelerationMmPerS2: 8000,
      powerConsumptionWatts: 220,
      lifespanHours: 6000,
      defaultCostUSD: 399,
      defaultCostEGP: 22000,
      kinematicEfficiency: 0.72,
      bedSizeMm: { x: 225, y: 225, z: 265 }
    },
    high_speed_corexy: {
      id: 'high_speed_corexy',
      name: 'High-Speed CoreXY (Bambu X1C/P1S, Voron 2.4, K1)',
      description: 'طابعة CoreXY مغلقة فائقة السرعة مع تسارع حتى 20,000mm/s²',
      maxVolumetricFlowMm3PerS: 22,
      maxAccelerationMmPerS2: 12000,
      powerConsumptionWatts: 160,
      lifespanHours: 3500,
      defaultCostUSD: 699,
      defaultCostEGP: 38500,
      kinematicEfficiency: 0.76,
      bedSizeMm: { x: 256, y: 256, z: 256 }
    },
    modern_bedslinger: {
      id: 'modern_bedslinger',
      name: 'Modern Bed-Slinger (Bambu A1, Prusa MK4)',
      description: 'طابعة Direct Drive حديثة وسريعة مع مستشعر ضغط أوتوماتيكي',
      maxVolumetricFlowMm3PerS: 18,
      maxAccelerationMmPerS2: 8000,
      powerConsumptionWatts: 130,
      lifespanHours: 3000,
      defaultCostUSD: 399,
      defaultCostEGP: 24000,
      kinematicEfficiency: 0.70,
      bedSizeMm: { x: 256, y: 256, z: 256 }
    },
    classic_cartesian: {
      id: 'classic_cartesian',
      name: 'Classic Cartesian (Creality Ender 3 / Kobra)',
      description: 'طابعة اقتصادية قياسية مع محرك Bowden وسرعات طباعة تقليدية',
      maxVolumetricFlowMm3PerS: 8,
      maxAccelerationMmPerS2: 800,
      powerConsumptionWatts: 120,
      lifespanHours: 2000,
      defaultCostUSD: 199,
      defaultCostEGP: 12000,
      kinematicEfficiency: 0.44,
      bedSizeMm: { x: 220, y: 220, z: 250 }
    },
    custom: {
      id: 'custom',
      name: 'Custom Printer (طابعة مخصصة بالكامل)',
      description: 'إعدادات مخصصة لحجم السطح والقدرة والسرعة حسب رغبة الورشة',
      maxVolumetricFlowMm3PerS: 18,
      maxAccelerationMmPerS2: 6000,
      powerConsumptionWatts: 150,
      lifespanHours: 3000,
      defaultCostUSD: 500,
      defaultCostEGP: 25000,
      kinematicEfficiency: 0.60,
      bedSizeMm: { x: 250, y: 250, z: 250 }
    }
  };

  const MATERIALS = [
    {
      id: 'pla',
      name: 'PLA',
      fullName: 'Polylactic Acid',
      density: 1.24,
      typicalBedTempC: 55,
      typicalNozzleTempC: 215,
      maxVolumetricFlowMm3PerS: 18,
      shrinkagePercent: 0.3,
      description: 'الخامة الأكثر شعبية - صديقة للبيئة وسهلة الطباعة مع تشوه وانكماش ضئيل جداً.'
    },
    {
      id: 'pla_plus',
      name: 'PLA+',
      fullName: 'PLA Plus (Tough)',
      density: 1.24,
      typicalBedTempC: 60,
      typicalNozzleTempC: 215,
      maxVolumetricFlowMm3PerS: 18,
      shrinkagePercent: 0.3,
      description: 'نسخة محسنة من PLA بمتانة وصلابة ومقاومة صدمات أعلى ومثالية للديكورات والقطع الاستهلاكية.'
    },
    {
      id: 'petg',
      name: 'PETG',
      fullName: 'Polyethylene Terephthalate Glycol',
      density: 1.27,
      typicalBedTempC: 75,
      typicalNozzleTempC: 245,
      maxVolumetricFlowMm3PerS: 13,
      shrinkagePercent: 0.5,
      description: 'مقاومة عالية للصدمات والرطوبة والمواد الكيميائية - ممتاز للاستخدام الخارجي وقطع العمل.'
    },
    {
      id: 'abs',
      name: 'ABS',
      fullName: 'Acrylonitrile Butadiene Styrene',
      density: 1.04,
      typicalBedTempC: 100,
      typicalNozzleTempC: 255,
      maxVolumetricFlowMm3PerS: 16,
      shrinkagePercent: 1.4,
      description: 'مقاوم للحرارة حتى 90°C وميكانيكياً قوي جداً وقابل للتلميع بالأسيتون (يتطلب حجرة مغلقة).'
    },
    {
      id: 'tpu',
      name: 'TPU 95A',
      fullName: 'Thermoplastic Polyurethane',
      density: 1.21,
      typicalBedTempC: 50,
      typicalNozzleTempC: 230,
      maxVolumetricFlowMm3PerS: 4,
      shrinkagePercent: 0.6,
      description: 'خامة مطاطية مرنة للغاية ومقاومة للتآكل والاهتزازات - مثالية للأغطية وممتصات الصدمات.'
    },
    {
      id: 'asa',
      name: 'ASA',
      fullName: 'Acrylonitrile Styrene Acrylate',
      density: 1.07,
      typicalBedTempC: 100,
      typicalNozzleTempC: 260,
      maxVolumetricFlowMm3PerS: 16,
      shrinkagePercent: 1.2,
      description: 'بديل ABS الفائق المقاوم للأشعة فوق البنفسجية UV والعوامل الجوية الخارجية دون تغير اللون.'
    },
    {
      id: 'nylon',
      name: 'Nylon (PA)',
      fullName: 'Polyamide',
      density: 1.14,
      typicalBedTempC: 80,
      typicalNozzleTempC: 265,
      maxVolumetricFlowMm3PerS: 12,
      shrinkagePercent: 1.5,
      description: 'قوة شد هائلة مع تزييت ذاتي ومقاومة للاحتكاك - مثالي للتروس والقطع الميكانيكية المتحركة.'
    },
    {
      id: 'pc',
      name: 'PC',
      fullName: 'Polycarbonate',
      density: 1.20,
      typicalBedTempC: 110,
      typicalNozzleTempC: 280,
      maxVolumetricFlowMm3PerS: 14,
      shrinkagePercent: 1.3,
      description: 'أقوى خامات الـ FDM على الإطلاق مع مقاومة حرارية حتى 120°C وصلابة هيكلية خارقة.'
    },
    {
      id: 'patron_pla',
      name: '🇪🇬 Patron 3D PLA (محلي)',
      fullName: 'Patron 3D Local Egyptian PLA',
      brand: 'Patron 3D',
      density: 1.24,
      typicalBedTempC: 60,
      typicalNozzleTempC: 210,
      maxVolumetricFlowMm3PerS: 16,
      shrinkagePercent: 0.3,
      description: 'فيلامنت مصري محلي عالي الجودة للديكور والنماذج الأولية بسعر اقتصادي ممتاز.'
    },
    {
      id: 'patron_pla_plus',
      name: '🇪🇬 Patron 3D PLA+ (محلي)',
      fullName: 'Patron 3D Local Egyptian Tough PLA+',
      brand: 'Patron 3D',
      density: 1.24,
      typicalBedTempC: 60,
      typicalNozzleTempC: 215,
      maxVolumetricFlowMm3PerS: 18,
      shrinkagePercent: 0.3,
      description: 'فيلامنت مصري مقوى بمقاومة صدمات ممتازة ومثالي للمنتجات الاستهلاكية والتجارية.'
    },
    {
      id: 'patron_petg',
      name: '🇪🇬 Patron 3D PETG (محلي)',
      fullName: 'Patron 3D Local Egyptian PETG',
      brand: 'Patron 3D',
      density: 1.27,
      typicalBedTempC: 75,
      typicalNozzleTempC: 240,
      maxVolumetricFlowMm3PerS: 14,
      shrinkagePercent: 0.5,
      description: 'مقاوم للحرارة والرطوبة للاستخدام العملي والخارجي بإنتاج مصري.'
    },
    {
      id: 'patron_abs',
      name: '🇪🇬 Patron 3D ABS (محلي)',
      fullName: 'Patron 3D Local Egyptian ABS',
      brand: 'Patron 3D',
      density: 1.04,
      typicalBedTempC: 100,
      typicalNozzleTempC: 255,
      maxVolumetricFlowMm3PerS: 16,
      shrinkagePercent: 1.4,
      description: 'ميكانيكي صلب مقاوم للحرارة حتى 90 درجة مئوية.'
    },
    {
      id: 'patron_tpu',
      name: '🇪🇬 Patron 3D TPU 95A (محلي)',
      fullName: 'Patron 3D Local Egyptian Flexible TPU',
      brand: 'Patron 3D',
      density: 1.21,
      typicalBedTempC: 50,
      typicalNozzleTempC: 230,
      maxVolumetricFlowMm3PerS: 5,
      shrinkagePercent: 0.6,
      description: 'مطاطي مرن للصدمات والمقابض والأغطية الواقية.'
    },
    {
      id: 'esun_pla_plus',
      name: 'eSUN PLA+ (مستورد)',
      fullName: 'eSUN Imported Tough PLA+',
      brand: 'eSUN',
      density: 1.24,
      typicalBedTempC: 60,
      typicalNozzleTempC: 215,
      maxVolumetricFlowMm3PerS: 18,
      shrinkagePercent: 0.3,
      description: 'الخامة الأكثر شهرة واعتمادية عالمياً لطباعة فائقة النعومة.'
    }
  ];

  const MODEL_PRESETS = [
    {
      id: '3dbenchy',
      name: '#3DBenchy Boat',
      icon: '🚤',
      dimensions: { width: 60, depth: 31, height: 48 },
      volumeMm3: 11350,
      surfaceAreaMm2: 8400,
      defaultInfill: 15,
      defaultWalls: 3,
      description: 'قارب الاختبار المعياري الأكثر شهرة في عالم الطباعة ثلاثية الأبعاد.'
    },
    {
      id: 'multicolor-benchy',
      name: 'Multi-Color Benchy',
      icon: '🎨',
      dimensions: { width: 60, depth: 31, height: 48 },
      volumeMm3: 11350,
      surfaceAreaMm2: 8400,
      defaultInfill: 15,
      defaultWalls: 3,
      multiColor: { enabled: true, colorSwapsCount: 48, flushVolumePerSwapMm3: 280 },
      description: 'قارب بينتشي متعدد الألوان لاختبار هدر الفلمنت والـ Prime Tower وبرج التطهير.'
    },
    {
      id: 'large-hex-vase',
      name: 'Large Hex Vase',
      icon: '🏺',
      dimensions: { width: 95, depth: 95, height: 160 },
      volumeMm3: 32500,
      surfaceAreaMm2: 45000,
      defaultInfill: 0,
      defaultWalls: 1,
      description: 'فازة سداسية عملاقة تُطبع بوضع Spiralize / Vase Mode بدون دعامات.'
    },
    {
      id: 'voron-housing',
      name: 'Voron 2.4 Housing',
      icon: '🖨️',
      dimensions: { width: 120, depth: 85, height: 45 },
      volumeMm3: 58000,
      surfaceAreaMm2: 32000,
      defaultInfill: 40,
      defaultWalls: 4,
      description: 'قطعة هيكلية ميكانيكية دقيقة من طابعة Voron 2.4 تتطلب دقة وتبريداً عاليين.'
    }
  ];

  function getMarkets() { return MARKETS; }
  function getPrinterProfiles() { return PRINTER_PROFILES; }
  function getMaterials() { return MATERIALS; }
  function getModelPresets() { return MODEL_PRESETS; }

  function getSpoolPricesFromInventory() {
    const db = DB.loadDB ? DB.loadDB() : {};
    return (db.inventory?.filaments || []).map(f => ({
      id: f.id,
      name: f.name,
      material: f.material,
      color: f.color,
      spoolPrice: f.spoolPrice,
      spoolWeightG: f.spoolWeightG,
      remainingWeightG: f.remainingWeightG
    }));
  }

  function getDefaultSettings(marketId = 'EG') {
    const market = MARKETS[marketId] || MARKETS.EG;
    const db = DB.loadDB ? DB.loadDB() : {};
    const primaryPrinter = (db.printers || [])[0] || {};

    return {
      marketId: market.id,
      printerPowerKw: primaryPrinter.powerKw || (PRINTER_PROFILES.neptune_4_pro.powerConsumptionWatts / 1000),
      printerPrice: primaryPrinter.purchasePrice || market.defaultPrinterCost,
      printerLifespanHours: primaryPrinter.lifespanHours || 6000,
      consumablesPerHour: primaryPrinter.consumablesCostPerHour || 5,
      electricityRate: db.settings?.electricityRate || market.electricityCostPerKwh,
      laborHourlyRate: market.laborHourlyRate,
      defaultMarginPercent: db.settings?.defaultMarginPercent || market.defaultProfitMarginPercent,
      defaultFailureRate: db.settings?.defaultFailureRate || market.defaultFailureRatePercent,
      defaultMaintenancePercent: market.defaultMaintenancePercentOfDepreciation
    };
  }

  function convertFilamentLength(lengthMm, diameterMm, materialId) {
    const mat = MATERIALS.find(m => m.id === materialId) || MATERIALS[0];
    const radiusMm = (diameterMm || 1.75) / 2;
    const volumeCm3 = Math.PI * Math.pow(radiusMm / 10, 2) * (lengthMm / 10);
    return Math.round(volumeCm3 * mat.density * 100) / 100;
  }

  function formatCurrency(val, currency = MARKETS.EG.currency) {
    const n = Number.isFinite(Number(val)) ? Number(val) : 0;
    const dec = currency.decimals !== undefined ? currency.decimals : 2;
    const str = Math.abs(n).toLocaleString('ar-EG', {
      minimumFractionDigits: dec,
      maximumFractionDigits: dec
    });
    const prefix = n < 0 ? '-' : '';
    if (currency.position === 'prefix') {
      return `${prefix}${currency.symbol} ${str}`;
    }
    return `${prefix}${str} ${currency.symbol}`;
  }

  /**
   * محرك الحساب الشامل المتكامل:
   * يدمج Slicing + Supports + Multicolor + Plate Nesting + Kinematics + Costs
   */
  function calculateIntegrated(inputs = {}) {
    const market = MARKETS[inputs.marketId] || MARKETS.EG;
    const printer = PRINTER_PROFILES[inputs.printerProfileId] || PRINTER_PROFILES.neptune_4_pro;
    const material = MATERIALS.find(m => m.id === inputs.materialId) || MATERIALS[0];

    // 1. حساب الحجم والموديل
    let solidVolumeMm3 = Math.max(0, Number(inputs.solidVolumeMm3) || 0);
    if (solidVolumeMm3 <= 0 && inputs.partWeightG > 0) {
      solidVolumeMm3 = (inputs.partWeightG / material.density) * 1000;
    }

    const infillPercent = Math.max(0, Math.min(100, Number(inputs.infillPercent ?? 15)));
    const wallCount = Math.max(1, Math.min(12, Number(inputs.wallCount ?? 3)));
    const surfaceAreaMm2 = Number(inputs.surfaceAreaMm2) || 0;

    // 2. تشريح الحجم إلى جدران وحشو داخلي
    const sliced = Calc.sliceVolume(solidVolumeMm3, infillPercent, wallCount, surfaceAreaMm2);
    const netModelVolumeMm3 = sliced.slicedNetVolumeMm3;
    let netModelMassGrams = Math.round((netModelVolumeMm3 / 1000) * material.density * 10) / 10;

    // دعم التجاوز اليدوي المباشر للوزن (Manual Weight Override)
    if (inputs.manualWeightOverride && Number(inputs.manualWeightGrams) > 0) {
      netModelMassGrams = Math.round(Number(inputs.manualWeightGrams) * 10) / 10;
    }

    // 3. خامة الدعم (Supports)
    const supportRes = Calc.calculateSupportWaste(
      netModelVolumeMm3,
      inputs.supportType || 'none',
      inputs.supportCustomPercent || 15,
      inputs.manualSupportGrams ? (inputs.manualSupportGrams / material.density) * 1000 : undefined
    );
    const supportMassGrams = Math.round((supportRes.supportVolumeMm3 / 1000) * material.density * 10) / 10;

    // 4. خامة الألوان المتعددة والتطهير (Purge / Prime Tower)
    const layerHeightMm = Number(inputs.layerHeightMm) || 0.2;
    const heightMm = Number(inputs.heightMm) || 50;
    const layerCount = Math.max(1, Math.ceil(heightMm / layerHeightMm));

    const multiColorRes = Calc.calculateMultiColorWaste(
      {
        enabled: inputs.multiColorEnabled === true,
        colorSwapsCount: Number(inputs.colorSwapsCount) || 0,
        flushVolumePerSwapMm3: Number(inputs.flushVolumePerSwapMm3) || 300,
        primeTowerEnabled: inputs.primeTowerEnabled !== false,
        primeTowerFootprintAreaMm2: 225,
        primeTowerDensityFactor: 0.25
      },
      layerCount,
      layerHeightMm
    );

    const flushMassGrams = Math.round((multiColorRes.flushVolumeMm3 / 1000) * material.density * 10) / 10;
    const primeTowerMassGrams = Math.round((multiColorRes.primeTowerVolumeMm3 / 1000) * material.density * 10) / 10;
    const totalWasteMassGrams = supportMassGrams + flushMassGrams + primeTowerMassGrams;

    // وزن القطعة الواحدة الصافي مع نصيبها من الهدر
    const singlePieceTotalGrams = netModelMassGrams + totalWasteMassGrams;

    // 5. الكمية ورص القطع على سطح الطابعة (Bed Nesting)
    const quantity = Math.max(1, parseInt(inputs.quantity, 10) || 1);
    const footprint = {
      x: Number(inputs.footprintX) || 50,
      y: Number(inputs.footprintY) || 50
    };
    const autoPiecesPerPlate = Calc.calculatePlateNesting(
      footprint,
      heightMm,
      printer.bedSizeMm,
      inputs.multiColorEnabled && multiColorRes.primeTowerVolumeMm3 > 0
    );
    const piecesPerPlate = Math.max(1, parseInt(inputs.piecesPerPlate, 10) || autoPiecesPerPlate);
    const platesNeeded = Math.ceil(quantity / piecesPerPlate);

    // 6. تقدير زمن الطباعة (Kinematic Time Estimation)
    let printHoursPerPiece;
    let timeResult;

    if (inputs.manualTimeOverride && inputs.manualPrintHours !== undefined) {
      printHoursPerPiece = Number(inputs.manualPrintHours) || 1;
      timeResult = {
        totalTimeHours: printHoursPerPiece,
        formattedDuration: `${printHoursPerPiece.toFixed(1)} ساعة (يدوي)`,
        isManualOverride: true
      };
    } else {
      timeResult = Calc.estimatePrintTime({
        netVolumeMm3: netModelVolumeMm3,
        supportVolumeMm3: supportRes.supportVolumeMm3,
        primeTowerVolumeMm3: multiColorRes.primeTowerVolumeMm3,
        maxVolumetricFlowMm3PerS: material.maxVolumetricFlowMm3PerS || printer.maxVolumetricFlowMm3PerS,
        kinematicEfficiency: printer.kinematicEfficiency,
        layerCount: layerCount,
        layerChangeOverheadSeconds: 2.5,
        colorSwapsCount: inputs.multiColorEnabled ? (Number(inputs.colorSwapsCount) || 0) : 0,
        toolChangeOverheadSeconds: 70,
        preheatWarmupMinutes: 5
      });

      // عوامل قطر الفوهة ونمط الحشو (Nozzle & Infill Factors)
      const nozzleDiameter = Number(inputs.nozzleDiameter) || 0.4;
      let nozzleFactor = 1.0;
      if (nozzleDiameter <= 0.25) nozzleFactor = 2.1;
      else if (nozzleDiameter >= 0.75) nozzleFactor = 0.52;
      else if (nozzleDiameter >= 0.55) nozzleFactor = 0.72;

      const infillPattern = inputs.infillPattern || 'grid';
      let patternFactor = 1.0;
      if (infillPattern === 'gyroid') patternFactor = 1.08;
      else if (infillPattern === 'honeycomb') patternFactor = 1.15;
      else if (infillPattern === 'lines') patternFactor = 0.90;

      printHoursPerPiece = Math.round(timeResult.totalTimeHours * nozzleFactor * patternFactor * 100) / 100;
    }

    // إجمالي زمن الباتش (مع الأخذ في الاعتبار تسخين كل لوح)
    const totalBatchHours = Math.round(printHoursPerPiece * quantity * 100) / 100;

    // 7. الحساب المالي (Financial Pricing Engine)
    const spoolPrice = Number(inputs.spoolPrice) || market.filamentPricePerKg[material.id] || 900;
    const spoolWeightG = Number(inputs.spoolWeightG) || 1000;
    const costPerGram = spoolPrice / spoolWeightG;

    // تكلفة المواد
    const netFilamentCost = netModelMassGrams * costPerGram;
    const wasteCost = totalWasteMassGrams * costPerGram;
    const totalMaterialCost = netFilamentCost + wasteCost;

    // تكلفة الكهرباء
    const powerWatts = Number(inputs.printerPowerWatts) || printer.powerConsumptionWatts;
    const elecRate = Number(inputs.electricityRate) || market.electricityCostPerKwh;
    const powerKw = powerWatts / 1000;
    const powerCost = printHoursPerPiece * powerKw * elecRate;

    // إهلاك الطابعة
    const printerCost = Number(inputs.printerCost) || (printer.defaultCostEGP || market.defaultPrinterCost);
    const lifespanHours = Number(inputs.lifespanHours) || printer.lifespanHours;
    const hourlyDeprec = lifespanHours > 0 ? (printerCost / lifespanHours) : 0;
    const depreciationCost = hourlyDeprec * printHoursPerPiece;

    // الصيانة والمستهلكات
    const maintenanceRatePct = Number(inputs.maintenanceRatePct ?? market.defaultMaintenancePercentOfDepreciation);
    const hourlyConsumables = hourlyDeprec * (maintenanceRatePct / 100) + (Number(inputs.consumablesPerHour) || 0);
    const maintenanceCost = hourlyConsumables * printHoursPerPiece;

    // العمالة (Prep per plate + Post-processing per piece)
    const prepMinutesPerPlate = Number(inputs.prepMinutesPerPlate ?? 10);
    const postMinutesPerPiece = Number(inputs.postMinutesPerPiece ?? 10);
    const laborRatePerHour = Number(inputs.laborRatePerHour) || market.laborHourlyRate;
    const totalLaborMinutes = (prepMinutesPerPlate * platesNeeded) + (postMinutesPerPiece * quantity);
    const totalLaborCostBatch = (totalLaborMinutes / 60) * laborRatePerHour;
    const laborCostPerPiece = totalLaborCostBatch / quantity;

    // ملحقات وتغليف وشحن
    const hardwareCost = Number(inputs.hardwareCost) || 0;
    const postProcessCost = Number(inputs.postProcessCost) || 0;
    const packagingCost = Number(inputs.packagingCost) || 0;
    const shippingFee = Number(inputs.shippingFee) || 0;

    // التكلفة المباشرة للقطعة
    const subtotalDirect = totalMaterialCost + powerCost + depreciationCost + maintenanceCost +
      laborCostPerPiece + hardwareCost + postProcessCost + packagingCost;

    // احتياطي الفشل (Failure Risk Buffer)
    const failureRiskPercent = Math.min(50, Math.max(0, Number(inputs.failureRiskPercent ?? market.defaultFailureRatePercent)));
    const failureRiskBuffer = subtotalDirect * (failureRiskPercent / 100);

    // إجمالي تكلفة تصنيع القطعة
    const totalManufacturingCost = subtotalDirect + failureRiskBuffer;

    // التسعير وهامش الربح
    const targetMarginPercent = Math.min(95, Math.max(1, Number(inputs.targetMarginPercent ?? market.defaultProfitMarginPercent)));
    const marginFactor = 1 - (targetMarginPercent / 100);
    let suggestedRetailPrice = marginFactor > 0 ? (totalManufacturingCost / marginFactor) : totalManufacturingCost * 2;

    // الحد الأدنى لسعر الطلب
    const minOrderPrice = Number(inputs.minOrderPrice) || 0;
    if (minOrderPrice > 0 && (suggestedRetailPrice * quantity) < minOrderPrice) {
      suggestedRetailPrice = minOrderPrice / quantity;
    }

    const unitGrossProfit = suggestedRetailPrice - totalManufacturingCost;
    const actualMarkupPercent = totalManufacturingCost > 0 ? (unitGrossProfit / totalManufacturingCost) * 100 : 0;
    const profitPerHour = printHoursPerPiece > 0 ? (unitGrossProfit / printHoursPerPiece) : 0;

    // إجماليات الباتش (Batch Totals)
    const batchTotalCost = totalManufacturingCost * quantity;
    const batchTotalPrice = suggestedRetailPrice * quantity + shippingFee;
    const batchGrossProfit = unitGrossProfit * quantity;

    // حساب النسب المئوية لتوزيع التكاليف والأرباح
    const totalRev = suggestedRetailPrice > 0 ? suggestedRetailPrice : 1;
    const materialPct = Math.max(0, Math.round((totalMaterialCost / totalRev) * 100));
    const machinePct = Math.max(0, Math.round(((powerCost + depreciationCost + maintenanceCost) / totalRev) * 100));
    const laborPct = Math.max(0, Math.round(((laborCostPerPiece + hardwareCost + postProcessCost + packagingCost) / totalRev) * 100));
    const riskPct = Math.max(0, Math.round((failureRiskBuffer / totalRev) * 100));
    const profitPct = Math.max(0, Math.round((unitGrossProfit / totalRev) * 100));

    return {
      market,
      printer,
      material,
      currency: market.currency,
      breakdown: {
        materialPct,
        machinePct,
        laborPct,
        riskPct,
        profitPct
      },
      geometry: {
        solidVolumeMm3: Calc.round(solidVolumeMm3, 1),
        netModelVolumeMm3: Calc.round(netModelVolumeMm3, 1),
        surfaceAreaMm2: Calc.round(surfaceAreaMm2, 1),
        infillPercent,
        wallCount,
        layerHeightMm,
        heightMm,
        layerCount
      },
      mass: {
        netModelMassGrams: Calc.round(netModelMassGrams, 1),
        supportMassGrams: Calc.round(supportMassGrams, 1),
        flushMassGrams: Calc.round(flushMassGrams, 1),
        primeTowerMassGrams: Calc.round(primeTowerMassGrams, 1),
        totalWasteMassGrams: Calc.round(totalWasteMassGrams, 1),
        singlePieceTotalGrams: Calc.round(singlePieceTotalGrams, 1),
        batchTotalMassGrams: Calc.round(singlePieceTotalGrams * quantity, 1),
        wastePercentageOfTotal: singlePieceTotalGrams > 0 ? Calc.round((totalWasteMassGrams / singlePieceTotalGrams) * 100, 1) : 0
      },
      nesting: {
        quantity,
        piecesPerPlate,
        autoPiecesPerPlate,
        platesNeeded,
        bedSizeMm: printer.bedSizeMm
      },
      time: {
        printHoursPerPiece: Calc.round(printHoursPerPiece, 2),
        totalBatchHours: Calc.round(totalBatchHours, 2),
        formattedDuration: timeResult.formattedDuration,
        isManualOverride: timeResult.isManualOverride
      },
      costs: {
        netFilamentCost: Calc.round(netFilamentCost),
        wasteCost: Calc.round(wasteCost),
        totalMaterialCost: Calc.round(totalMaterialCost),
        powerCost: Calc.round(powerCost),
        depreciationCost: Calc.round(depreciationCost),
        maintenanceCost: Calc.round(maintenanceCost),
        laborCostPerPiece: Calc.round(laborCostPerPiece),
        hardwareCost: Calc.round(hardwareCost),
        postProcessCost: Calc.round(postProcessCost),
        packagingCost: Calc.round(packagingCost),
        subtotalDirect: Calc.round(subtotalDirect),
        failureRiskBuffer: Calc.round(failureRiskBuffer),
        totalManufacturingCost: Calc.round(totalManufacturingCost),
        suggestedRetailPrice: Calc.round(suggestedRetailPrice),
        unitGrossProfit: Calc.round(unitGrossProfit),
        actualMarkupPercent: Calc.round(actualMarkupPercent, 1),
        targetMarginPercent: Calc.round(targetMarginPercent, 1),
        profitPerHour: Calc.round(profitPerHour)
      },
      batch: {
        batchTotalCost: Calc.round(batchTotalCost),
        batchTotalPrice: Calc.round(batchTotalPrice),
        batchGrossProfit: Calc.round(batchGrossProfit),
        shippingFee: Calc.round(shippingFee)
      }
    };
  }

  return {
    getMarkets,
    getPrinterProfiles,
    getMaterials,
    getModelPresets,
    getSpoolPricesFromInventory,
    getDefaultSettings,
    convertFilamentLength,
    formatCurrency,
    calculateIntegrated,
    parseSTL: Calc.parseSTL,
    parseGCode: Calc.parseGCode
  };
});

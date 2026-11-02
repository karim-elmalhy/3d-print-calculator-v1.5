/**
 * ELMALHY.3D Workshop Manager - Core Calculation Engine
 * حاسبة التسعير المتقدمة ومحرك الحسابات الميدانية
 * يدعم التقطيع، الدعم، الألوان المتعددة، رص القطع على السطح، وتحليل ملفات STL ثلاثية الأبعاد
 * هندسة عكسية وتكامل مع Geniady 3D Cost Calculator
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

  function round(val, dec = 2) {
    const factor = Math.pow(10, dec);
    return Math.round((num(val) + Number.EPSILON) * factor) / factor;
  }

  function quantityDiscountPct(tiers, qty) {
    if (!Array.isArray(tiers) || tiers.length === 0) return 0;
    return tiers
      .filter(t => qty >= num(t.min, Infinity))
      .reduce((m, t) => Math.max(m, Math.min(90, pos(t.pct))), 0);
  }

  /**
   * حساب التكلفة التقديرية أو الفعلية للقطعة والطلبية (النواة المتوافقة 100%)
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

    // الأرباح وهوامش الربح الفعلية
    const unitProfit = Math.max(0, finalUnitPrice - totalUnitCost);
    const actualMarginPercent = finalUnitPrice > 0 ? (unitProfit / finalUnitPrice) * 100 : 0;
    const markupPercent = totalUnitCost > 0 ? (unitProfit / totalUnitCost) * 100 : 0;

    // معدل ربح ساعة تشغيل الطابعة
    const profitPerHour = printHours > 0 ? (unitProfit / printHours) : 0;

    // إجماليات الطلبية / الباتش
    const batchDirectCost = directCost * qty;
    const batchTotalCost = totalUnitCost * qty;
    const batchTotalPrice = finalUnitPrice * qty;
    const batchTotalProfit = unitProfit * qty;

    // الشحن ورسوم المعاملات والحساب النهائي
    const shippingFee = pos(p.shippingFee);
    const vatPercent = Math.min(100, pos(p.vatPercent));
    const subtotalAfterDiscount = batchTotalPrice;
    const vatAmount = subtotalAfterDiscount * (vatPercent / 100);
    const grandOrderTotal = subtotalAfterDiscount + vatAmount + shippingFee;

    // الدفعات والمدفوع مقدماً
    const depositPaid = pos(p.depositPaid);
    const remainingBalance = Math.max(0, grandOrderTotal - depositPaid);

    return {
      partWeight: round(partWeight, 1),
      printHours: round(printHours, 2),
      quantity: qty,
      materialCost: round(materialCost),
      powerCost: round(powerCost),
      depreciationCost: round(depreciationCost),
      consumablesCost: round(consumablesCost),
      laborCost: round(laborCost),
      hardwareCost: round(hardwareCost),
      postProcessCost: round(postProcessCost),
      packagingCost: round(packagingCost),
      setupFeePerUnit: round(setupFeePerUnit),
      directCost: round(directCost),
      marketingCost: round(marketingCost),
      failureCost: round(failureCost),
      totalUnitCost: round(totalUnitCost),
      baseUnitPrice: round(baseUnitPrice),
      discountPercent: round(discountPercent, 1),
      finalUnitPrice: round(finalUnitPrice),
      unitProfit: round(unitProfit),
      actualMarginPercent: round(actualMarginPercent, 1),
      markupPercent: round(markupPercent, 1),
      profitPerHour: round(profitPerHour),
      batchTotalCost: round(batchTotalCost),
      batchTotalPrice: round(batchTotalPrice),
      batchTotalProfit: round(batchTotalProfit),
      vatAmount: round(vatAmount),
      shippingFee: round(shippingFee),
      grandOrderTotal: round(grandOrderTotal),
      depositPaid: round(depositPaid),
      remainingBalance: round(remainingBalance)
    };
  }

  /**
   * مقارنة التكلفة والربح التقديري بالفعلي بعد اكتمال الطباعة
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

  // =========================================================================
  // ADVANCED CALCULATION ENGINE (REVERSE ENGINEERED FROM GENIADY 3D)
  // =========================================================================

  /**
   * حساب حجم القشرة والحشو الداخلي بناء على الحجم وعدد الجدران ونسبة الحشو
   */
  function sliceVolume(volumeMm3, infillPercent = 15, wallCount = 3, surfaceAreaMm2 = 0) {
    const vol = pos(volumeMm3);
    if (vol <= 0) return { slicedNetVolumeMm3: 0, shellVolumeMm3: 0, infillVolumeMm3: 0, solidVolumeMm3: 0 };

    const infill = Math.max(0, Math.min(100, num(infillPercent, 15)));
    if (infill >= 100) {
      return { slicedNetVolumeMm3: vol, shellVolumeMm3: vol, infillVolumeMm3: 0, solidVolumeMm3: vol };
    }

    if (wallCount <= 1 && infill === 0) {
      const area = surfaceAreaMm2 > 0 ? surfaceAreaMm2 : 6 * Math.pow(vol, 2 / 3);
      const estC = Math.pow(vol / 100, 2 / 3) * 16;
      const shellVal = area * 0.5 * 0.52;
      const minVal = Math.min(vol * 0.25, Math.max(5200, estC * 1.5));
      const res = Math.min(vol, shellVal + minVal);
      return { slicedNetVolumeMm3: res, shellVolumeMm3: res, infillVolumeMm3: 0, solidVolumeMm3: vol };
    }

    const wallThickness = Math.max(1, wallCount) * 0.45 + 0.35;
    const surfArea = surfaceAreaMm2 > 0 ? surfaceAreaMm2 : 6 * Math.pow(vol, 2 / 3);
    const ratio = (surfArea * wallThickness) / (2 * vol);

    let shellRatio;
    if (ratio >= 1) {
      shellRatio = Math.min(0.96, 0.5 + 0.45 * Math.min(1, ratio - 1));
    } else {
      shellRatio = 1 - Math.pow(1 - ratio, 2.2);
    }

    const shellVolumeMm3 = Math.min(vol, vol * shellRatio);
    const infillVolumeMm3 = Math.max(0, vol - shellVolumeMm3) * (infill / 100);
    const slicedNetVolumeMm3 = shellVolumeMm3 + infillVolumeMm3;

    return {
      slicedNetVolumeMm3: round(slicedNetVolumeMm3, 1),
      shellVolumeMm3: round(shellVolumeMm3, 1),
      infillVolumeMm3: round(infillVolumeMm3, 1),
      solidVolumeMm3: round(vol, 1)
    };
  }

  /**
   * حساب وزن وحجم خامة الدعم (Supports)
   */
  function calculateSupportWaste(volumeMm3, supportType = 'none', customPercent = 15, manualSupportVolumeMm3) {
    const vol = pos(volumeMm3);
    if (manualSupportVolumeMm3 !== undefined && manualSupportVolumeMm3 !== null && manualSupportVolumeMm3 >= 0) {
      const supVol = num(manualSupportVolumeMm3);
      const pct = vol > 0 ? (supVol / vol) * 100 : 0;
      return { supportVolumeMm3: round(supVol, 1), supportWastePercent: round(pct, 1) };
    }

    switch (supportType) {
      case 'tree': {
        const pct = 12;
        return { supportVolumeMm3: round(vol * (pct / 100), 1), supportWastePercent: pct };
      }
      case 'normal':
      case 'grid': {
        const pct = 22;
        return { supportVolumeMm3: round(vol * (pct / 100), 1), supportWastePercent: pct };
      }
      case 'custom': {
        const pct = Math.max(0, num(customPercent, 15));
        return { supportVolumeMm3: round(vol * (pct / 100), 1), supportWastePercent: pct };
      }
      case 'none':
      default:
        return { supportVolumeMm3: 0, supportWastePercent: 0 };
    }
  }

  /**
   * حساب هدر الألوان المتعددة (Multi-Color Purge / Prime Tower)
   */
  function calculateMultiColorWaste(cfg = {}, layerCount = 1, layerHeightMm = 0.2) {
    if (!cfg.enabled || num(cfg.colorSwapsCount) <= 0) {
      return { flushVolumeMm3: 0, primeTowerVolumeMm3: 0, totalMultiColorWasteVolumeMm3: 0 };
    }

    const flushPerSwap = num(cfg.flushVolumePerSwapMm3, 300);
    const flushVolumeMm3 = num(cfg.colorSwapsCount) * flushPerSwap;

    let primeTowerVolumeMm3 = 0;
    if (cfg.primeTowerEnabled !== false) {
      if (cfg.manualPrimeTowerVolumeMm3 !== undefined && cfg.manualPrimeTowerVolumeMm3 >= 0) {
        primeTowerVolumeMm3 = num(cfg.manualPrimeTowerVolumeMm3);
      } else {
        const footprint = num(cfg.primeTowerFootprintAreaMm2, 225); // 15x15mm default
        const densityFactor = num(cfg.primeTowerDensityFactor, 0.25);
        const height = Math.max(1, layerCount) * Math.max(0.05, layerHeightMm);
        primeTowerVolumeMm3 = footprint * height * densityFactor;
      }
    }

    return {
      flushVolumeMm3: round(flushVolumeMm3, 1),
      primeTowerVolumeMm3: round(primeTowerVolumeMm3, 1),
      totalMultiColorWasteVolumeMm3: round(flushVolumeMm3 + primeTowerVolumeMm3, 1)
    };
  }

  /**
   * محاكاة رص القطع على مساحة سطح الطباعة وحساب عدد الألواح (Plates)
   */
  function calculatePlateNesting(footprintMm = { x: 50, y: 50 }, heightMm = 50, bedSizeMm = { x: 256, y: 256, z: 256 }, hasPrimeTower = false) {
    if (num(heightMm) > num(bedSizeMm.z, 256)) return 0;
    const fx = pos(footprintMm?.x, 50);
    const fy = pos(footprintMm?.y, 50);
    if (fx <= 0 || fy <= 0) return 1;

    const gap = 5; // mm spacing between parts
    const primeTowerAllowance = hasPrimeTower ? 35 : 0;
    const bedX = Math.max(10, num(bedSizeMm.x, 256) - primeTowerAllowance);
    const bedY = Math.max(10, num(bedSizeMm.y, 256));

    const fit = (w, d) => Math.max(0, Math.floor((bedX + gap) / (w + gap))) * Math.max(0, Math.floor((bedY + gap) / (d + gap)));
    const maxPieces = Math.max(1, Math.max(fit(fx, fy), fit(fy, fx)));
    return maxPieces;
  }

  /**
   * تخمين زمن الطباعة الحركي بناء على سرعة التدفق وتسارع الطابعة أو التجاوز اليدوي
   */
  function estimatePrintTime(options = {}) {
    if (options.manualOverride) {
      const h = pos(options.manualHours, 0);
      const m = pos(options.manualMinutes, 0);
      const totalSec = h * 3600 + m * 60;
      return {
        totalTimeSeconds: totalSec,
        totalTimeHours: round(totalSec / 3600, 2),
        formattedDuration: formatSeconds(totalSec),
        isManualOverride: true
      };
    }

    const netVol = pos(options.netVolumeMm3);
    const supVol = pos(options.supportVolumeMm3);
    const towerVol = pos(options.primeTowerVolumeMm3);
    const totalExtrusionVol = netVol + supVol + towerVol;

    const maxFlow = pos(options.maxVolumetricFlowMm3PerS, 18);
    const kinematicEff = Math.max(0.2, Math.min(0.95, pos(options.kinematicEfficiency, 0.7)));
    const effectiveFlow = maxFlow * kinematicEff;

    const layerCount = Math.max(1, pos(options.layerCount, 1));
    const volPerLayer = totalExtrusionVol / layerCount;
    const extrusionSecPerLayer = effectiveFlow > 0 ? (volPerLayer / effectiveFlow) : 0;

    const layerChangeSec = num(options.layerChangeOverheadSeconds, 2.5);
    const totalExtrusionSec = layerCount * Math.max(layerChangeSec, extrusionSecPerLayer);
    const layerOverheadSec = layerCount * layerChangeSec;

    let toolChangeSec = 0;
    if (options.colorSwapsCount > 0) {
      const toolSec = num(options.toolChangeOverheadSeconds, 70);
      toolChangeSec = options.colorSwapsCount * toolSec;
    }

    const warmupSec = pos(options.preheatWarmupMinutes, 5) * 60;
    const totalSec = totalExtrusionSec + layerOverheadSec + toolChangeSec + warmupSec;

    return {
      extrusionTimeSeconds: Math.round(totalExtrusionSec),
      layerOverheadSeconds: Math.round(layerOverheadSec),
      toolChangeTimeSeconds: Math.round(toolChangeSec),
      preheatWarmupSeconds: Math.round(warmupSec),
      totalTimeSeconds: Math.round(totalSec),
      totalTimeHours: round(totalSec / 3600, 2),
      formattedDuration: formatSeconds(totalSec),
      isManualOverride: false
    };
  }

  function formatSeconds(sec) {
    const s = Math.max(0, Math.round(sec));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const remS = s % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${remS}s`;
    return `${remS}s`;
  }

  /**
   * محلل ملفات STL ثلاثية الأبعاد (Binary & ASCII STL Parser)
   * يحسب الحجم والسطح والأبعاد وعدد المثلثات
   * @param {ArrayBuffer|Buffer} buffer
   */
  function parseSTL(buffer) {
    const dataView = new DataView(buffer instanceof ArrayBuffer ? buffer : buffer.buffer, buffer.byteOffset || 0, buffer.byteLength);
    const byteLength = dataView.byteLength;
    if (byteLength < 84) {
      throw new Error('Invalid STL file: size too small');
    }

    // فحص ما إذا كان الملف Binary أو ASCII
    let isBinary = true;
    const expectedTriangles = dataView.getUint32(80, true);
    const expectedBinarySize = 84 + expectedTriangles * 50;

    if (byteLength !== expectedBinarySize) {
      // قد يكون ASCII، نتحقق من أول 100 حرف
      const textHeader = new TextDecoder('ascii').decode(new Uint8Array(buffer, 0, Math.min(byteLength, 128)));
      if (textHeader.trim().toLowerCase().startsWith('solid') && !textHeader.includes('\0')) {
        isBinary = false;
      }
    }

    if (isBinary) {
      return parseBinarySTL(dataView, expectedTriangles);
    } else {
      const text = new TextDecoder('utf-8').decode(buffer);
      return parseAsciiSTL(text);
    }
  }

  function parseBinarySTL(dv, triangleCount) {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let signedVolume = 0;
    let surfaceArea = 0;

    let offset = 84;
    const totalTris = Math.min(triangleCount, Math.floor((dv.byteLength - 84) / 50));

    for (let i = 0; i < totalTris; i++) {
      // Normal vector (skipped, 12 bytes)
      offset += 12;

      // Vertex 1
      const x1 = dv.getFloat32(offset, true); offset += 4;
      const y1 = dv.getFloat32(offset, true); offset += 4;
      const z1 = dv.getFloat32(offset, true); offset += 4;

      // Vertex 2
      const x2 = dv.getFloat32(offset, true); offset += 4;
      const y2 = dv.getFloat32(offset, true); offset += 4;
      const z2 = dv.getFloat32(offset, true); offset += 4;

      // Vertex 3
      const x3 = dv.getFloat32(offset, true); offset += 4;
      const y3 = dv.getFloat32(offset, true); offset += 4;
      const z3 = dv.getFloat32(offset, true); offset += 4;

      // Attribute byte count (2 bytes)
      offset += 2;

      // Bounding box
      minX = Math.min(minX, x1, x2, x3); maxX = Math.max(maxX, x1, x2, x3);
      minY = Math.min(minY, y1, y2, y3); maxY = Math.max(maxY, y1, y2, y3);
      minZ = Math.min(minZ, z1, z2, z3); maxZ = Math.max(maxZ, z1, z2, z3);

      // Signed volume of tetrahedron
      signedVolume += (x1 * (y2 * z3 - y3 * z2) - y1 * (x2 * z3 - x3 * z2) + z1 * (x2 * y3 - x3 * y2)) / 6;

      // Triangle surface area (Cross product)
      const ax = x2 - x1, ay = y2 - y1, az = z2 - z1;
      const bx = x3 - x1, by = y3 - y1, bz = z3 - z1;
      const cx = ay * bz - az * by;
      const cy = az * bx - ax * bz;
      const cz = ax * by - ay * bx;
      surfaceArea += 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
    }

    const width = maxX > minX ? (maxX - minX) : 0;
    const depth = maxY > minY ? (maxY - minY) : 0;
    const height = maxZ > minZ ? (maxZ - minZ) : 0;
    const volumeMm3 = Math.abs(signedVolume);

    return {
      triangleCount: totalTris,
      vertexCount: totalTris * 3,
      dimensions: {
        width: round(width, 2),
        depth: round(depth, 2),
        height: round(height, 2)
      },
      volumeMm3: round(volumeMm3, 2),
      volumeCm3: round(volumeMm3 / 1000, 3),
      surfaceAreaMm2: round(surfaceArea, 2),
      surfaceAreaCm2: round(surfaceArea / 100, 2)
    };
  }

  function parseAsciiSTL(text) {
    const vertexRegex = /vertex\s+([+-]?\d*(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+([+-]?\d*(?:\.\d+)?(?:[eE][+-]?\d+)?)\s+([+-]?\d*(?:\.\d+)?(?:[eE][+-]?\d+)?)/gi;
    let match;
    const vertices = [];

    while ((match = vertexRegex.exec(text)) !== null) {
      vertices.push({
        x: parseFloat(match[1]),
        y: parseFloat(match[2]),
        z: parseFloat(match[3])
      });
    }

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    let signedVolume = 0;
    let surfaceArea = 0;
    const totalTris = Math.floor(vertices.length / 3);

    for (let i = 0; i < totalTris; i++) {
      const v1 = vertices[i * 3];
      const v2 = vertices[i * 3 + 1];
      const v3 = vertices[i * 3 + 2];

      minX = Math.min(minX, v1.x, v2.x, v3.x); maxX = Math.max(maxX, v1.x, v2.x, v3.x);
      minY = Math.min(minY, v1.y, v2.y, v3.y); maxY = Math.max(maxY, v1.y, v2.y, v3.y);
      minZ = Math.min(minZ, v1.z, v2.z, v3.z); maxZ = Math.max(maxZ, v1.z, v2.z, v3.z);

      signedVolume += (v1.x * (v2.y * v3.z - v3.y * v2.z) - v1.y * (v2.x * v3.z - v3.x * v2.z) + v1.z * (v2.x * v3.y - v3.x * v2.y)) / 6;

      const ax = v2.x - v1.x, ay = v2.y - v1.y, az = v2.z - v1.z;
      const bx = v3.x - v1.x, by = v3.y - v1.y, bz = v3.z - v1.z;
      const cx = ay * bz - az * by;
      const cy = az * bx - ax * bz;
      const cz = ax * by - ay * bx;
      surfaceArea += 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
    }

    const width = maxX > minX ? (maxX - minX) : 0;
    const depth = maxY > minY ? (maxY - minY) : 0;
    const height = maxZ > minZ ? (maxZ - minZ) : 0;
    const volumeMm3 = Math.abs(signedVolume);

    return {
      triangleCount: totalTris,
      vertexCount: totalTris * 3,
      dimensions: {
        width: round(width, 2),
        depth: round(depth, 2),
        height: round(height, 2)
      },
      volumeMm3: round(volumeMm3, 2),
      volumeCm3: round(volumeMm3 / 1000, 3),
      surfaceAreaMm2: round(surfaceArea, 2),
      surfaceAreaCm2: round(surfaceArea / 100, 2)
    };
  }

  function parseGCode(text) {
    if (typeof text !== 'string') return null;

    let filamentGrams = 0;
    let printTimeSeconds = 0;
    let layerHeight = 0.2;

    // 1. Filament weight in grams
    const mG = text.match(/;\s*(?:total\s+)?filament\s+used\s*\[g\]\s*=\s*([\d.]+)/i) ||
               text.match(/;\s*filament_used_g\s*=\s*([\d.]+)/i) ||
               text.match(/;\s*(?:total_)?filament_weight\s*[:=]\s*([\d.]+)/i) ||
               text.match(/;\s*material_weight\s*[:=]\s*([\d.]+)/i) ||
               text.match(/;\s*Filament used:\s*([\d.]+)\s*g/i) ||
               text.match(/;\s*Filament used:\s*([\d.]+)\s*grams/i) ||
               text.match(/;\s*Filament weight\s*[:=]\s*([\d.]+)\s*g/i);

    if (mG) {
      filamentGrams = parseFloat(mG[1]);
    } else {
      // Volume in cm3
      const mCm3 = text.match(/;\s*filament\s+used\s*\[cm3\]\s*=\s*([\d.]+)/i) ||
                   text.match(/;\s*Filament volume\s*[:=]\s*([\d.]+)\s*cm3/i);
      if (mCm3) {
        filamentGrams = parseFloat(mCm3[1]) * 1.24;
      } else {
        // Length in meters for 1.75mm filament
        const mM = text.match(/;\s*Filament used:\s*([\d.]+)\s*m\b/i) ||
                   text.match(/;\s*Filament length\s*[:=]\s*([\d.]+)\s*m\b/i);
        if (mM) {
          filamentGrams = parseFloat(mM[1]) * 2.98;
        } else {
          const mMm = text.match(/;\s*(?:total\s+)?filament\s+used\s*\[mm\]\s*=\s*([\d.]+)/i) ||
                      text.match(/;\s*Filament used:\s*([\d.]+)\s*mm\b/i) ||
                      text.match(/;\s*Filament length\s*[:=]\s*([\d.]+)\s*mm\b/i);
          if (mMm) filamentGrams = (parseFloat(mMm[1]) / 1000.0) * 2.98;
        }
      }
    }

    // 2. Print time in seconds
    const mSec = text.match(/;\s*(?:TIME|print_time|PRINT\.TIME|TIME_ELAPSED)\s*:\s*(\d+)/i) ||
                 text.match(/;\s*estimated printing time[^=]*=\s*(\d+)\s*s/i);
    if (mSec) {
      printTimeSeconds = parseInt(mSec[1], 10);
    } else {
      const mStr = text.match(/;\s*(?:estimated printing time|model printing time|total estimated time|Build time|Print time)[^=:]*[=:]\s*([^\n\r]+)/i);
      if (mStr) {
        const raw = mStr[1];
        let h = 0, m = 0, s = 0;
        const hM = raw.match(/(\d+)\s*(?:h|hour|hours|ساعة|ساعات)/i);
        const mM = raw.match(/(\d+)\s*(?:m|min|minute|minutes|دقيقة|دقائق)/i);
        const sM = raw.match(/(\d+)\s*(?:s|sec|second|seconds|ثانية)/i);
        if (hM) h = parseInt(hM[1], 10);
        if (mM) m = parseInt(mM[1], 10);
        if (sM) s = parseInt(sM[1], 10);
        printTimeSeconds = h * 3600 + m * 60 + s;
      }
    }

    // 3. Layer height
    const mLayer = text.match(/;\s*(?:layer_height|Layer height)\s*[:=]\s*([\d.]+)/i);
    if (mLayer) {
      layerHeight = parseFloat(mLayer[1]);
    }

    return {
      filamentGrams: round(filamentGrams, 2),
      printTimeSeconds: printTimeSeconds,
      printHours: round(printTimeSeconds / 3600, 2),
      layerHeight: round(layerHeight, 2)
    };
  }

  return {
    calculateCost,
    compareEstimatedVsActual,
    quantityDiscountPct,
    round,
    sliceVolume,
    calculateSupportWaste,
    calculateMultiColorWaste,
    calculatePlateNesting,
    estimatePrintTime,
    parseSTL,
    parseGCode
  };
});

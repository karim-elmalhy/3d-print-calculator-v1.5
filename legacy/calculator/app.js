// ==========================================
// 3D Printing Cost Calculator Engine — Complete Master Suite
// Designed for Elegoo Neptune 4 Pro — Egyptian Market 🇪🇬
// ==========================================

// ---- Customer Orders Backend (Google Sheets + Apps Script) ----
// اتبع خطوات backend/Code.gs عشان تعمل الإعداد، وحط نفس الرابط والكلمة السرية هنا
const CUSTOMER_ORDERS_CONFIG = {
  appsScriptUrl: 'PASTE_YOUR_DEPLOYED_WEB_APP_URL_HERE'
  // لا توجد كلمة سر هنا: الأدمن بيدخلها وقت الاستخدام (sessionStorage) وبتتخزن في Script Properties
};

function escapeHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function safeDriveLink(u) {
  return /^https:\/\/(drive|docs)\.google\.com\//.test(String(u || '')) ? String(u) : '';
}
function getAdminKey(forcePrompt) {
  let k = sessionStorage.getItem('3d_admin_key');
  if (!k || forcePrompt) {
    k = prompt('أدخل كلمة سر الأدمن:') || '';
    if (k) sessionStorage.setItem('3d_admin_key', k); else sessionStorage.removeItem('3d_admin_key');
  }
  return k;
}

const DEFAULT_STATE = {
  // Project & Client Info
  projectName: '',
  clientName: '',
  clientPhone: '',
  clientAddress: '',
  selectedGovernorate: 'cairo-giza',
  shippingCost: 50,
  depositPaid: 0,
  deliveryDueDate: '',
  paymentMethod: 'cash',
  orderStatus: 'ready_print',
  partImageBase64: '',
  notes: '',

  // Part Specifications
  partColor: 'أسود (Black)',
  layerHeight: '0.20 مم (قياسي)',
  infillPercent: 20,
  supportsType: 'شجرية (Tree Supports)',
  cadDesignHours: 0,
  cadDesignRatePerHour: 150.00,

  // Material (Filament)
  selectedFilamentPreset: 'patron-pla',
  partWeight: 0.00,
  spoolPrice: 600.00,
  spoolWeight: 1000,
  spoolRemaining: 1000,
  activeSpoolId: null,

  // Electricity
  selectedPowerPreset: 'residential-tier-3',
  printHours: 0.00,
  printerPowerKw: 0.16,
  electricityRate: 1.51,

  // Machine Depreciation
  selectedPrinterPreset: 'neptune-4-pro',
  printerPrice: 26000.00,
  printerLifespanHours: 5000,

  // Labor
  laborHours: 0.00,
  laborRatePerHour: 100.00,

  // Failure & Margins
  failureRatePercent: 10.0,
  profitMarginPercent: 40.0,
  batchQuantity: 1,
  additionalCost: 0.00,
  additionalCostNotes: '',

  // إضافات التسعير v2
  setupFee: 0,
  postProcessCost: 0,
  consumablesPerHour: 0,
  minOrderPrice: 0,
  discountTiers: [{ min: 10, pct: 5 }, { min: 50, pct: 12 }],
  fxRates: {},
  fixedExpenses: [{ name: 'إيجار / مساحة', monthly: 0 }, { name: 'إنترنت وبرامج', monthly: 0 }],
  monthlyPrintHours: 100,

  // VAT (Value Added Tax) — Optional
  includeVAT: false,
  vatPercent: 14.0,

  // Marketing & Customer Acquisition Cost (CAC) — Optional
  includeMarketingCost: false,
  marketingType: 'percent', // 'percent' or 'fixed'
  marketingPercent: 10.0,
  marketingFixedAmount: 25.00,

  // Multi-Part Assembly
  partsList: [],
  multiPartMode: false,

  // Currency & UI
  selectedCurrency: 'EGP',
  darkMode: true,
  activeTab: 'table'
};

const PRICING_TEMPLATES = {
  'economy': {
    name: 'اقتصادي — Economy',
    profitMarginPercent: 25,
    layerHeight: '0.28 مم (سريع)',
    infillPercent: 15,
    failureRatePercent: 12
  },
  'standard': {
    name: 'قياسي — Standard',
    profitMarginPercent: 40,
    layerHeight: '0.20 مم (قياسي)',
    infillPercent: 20,
    failureRatePercent: 10
  },
  'professional': {
    name: 'احترافي — Professional',
    profitMarginPercent: 55,
    layerHeight: '0.12 مم (تفاصيل دقيقة جداً)',
    infillPercent: 40,
    failureRatePercent: 8
  },
  'industrial': {
    name: 'صناعي — Industrial',
    profitMarginPercent: 50,
    layerHeight: '0.20 مم (قياسي)',
    infillPercent: 60,
    failureRatePercent: 5
  }
};

const CURRENCY_RATES = {
  EGP: { symbol: 'ج.م', rate: 1.0 },
  SAR: { symbol: 'ر.س', rate: 0.078 },
  AED: { symbol: 'د.إ', rate: 0.076 },
  USD: { symbol: '$', rate: 0.021 }
};

class CostCalculatorApp {
  constructor() {
    this.state = this.loadState();
    this.savedProjects = this.loadSavedProjects();
    this.spoolInventory = this.loadSpoolInventory();
    this.spoolMovementLog = this.loadSpoolMovementLog();
    this.customerOrders = [];
    this.currentSavedFilter = 'all';
    this.currentSavedSearchTerm = '';
    this.threeScene = null;
    this.threeRenderer = null;
    this.threeCamera = null;
    this.threeControls = null;
    this.threeMesh = null;
    this.customSTLLoaded = false;
    this.charts = {};

    this.init();
  }

  loadState() {
    try {
      const saved = localStorage.getItem('3d_calc_master_suite_v2');
      if (saved) return { ...DEFAULT_STATE, ...JSON.parse(saved) };
    } catch (e) {
      console.warn('Could not load saved state:', e);
    }
    return { ...DEFAULT_STATE };
  }

  saveState() {
    try {
      localStorage.setItem('3d_calc_master_suite_v2', JSON.stringify(this.state));
    } catch (e) {
      console.warn('Could not save state:', e);
    }
  }

  loadSavedProjects() {
    try {
      const saved = localStorage.getItem('3d_calc_master_saved_projects_v2');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not load saved projects:', e);
    }
    return [];
  }

  saveProjectsToStorage() {
    try {
      localStorage.setItem('3d_calc_master_saved_projects_v2', JSON.stringify(this.savedProjects));
    } catch (e) {
      console.warn('Could not save projects list:', e);
    }
  }

  loadSpoolInventory() {
    try {
      const saved = localStorage.getItem('3d_calc_spool_inventory_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not load spool inventory:', e);
    }
    return [];
  }

  saveSpoolInventoryToStorage() {
    try {
      localStorage.setItem('3d_calc_spool_inventory_v1', JSON.stringify(this.spoolInventory));
    } catch (e) {
      console.warn('Could not save spool inventory:', e);
    }
  }

  loadSpoolMovementLog() {
    try {
      const saved = localStorage.getItem('3d_calc_spool_log_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Could not load spool movement log:', e);
    }
    return [];
  }

  saveSpoolMovementLogToStorage() {
    try {
      localStorage.setItem('3d_calc_spool_log_v1', JSON.stringify(this.spoolMovementLog));
    } catch (e) {
      console.warn('Could not save spool movement log:', e);
    }
  }

  init() {
    Object.entries(this.state.fxRates || {}).forEach(([k, r]) => { if (CURRENCY_RATES[k] && r > 0) CURRENCY_RATES[k].rate = r; });
    this.applyTheme();
    this.populatePresets();
    this.setupEventListeners();
    this.mountExtrasPanel();
    this.mountReportsPanel();
    this.mountOrdersViewToggle();
    this.populateClientAutocomplete();
    this.render();
    this.renderSavedProjectsList();
    this.renderSpoolInventory();
    this.renderSpoolMovementLog();
    this.checkDeadlineAlerts();
    if (this.isCustomerOrdersConfigured()) this.fetchCustomerOrders();
    setTimeout(() => this.init3DScene(), 150);
    window.addEventListener('resize', () => this.handleWindowResize());

    // PWA Mobile Install Event Listener
    window.deferredPWAInstallPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      window.deferredPWAInstallPrompt = e;
      const installBtn = document.getElementById('pwaInstallBtn');
      const installBanner = document.getElementById('pwaInstallBanner');
      if (installBtn) installBtn.style.display = 'flex';
      if (installBanner) installBanner.style.display = 'flex';
    });

    window.addEventListener('appinstalled', () => {
      window.deferredPWAInstallPrompt = null;
      const installBanner = document.getElementById('pwaInstallBanner');
      if (installBanner) installBanner.style.display = 'none';
      this.showToast('🎉 تم تثبيت حاسبة 3D كـ تطبيق على هاتفك بنجاح!');
    });
  }

  // ================= 1. CALCULATION ENGINE =================
  calculate() {
    return CalcEngine.calculateCost(this.state);
  }

  formatCurrency(val) {
    const cur = CURRENCY_RATES[this.state.selectedCurrency] || CURRENCY_RATES.EGP;
    const converted = (Number(val) || 0) * cur.rate;
    return `${converted.toFixed(2)} ${cur.symbol}`;
  }

  // ================= 2. POPULATE PRESETS =================
  populatePresets() {
    // Filaments Dropdowns
    const filamentOptions = `
      <optgroup label="🇪🇬 خامات باترون مصرية (Patron 3D)">
        ${PRESETS.filaments.filter(f => f.isLocal).map(f => `<option value="${f.id}">${f.name} — ${f.price} ج.م</option>`).join('')}
      </optgroup>
      <optgroup label="🌐 خامات مستوردة (eSUN)">
        ${PRESETS.filaments.filter(f => !f.isLocal).map(f => `<option value="${f.id}">${f.name} — ${f.price} ج.م</option>`).join('')}
      </optgroup>
    `;

    ['filamentPresetSelect', 'filamentPresetSelectMobile', 'tbl_filamentPresetSelect'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = filamentOptions;
    });

    // Printers
    const pSelect = document.getElementById('printerPresetSelect');
    if (pSelect) {
      pSelect.innerHTML = PRESETS.printers.map(p => `<option value="${p.id}">${p.name} (${p.price} ج.م)</option>`).join('');
    }

    // Electricity Tiers
    const eSelect = document.getElementById('electricityTierSelect');
    if (eSelect) {
      eSelect.innerHTML = PRESETS.electricityTiers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    }

    // Shipping Governorates
    const govSelect = document.getElementById('dash_shippingGovSelect');
    if (govSelect && PRESETS.shippingGovernorates) {
      govSelect.innerHTML = PRESETS.shippingGovernorates.map(g => `<option value="${g.id}">${g.name} (${g.cost} ج.م)</option>`).join('');
    }

    // Colors
    const colorSelect = document.getElementById('dash_partColorSelect');
    if (colorSelect && PRESETS.colors) {
      colorSelect.innerHTML = PRESETS.colors.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    // Multi-Spool Inventory Form Selects
    const newSpoolFilamentSelect = document.getElementById('newSpoolFilamentSelect');
    if (newSpoolFilamentSelect) newSpoolFilamentSelect.innerHTML = filamentOptions;
    const newSpoolColorSelect = document.getElementById('newSpoolColorSelect');
    if (newSpoolColorSelect && PRESETS.colors) {
      newSpoolColorSelect.innerHTML = PRESETS.colors.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    // Hardware Accessories
    const hwSelect = document.getElementById('hardwareQuickAddSelect');
    if (hwSelect && PRESETS.hardwareAccessories) {
      hwSelect.innerHTML = PRESETS.hardwareAccessories.map(h => `<option value="${h.id}">${h.name} (${h.cost} ج.م)</option>`).join('');
    }
  }

  // ================= 3. EVENT LISTENERS =================
  setupEventListeners() {
    const handleInput = (key, val, type = 'float') => {
      let parsed = val;
      if (type === 'float') parsed = parseFloat(val) || 0;
      else if (type === 'int') parsed = parseInt(val, 10) || 0;
      this.state[key] = parsed;
      this.render();
    };

    // Marketing Event Listeners
    const handleMarketingToggle = (e) => {
      this.state.includeMarketingCost = e.target.checked;
      this.render();
      this.showToast(this.state.includeMarketingCost ? '📢 تم تفعيل احتساب تكلفة التسويق والإعلانات' : '⏹️ تم إلغاء تكلفة التسويق');
    };

    ['tbl_includeMarketing', 'dash_includeMarketing'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', handleMarketingToggle);
    });

    // VAT Event Listener
    const vatToggle = document.getElementById('dash_includeVAT');
    if (vatToggle) {
      vatToggle.addEventListener('change', (e) => {
        this.state.includeVAT = e.target.checked;
        this.render();
        this.showToast(this.state.includeVAT ? '🧾 تم تفعيل احتساب ضريبة القيمة المضافة' : '⏹️ تم إلغاء ضريبة القيمة المضافة');
      });
    }
    const vatPercentInput = document.getElementById('dash_vatPercent');
    if (vatPercentInput) {
      vatPercentInput.addEventListener('input', (e) => handleInput('vatPercent', e.target.value));
    }

    const handleMarketingType = (e) => {
      this.state.marketingType = e.target.value;
      this.render();
    };

    ['tbl_marketingType', 'dash_marketingType'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', handleMarketingType);
    });

    // Table Inputs
    const tableBindings = [
      { id: 'tbl_partWeight', key: 'partWeight' },
      { id: 'tbl_spoolPrice', key: 'spoolPrice' },
      { id: 'tbl_printHours', key: 'printHours' },
      { id: 'tbl_printerPowerKw', key: 'printerPowerKw' },
      { id: 'tbl_electricityRate', key: 'electricityRate' },
      { id: 'tbl_printerPrice', key: 'printerPrice' },
      { id: 'tbl_printerLifespanHours', key: 'printerLifespanHours' },
      { id: 'tbl_laborHours', key: 'laborHours' },
      { id: 'tbl_laborRatePerHour', key: 'laborRatePerHour' },
      { id: 'tbl_failureRatePercent', key: 'failureRatePercent' },
      { id: 'tbl_profitMarginPercent', key: 'profitMarginPercent' },
      { id: 'tbl_marketingPercent', key: 'marketingPercent' },
      { id: 'tbl_marketingFixedAmount', key: 'marketingFixedAmount' }
    ];

    tableBindings.forEach(b => {
      const el = document.getElementById(b.id);
      if (el) el.addEventListener('input', (e) => handleInput(b.key, e.target.value));
    });

    // Client & Order Inputs
    const clientBindings = [
      { id: 'dash_projectName', key: 'projectName', type: 'string' },
      { id: 'dash_clientName', key: 'clientName', type: 'string' },
      { id: 'dash_clientPhone', key: 'clientPhone', type: 'string' },
      { id: 'dash_clientAddress', key: 'clientAddress', type: 'string' },
      { id: 'dash_shippingCost', key: 'shippingCost' },
      { id: 'dash_depositPaid', key: 'depositPaid' },
      { id: 'dash_deliveryDueDate', key: 'deliveryDueDate', type: 'string' },
      { id: 'dash_paymentMethodSelect', key: 'paymentMethod', type: 'string' },
      { id: 'dash_orderStatusSelect', key: 'orderStatus', type: 'string' },
      { id: 'dash_infillPercent', key: 'infillPercent', type: 'int' },
      { id: 'dash_cadDesignHours', key: 'cadDesignHours' },
      { id: 'dash_cadDesignRatePerHour', key: 'cadDesignRatePerHour' },
      { id: 'dash_batchQuantity', key: 'batchQuantity', type: 'int' },
      { id: 'dash_marketingPercent', key: 'marketingPercent' },
      { id: 'dash_marketingFixedAmount', key: 'marketingFixedAmount' },
      { id: 'dash_spoolRemaining', key: 'spoolRemaining' }
    ];

    clientBindings.forEach(b => {
      const el = document.getElementById(b.id);
      if (el) el.addEventListener('input', (e) => handleInput(b.key, e.target.value, b.type));
    });

    // Client Autocomplete Listeners
    const clientNameInput = document.getElementById('dash_clientName');
    if (clientNameInput) {
      clientNameInput.addEventListener('change', (e) => this.handleClientSelect(e.target.value));
    }

    // Shipping Governorate Select
    const govSelect = document.getElementById('dash_shippingGovSelect');
    if (govSelect) {
      govSelect.addEventListener('change', (e) => {
        const item = PRESETS.shippingGovernorates.find(g => g.id === e.target.value);
        if (item) {
          this.state.selectedGovernorate = item.id;
          this.state.shippingCost = item.cost;
          this.render();
          this.showToast(`🚚 تكلفة الشحن: ${item.name} (${item.cost} ج.م)`);
        }
      });
    }

    // Part Color Select
    const colorSelect = document.getElementById('dash_partColorSelect');
    if (colorSelect) {
      colorSelect.addEventListener('change', (e) => {
        this.state.partColor = e.target.value;
        this.render();
      });
    }

    // Layer Height Select
    const layerSelect = document.getElementById('dash_layerHeightSelect');
    if (layerSelect) {
      layerSelect.addEventListener('change', (e) => {
        this.state.layerHeight = e.target.value;
        this.render();
      });
    }

    // Supports Type Select
    const suppSelect = document.getElementById('dash_supportsTypeSelect');
    if (suppSelect) {
      suppSelect.addEventListener('change', (e) => {
        this.state.supportsType = e.target.value;
        this.render();
      });
    }

    // Hardware Quick Add Select
    const hwSelect = document.getElementById('hardwareQuickAddSelect');
    if (hwSelect) {
      hwSelect.addEventListener('change', (e) => {
        const item = PRESETS.hardwareAccessories.find(h => h.id === e.target.value);
        if (item && item.cost > 0) {
          this.state.additionalCost = (Number(this.state.additionalCost) || 0) + item.cost;
          this.state.additionalCostNotes = (this.state.additionalCostNotes ? this.state.additionalCostNotes + ' + ' : '') + item.name;
          this.render();
          this.showToast(`🔩 تمت إضافة: ${item.name} (+${item.cost} ج.م)`);
        }
      });
    }

    // Image Upload Listener
    const imgInput = document.getElementById('dash_partImageInput');
    if (imgInput) {
      imgInput.addEventListener('change', (e) => this.handlePartImageUpload(e));
    }

    // Currency Switcher
    const curSelect = document.getElementById('currencySelect');
    if (curSelect) {
      curSelect.addEventListener('change', (e) => {
        this.state.selectedCurrency = e.target.value;
        this.render();
      });
    }

    // Filament Presets Listeners
    const handleFilamentChange = (e) => {
      const item = PRESETS.filaments.find(f => f.id === e.target.value);
      if (item) {
        this.state.selectedFilamentPreset = item.id;
        this.state.spoolPrice = item.price;
        this.state.spoolWeight = item.weight;
        this.render();
        this.showToast(`✨ تم اختيار: ${item.name} (${item.price} ج.م)`);
      }
    };

    ['filamentPresetSelect', 'filamentPresetSelectMobile', 'tbl_filamentPresetSelect'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', handleFilamentChange);
    });

    // Printer Presets Listener
    const pSelect = document.getElementById('printerPresetSelect');
    if (pSelect) {
      pSelect.addEventListener('change', (e) => {
        const item = PRESETS.printers.find(p => p.id === e.target.value);
        if (item) {
          this.state.selectedPrinterPreset = item.id;
          this.state.printerPrice = item.price;
          this.state.printerLifespanHours = item.lifespanHours;
          this.state.printerPowerKw = item.powerKw;
          this.render();
          this.showToast(`🖨️ تم اختيار طابعة: ${item.name}`);
        }
      });
    }

    // Electricity Tier Listener
    const eSelect = document.getElementById('electricityTierSelect');
    if (eSelect) {
      eSelect.addEventListener('change', (e) => {
        const item = PRESETS.electricityTiers.find(t => t.id === e.target.value);
        if (item) {
          this.state.selectedPowerPreset = item.id;
          this.state.electricityRate = item.rate;
          this.render();
          this.showToast(`⚡ تم اختيار شريحة كهرباء: ${item.rate} ج.م/ك.و.س`);
        }
      });
    }
  }

  // ================= 4. RENDER METHOD =================
  render() {
    const res = this.calculate();
    const s = this.state;

    // 1. Synchronize Table View Inputs
    this.updateElementValue('tbl_partWeight', s.partWeight);
    this.updateElementValue('tbl_spoolPrice', s.spoolPrice);
    this.updateElementValue('tbl_printHours', s.printHours);
    this.updateElementValue('tbl_printerPowerKw', s.printerPowerKw);
    this.updateElementValue('tbl_electricityRate', s.electricityRate);
    this.updateElementValue('tbl_printerPrice', s.printerPrice);
    this.updateElementValue('tbl_printerLifespanHours', s.printerLifespanHours);
    this.updateElementValue('tbl_laborHours', s.laborHours);
    this.updateElementValue('tbl_laborRatePerHour', s.laborRatePerHour);
    this.updateElementValue('tbl_failureRatePercent', s.failureRatePercent);
    this.updateElementValue('tbl_profitMarginPercent', s.profitMarginPercent);
    this.updateElementValue('tbl_marketingPercent', s.marketingPercent);
    this.updateElementValue('tbl_marketingFixedAmount', s.marketingFixedAmount);
    this.updateElementValue('dash_marketingPercent', s.marketingPercent);
    this.updateElementValue('dash_marketingFixedAmount', s.marketingFixedAmount);

    ['tbl_includeMarketing', 'dash_includeMarketing'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.checked = Boolean(s.includeMarketingCost);
    });

    ['tbl_marketingType', 'dash_marketingType'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = s.marketingType || 'percent';
    });

    // Toggle dynamic input visibility based on type
    const isFixed = (s.marketingType === 'fixed');
    ['tbl_marketingPercentBox', 'dash_marketingPercentBox'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = isFixed ? 'none' : 'block';
    });
    ['tbl_marketingFixedBox', 'dash_marketingFixedBox'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = isFixed ? 'block' : 'none';
    });

    // 2. Synchronize Client & Order Inputs
    this.updateElementValue('dash_projectName', s.projectName || '');
    this.updateElementValue('dash_clientName', s.clientName || '');
    this.updateElementValue('dash_clientPhone', s.clientPhone || '');
    this.updateElementValue('dash_clientAddress', s.clientAddress || '');
    this.updateElementValue('dash_shippingCost', s.shippingCost);
    this.updateElementValue('dash_depositPaid', s.depositPaid);
    this.updateElementValue('dash_deliveryDueDate', s.deliveryDueDate || '');
    this.updateElementValue('dash_infillPercent', s.infillPercent);
    this.updateElementValue('dash_cadDesignHours', s.cadDesignHours);
    this.updateElementValue('dash_cadDesignRatePerHour', s.cadDesignRatePerHour);
    this.updateElementValue('dash_batchQuantity', s.batchQuantity);
    this.updateElementValue('dash_spoolRemaining', s.spoolRemaining);
    this.updateElementValue('dash_vatPercent', s.vatPercent);
    const vatToggleEl = document.getElementById('dash_includeVAT');
    if (vatToggleEl) vatToggleEl.checked = Boolean(s.includeVAT);

    // Selects
    this.updateElementValue('filamentPresetSelect', s.selectedFilamentPreset);
    this.updateElementValue('tbl_filamentPresetSelect', s.selectedFilamentPreset);
    this.updateElementValue('printerPresetSelect', s.selectedPrinterPreset);
    this.updateElementValue('electricityTierSelect', s.selectedPowerPreset);
    this.updateElementValue('dash_shippingGovSelect', s.selectedGovernorate);
    this.updateElementValue('dash_partColorSelect', s.partColor);
    this.updateElementValue('dash_layerHeightSelect', s.layerHeight);
    this.updateElementValue('dash_supportsTypeSelect', s.supportsType);
    this.updateElementValue('dash_paymentMethodSelect', s.paymentMethod);
    this.updateElementValue('dash_orderStatusSelect', s.orderStatus);
    this.updateElementValue('currencySelect', s.selectedCurrency);

    // 3. Update Table Calculated Text Cells
    this.updateElementText('tbl_materialCost', this.formatCurrency(res.materialCost));
    this.updateElementText('tbl_powerCost', this.formatCurrency(res.powerCost));
    this.updateElementText('tbl_depreciationPerHour', this.formatCurrency(res.depreciationPerHour) + ' / ساعة');
    this.updateElementText('tbl_depreciationCost', this.formatCurrency(res.depreciationCost));
    this.updateElementText('tbl_laborCost', this.formatCurrency(res.laborCost));
    this.updateElementText('tbl_directSubtotal', this.formatCurrency(res.directSubtotal));
    this.updateElementText('tbl_marketingCost', this.formatCurrency(res.marketingCost));
    this.updateElementText('tbl_subtotal', this.formatCurrency(res.subtotal));
    this.updateElementText('tbl_failureCost', this.formatCurrency(res.failureCost));
    this.updateElementText('tbl_totalCost', this.formatCurrency(res.totalCost));
    this.updateElementText('tbl_finalSellingPrice', this.formatCurrency(res.finalSellingPrice));
    this.updateElementText('tbl_profitAmount', this.formatCurrency(res.profitAmount));
    this.updateElementText('tbl_markupPercent', res.markupPercent.toFixed(1) + '%');

    // 4. Update Hero Metric Ribbon
    this.updateElementText('hero_totalCost', this.formatCurrency(res.totalCost));
    this.updateElementText('hero_sellingPrice', this.formatCurrency(res.finalSellingPrice));
    this.updateElementText('hero_profit', this.formatCurrency(res.profitAmount));
    this.updateElementText('hero_markup', res.markupPercent.toFixed(1) + '%');
    this.updateElementText('hero_costPerGram', this.formatCurrency(res.costPerGram));
    this.updateElementText('hero_costPerHour', this.formatCurrency(res.costPerHour));

    // 5. Update Spool Roll Balance
    const spoolRem = Math.max(0, (s.spoolRemaining || 1000) - res.partWeight);
    const spoolPrints = res.partWeight > 0 ? Math.floor(spoolRem / res.partWeight) : 0;
    this.updateElementText('spoolRemainingText', `المتبقي بعد الطباعة: ${spoolRem.toFixed(1)} جم`);
    this.updateElementText('spoolPrintsLeftText', `يكفي لـ ${spoolPrints} قطعة إضافية`);
    const spoolPct = Math.min(100, Math.max(0, (spoolRem / (s.spoolWeight || 1000)) * 100));
    const pBar = document.getElementById('spoolProgress');
    if (pBar) pBar.style.width = `${spoolPct}%`;

    const activeSpoolBadge = document.getElementById('activeSpoolNameBadge');
    if (activeSpoolBadge) {
      const activeSpool = (this.spoolInventory || []).find(sp => sp.id === s.activeSpoolId);
      if (activeSpool) {
        const filament = PRESETS.filaments.find(f => f.id === activeSpool.filamentPresetId);
        activeSpoolBadge.textContent = `(${filament ? filament.name : ''} — ${activeSpool.colorName})`;
      } else {
        activeSpoolBadge.textContent = '';
      }
    }

    // 6. Update Batch Summary
    this.updateElementText('batchTotalQty', `${res.qty} قطعة`);
    this.updateElementText('batchTotalCost', this.formatCurrency(res.batchTotalCost));
    this.updateElementText('batchTotalPrice', this.formatCurrency(res.batchTotalPrice));
    this.updateElementText('batchTotalProfit', this.formatCurrency(res.batchTotalProfit));

    // 7. Update Quotation View
    const filamentItem = PRESETS.filaments.find(f => f.id === s.selectedFilamentPreset) || { name: 'PLA' };
    this.updateElementText('quoteClientName', s.clientName || 'عميل تجريبي');
    this.updateElementText('quoteProjectName', s.projectName || 'قطعة نموذجية');
    this.updateElementText('quoteClientPhone', s.clientPhone || 'غير مسجل');
    this.updateElementText('quoteClientAddress', s.clientAddress || 'القاهرة والجيزة');
    this.updateElementText('quoteFilamentType', filamentItem.name);
    this.updateElementText('quoteColor', s.partColor);
    this.updateElementText('quoteLayerHeight', s.layerHeight);
    this.updateElementText('quoteInfill', s.infillPercent + '%');
    this.updateElementText('quoteQty', res.qty);
    this.updateElementText('quoteUnitPrice', this.formatCurrency(res.finalSellingPrice));
    this.updateElementText('quotePrintSubtotal', this.formatCurrency(res.batchTotalPrice));
    this.updateElementText('quoteCadFee', this.formatCurrency(res.cadFee));
    const vatRow = document.getElementById('quoteVATRow');
    if (vatRow) {
      if (res.includeVAT && res.vatAmount > 0) {
        vatRow.classList.remove('hidden');
        this.updateElementText('quoteVATPercentLabel', res.vatPercent);
        this.updateElementText('quoteVATAmount', this.formatCurrency(res.vatAmount));
      } else {
        vatRow.classList.add('hidden');
      }
    }
    this.updateElementText('quoteShippingCost', this.formatCurrency(res.shippingFee));
    this.updateElementText('quoteGrandTotal', this.formatCurrency(res.grandOrderTotal));
    this.updateElementText('quoteDepositPaid', this.formatCurrency(res.deposit));
    this.updateElementText('quoteRemainingBalance', this.formatCurrency(res.remainingBalance));
    this.updateElementText('quoteDueDate', s.deliveryDueDate || 'خلال 2-3 أيام عمل');

    const paymentMap = {
      cash: '💵 كاش عند الاستلام',
      instapay: '⚡ إنستاباي InstaPay',
      vodafone_cash: '📱 فودافون كاش',
      bank_transfer: '🏦 تحويل بنكي'
    };
    this.updateElementText('quotePaymentMethod', paymentMap[s.paymentMethod] || 'كاش');

    // Part Reference Image in Quote
    const imgContainer = document.getElementById('quotePartImageContainer');
    const quoteImg = document.getElementById('quotePartImage');
    if (imgContainer && quoteImg) {
      if (s.partImageBase64) {
        quoteImg.src = s.partImageBase64;
        imgContainer.classList.remove('hidden');
      } else {
        imgContainer.classList.add('hidden');
      }
    }

    // 8. Dynamic Tools Render
    this.generateQRCode();
    this.showMaterialComparison();
    this.renderCharts(res);
    this.renderROI(res);
    this.renderAnalyticsDashboard();
    this.saveState();
  }

  updateElementValue(id, val) {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = val;
  }

  updateElementText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  // ================= 5. PRICING TEMPLATES =================
  applyPricingTemplate(templateId) {
    const t = PRICING_TEMPLATES[templateId];
    if (!t) return;
    this.state.profitMarginPercent = t.profitMarginPercent;
    this.state.layerHeight = t.layerHeight;
    this.state.infillPercent = t.infillPercent;
    this.state.failureRatePercent = t.failureRatePercent;
    this.render();
    this.showToast(`✨ تم تطبيق قالب التسعير: ${t.name}`);
  }

  // ================= 6. MATERIAL COST COMPARISON =================
  showMaterialComparison() {
    const container = document.getElementById('materialComparisonContainer');
    if (!container) return;

    const s = this.state;
    const currentRes = this.calculate();

    const comparisonList = PRESETS.filaments.map(fil => {
      const matCost = (currentRes.partWeight * fil.price) / 1000;
      const alt = CalcEngine.calculateCost({ ...s, spoolPrice: fil.price, spoolWeight: 1000 });
      const tot = alt.totalCost;
      const sell = alt.finalSellingPrice;
      const diff = sell - currentRes.finalSellingPrice;

      return {
        name: fil.name,
        isCurrent: fil.id === s.selectedFilamentPreset,
        materialCost: matCost,
        totalCost: tot,
        sellingPrice: sell,
        diff: diff
      };
    }).sort((a, b) => a.sellingPrice - b.sellingPrice);

    container.innerHTML = `
      <table class="w-full text-xs text-right border-collapse border border-slate-200 dark:border-slate-700">
        <thead class="bg-slate-100 dark:bg-slate-800 font-bold">
          <tr>
            <th class="p-2 border border-slate-200 dark:border-slate-700">نوع الخامة</th>
            <th class="p-2 border border-slate-200 dark:border-slate-700 text-center">تكلفة الخامة</th>
            <th class="p-2 border border-slate-200 dark:border-slate-700 text-center">التكلفة الإجمالية</th>
            <th class="p-2 border border-slate-200 dark:border-slate-700 text-left">سعر البيع المقترح</th>
            <th class="p-2 border border-slate-200 dark:border-slate-700 text-center">الفرق vs الحالي</th>
          </tr>
        </thead>
        <tbody>
          ${comparisonList.map(c => `
            <tr class="${c.isCurrent ? 'bg-blue-50 dark:bg-blue-950/40 font-bold' : ''}">
              <td class="p-2 border border-slate-200 dark:border-slate-700">${c.name} ${c.isCurrent ? '⭐ (المحدد)' : ''}</td>
              <td class="p-2 border border-slate-200 dark:border-slate-700 text-center font-mono-nums">${this.formatCurrency(c.materialCost)}</td>
              <td class="p-2 border border-slate-200 dark:border-slate-700 text-center font-mono-nums">${this.formatCurrency(c.totalCost)}</td>
              <td class="p-2 border border-slate-200 dark:border-slate-700 text-left font-black text-emerald-600 font-mono-nums">${this.formatCurrency(c.sellingPrice)}</td>
              <td class="p-2 border border-slate-200 dark:border-slate-700 text-center font-mono-nums ${c.diff < 0 ? 'text-emerald-600' : c.diff > 0 ? 'text-rose-500' : 'text-slate-400'}">
                ${c.diff === 0 ? '—' : (c.diff > 0 ? '+' : '') + this.formatCurrency(c.diff)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // ================= 7. DEADLINE ALERTS =================
  checkDeadlineAlerts() {
    const banner = document.getElementById('deadlineAlertBanner');
    if (!banner) return;

    const urgentList = [];
    const now = new Date();

    this.savedProjects.forEach(p => {
      if (p.deliveryDueDate && p.orderStatus !== 'delivered') {
        const due = new Date(p.deliveryDueDate);
        const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
        if (diffDays <= 2) {
          urgentList.push({ name: p.name, client: p.client, diffDays: diffDays });
        }
      }
    });

    if (urgentList.length > 0) {
      banner.innerHTML = `
        <div class="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md">
          <div class="flex items-center gap-2">
            <i class="fas fa-bell animate-bounce text-sm"></i>
            <span>تنبيه تسليم: لديك (${urgentList.length}) طلبات اقترب موعد تسليمها (${urgentList.map(u => `${u.name} للعميل ${u.client}`).join(' • ')})</span>
          </div>
          <button onclick="document.getElementById('deadlineAlertBanner').classList.add('hidden')" class="text-slate-900 hover:text-white"><i class="fas fa-xmark"></i></button>
        </div>
      `;
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  // ================= 8. BUSINESS ANALYTICS & CRM =================
  renderAnalyticsDashboard() {
    if (this.updateReportsPanel) setTimeout(() => this.updateReportsPanel(), 0);
    const totalRev = this.savedProjects.reduce((sum, p) => sum + (Number(p.sellingPrice) || 0), 0);
    const totalProf = this.savedProjects.reduce((sum, p) => sum + (Number(p.profit) || 0), 0);
    const totalFilKg = this.savedProjects.reduce((sum, p) => sum + ((Number(p.weight) || 0) / 1000), 0);
    const totalHrs = this.savedProjects.reduce((sum, p) => sum + (Number(p.hours) || 0), 0);

    this.updateElementText('kpiTotalRevenue', this.formatCurrency(totalRev));
    this.updateElementText('kpiTotalProfit', this.formatCurrency(totalProf));
    this.updateElementText('kpiTotalFilamentKg', totalFilKg.toFixed(2) + ' كجم');
    this.updateElementText('kpiTotalHours', totalHrs.toFixed(1) + ' ساعة');

    // Status Doughnut Chart
    const ctx = document.getElementById('orderStatusChart');
    if (ctx && typeof Chart !== 'undefined') {
      const counts = { pending_design: 0, ready_print: 0, printing: 0, post_processing: 0, ready_ship: 0, delivered: 0 };
      this.savedProjects.forEach(p => {
        const st = p.orderStatus || 'ready_print';
        if (counts[st] !== undefined) counts[st]++;
      });

      const dataVals = Object.values(counts);
      if (this.charts.orderStatus) {
        this.charts.orderStatus.data.datasets[0].data = dataVals;
        this.charts.orderStatus.update();
      } else {
        this.charts.orderStatus = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: ['قيد التصميم ✏️', 'جاهز للطباعة ⏳', 'جاري الطباعة 🖨️', 'تشطيب 🔧', 'جاهز للشحن 📦', 'تم التسليم ✅'],
            datasets: [{
              data: dataVals,
              backgroundColor: ['#6366f1', '#3b82f6', '#06b6d4', '#f59e0b', '#8b5cf6', '#10b981']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }
          }
        });
      }
    }

    // Top Clients CRM Container
    const clientsContainer = document.getElementById('topClientsContainer');
    if (clientsContainer) {
      const clientMap = {};
      this.savedProjects.forEach(p => {
        const c = p.client || 'عميل عام';
        if (!clientMap[c]) clientMap[c] = { name: c, count: 0, spent: 0, phone: p.phone || '' };
        clientMap[c].count++;
        clientMap[c].spent += Number(p.sellingPrice) || 0;
      });

      const sortedClients = Object.values(clientMap).sort((a, b) => b.spent - a.spent).slice(0, 5);
      if (sortedClients.length === 0) {
        clientsContainer.innerHTML = '<div class="text-xs text-slate-400 text-center py-4">سيتم عرض قائمة العملاء تلقائياً مع حفظ الطلبات.</div>';
      } else {
        clientsContainer.innerHTML = sortedClients.map((c, i) => `
          <div class="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs">
            <div class="flex items-center gap-2">
              <span class="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">${i + 1}</span>
              <div>
                <span class="font-bold block">${c.name}</span>
                <span class="text-[10px] text-slate-400">${c.count} طلبات</span>
              </div>
            </div>
            <span class="font-black text-emerald-600 font-mono-nums">${this.formatCurrency(c.spent)}</span>
          </div>
        `).join('');
      }
    }
  }

  populateClientAutocomplete() {
    const datalist = document.getElementById('savedClientsList');
    if (!datalist) return;
    const names = [...new Set(this.savedProjects.map(p => p.client).filter(Boolean))];
    datalist.innerHTML = names.map(n => `<option value="${n}">`).join('');
  }

  handleClientSelect(name) {
    const match = this.savedProjects.find(p => p.client === name);
    if (match) {
      if (match.phone && !this.state.clientPhone) this.state.clientPhone = match.phone;
      if (match.address && !this.state.clientAddress) this.state.clientAddress = match.address;
      this.render();
      this.showToast(`👤 تم استرجاع بيانات العميل: ${name}`);
    }
  }

  // ================= 9. IMAGE UPLOAD HANDLER =================
  handlePartImageUpload(e) {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        this.state.partImageBase64 = event.target.result;
        this.render();
        this.showToast('📸 تم إرفاق صورة القطعة بنجاح في عرض السعر والفاتورة!');
      };
      reader.readAsDataURL(file);
    }
  }

  // ================= 10. ROI & PAYBACK =================
  renderROI(res) {
    const printerPrice = Number(this.state.printerPrice) || 26000;
    const profitPerPrint = res.profitAmount;

    const printsNeeded = profitPerPrint > 0 ? Math.ceil(printerPrice / profitPerPrint) : 0;
    const hoursNeeded = profitPerPrint > 0 ? (printsNeeded * (res.printHours || 1)) : 0;
    const monthlyPrints = Math.max(1, parseInt(document.getElementById('dash_printsPerMonth')?.value || 30));
    const monthlyNetProfit = profitPerPrint * monthlyPrints;

    this.updateElementText('roiPaybackPrints', printsNeeded > 0 ? `${printsNeeded} قطعة` : '—');
    this.updateElementText('roiPaybackHours', hoursNeeded > 0 ? `${hoursNeeded.toFixed(0)} ساعة` : '—');
    this.updateElementText('roiMonthlyNetProfit', this.formatCurrency(monthlyNetProfit));
  }

  // ================= 11. MULTI-PART ASSEMBLY =================
  toggleMultiPartMode() {
    this.state.multiPartMode = !this.state.multiPartMode;
    const btn = document.getElementById('multiPartToggleBtn');
    if (btn) {
      btn.textContent = this.state.multiPartMode ? 'تعطيل وضع التجميعة' : 'تفعيل وضع التجميعة';
      btn.className = this.state.multiPartMode ? 'bg-emerald-600 text-white text-xs px-3.5 py-2 rounded-lg font-bold transition' : 'bg-blue-600 text-white text-xs px-3.5 py-2 rounded-lg font-bold transition';
    }
    this.renderPartsList();
    this.render();
    this.showToast(this.state.multiPartMode ? '🧩 تم تفعيل وضع تجميعة القطع المتعددة' : '⏹️ تم العودة للوضع الفردي');
  }

  addPart() {
    const name = document.getElementById('partNameInput')?.value || `جزء ${this.state.partsList.length + 1}`;
    const weight = parseFloat(document.getElementById('partWeightInput')?.value) || 0;
    const hours = parseFloat(document.getElementById('partTimeInput')?.value) || 0;

    if (weight <= 0 && hours <= 0) {
      alert('يرجى إدخال وزن أو وقت للجزء المضاف.');
      return;
    }

    this.state.partsList.push({ id: Date.now(), name, weight, hours });
    if (document.getElementById('partNameInput')) document.getElementById('partNameInput').value = '';
    if (document.getElementById('partWeightInput')) document.getElementById('partWeightInput').value = '';
    if (document.getElementById('partTimeInput')) document.getElementById('partTimeInput').value = '';

    this.renderPartsList();
    this.render();
    this.showToast(`➕ تمت إضافة الجزء: ${name}`);
  }

  removePart(id) {
    this.state.partsList = this.state.partsList.filter(p => p.id !== id);
    this.renderPartsList();
    this.render();
  }

  renderPartsList() {
    const container = document.getElementById('partsListContainer');
    if (!container) return;

    if (!this.state.partsList || this.state.partsList.length === 0) {
      container.innerHTML = '<div class="text-xs text-slate-400 text-center py-4">لا توجد أجزاء مضافة بعد. أضف أجزاء التجميعة بالأعلى.</div>';
      return;
    }

    container.innerHTML = this.state.partsList.map((p, idx) => `
      <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
        <div class="flex items-center gap-3">
          <span class="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px]">${idx + 1}</span>
          <div>
            <span class="font-bold">${p.name}</span>
            <span class="text-slate-400 block text-[11px]">${p.weight} جم • ${p.hours} ساعة</span>
          </div>
        </div>
        <button onclick="app.removePart(${p.id})" class="text-rose-600 hover:text-rose-700 font-bold p-1"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');

    const totW = this.state.partsList.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);
    const totH = this.state.partsList.reduce((sum, p) => sum + (Number(p.hours) || 0), 0);
    const res = this.calculate();

    this.updateElementText('assemblyTotalWeight', `${totW} جم`);
    this.updateElementText('assemblyTotalTime', `${totH} ساعة`);
    this.updateElementText('assemblyTotalCost', this.formatCurrency(res.totalCost));
    this.updateElementText('assemblyTotalPrice', this.formatCurrency(res.finalSellingPrice));
  }

  // ================= 12. 3D STL & G-CODE ENGINE =================
  init3DScene() {
    const container = document.getElementById('stlCanvasContainer');
    if (!container || typeof THREE === 'undefined') return;

    if (this.threeRenderer && this.threeScene) return;

    container.innerHTML = '';
    const width = container.clientWidth || 380;
    const height = container.clientHeight || 280;

    this.threeScene = new THREE.Scene();
    this.threeScene.background = new THREE.Color(this.state.darkMode ? 0x090d16 : 0xf1f5f9);

    this.threeCamera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.threeCamera.position.set(80, 80, 100);

    this.threeRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.threeRenderer.setSize(width, height);
    this.threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.threeRenderer.shadowMap.enabled = true;
    container.appendChild(this.threeRenderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    this.threeScene.add(ambient);

    const dir1 = new THREE.DirectionalLight(0xffffff, 0.9);
    dir1.position.set(100, 150, 100);
    this.threeScene.add(dir1);

    const dir2 = new THREE.DirectionalLight(0x3b82f6, 0.6);
    dir2.position.set(-100, -50, -100);
    this.threeScene.add(dir2);

    const grid = new THREE.GridHelper(160, 16, 0x3b82f6, 0x475569);
    grid.position.y = 0;
    this.threeScene.add(grid);

    if (typeof THREE.OrbitControls !== 'undefined') {
      this.threeControls = new THREE.OrbitControls(this.threeCamera, this.threeRenderer.domElement);
      this.threeControls.enableDamping = true;
      this.threeControls.dampingFactor = 0.05;
    }

    const sampleGeom = new THREE.BoxGeometry(25, 25, 25);
    const sampleMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.35, metalness: 0.15 });
    this.threeMesh = new THREE.Mesh(sampleGeom, sampleMat);
    this.threeMesh.position.set(0, 12.5, 0);
    this.threeScene.add(this.threeMesh);

    const animate = () => {
      this.threeAnimId = requestAnimationFrame(animate);
      if (this.threeControls) this.threeControls.update();
      else if (this.threeMesh && !this.customSTLLoaded) {
        this.threeMesh.rotation.y += 0.008;
      }
      this.threeRenderer.render(this.threeScene, this.threeCamera);
    };
    animate();
  }

  handleUnifiedFile(file) {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.stl')) {
      this.loadSTLFile(file);
    } else if (name.endsWith('.gcode') || name.endsWith('.g') || name.endsWith('.gco') || name.endsWith('.nc')) {
      this.parseGCodeFile(file);
    } else {
      // Try parsing as G-Code or STL based on content
      this.parseGCodeFile(file);
    }
  }

  handleFileInputChange(e) {
    if (e && e.target && e.target.files && e.target.files.length > 0) {
      this.handleUnifiedFile(e.target.files[0]);
      e.target.value = ''; // Reset input to allow re-uploading same file
    }
  }

  loadSTLFile(file) {
    if (!file) return;
    this.showToast('⏳ جاري قراءة وعرض مجسم الـ STL...');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target.result;
        this.parseAndRenderSTL(buffer, file.name);
      } catch (err) {
        console.error('STL Parse error:', err);
        alert('حدث خطأ أثناء معالجة ملف الـ STL.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  parseAndRenderSTL(buffer, filename) {
    if (!this.threeScene || !this.threeRenderer) this.init3DScene();

    const isBinary = () => {
      if (buffer.byteLength < 84) return false;
      const reader = new DataView(buffer);
      const numTriangles = reader.getUint32(80, true);
      return buffer.byteLength === 84 + numTriangles * 50;
    };

    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const normals = [];

    if (isBinary()) {
      const view = new DataView(buffer);
      const numTriangles = view.getUint32(80, true);
      let offset = 84;
      for (let i = 0; i < numTriangles; i++) {
        const nx = view.getFloat32(offset, true);
        const ny = view.getFloat32(offset + 4, true);
        const nz = view.getFloat32(offset + 8, true);
        offset += 12;
        for (let j = 0; j < 3; j++) {
          positions.push(
            view.getFloat32(offset, true),
            view.getFloat32(offset + 4, true),
            view.getFloat32(offset + 8, true)
          );
          normals.push(nx, ny, nz);
          offset += 12;
        }
        offset += 2;
      }
    } else {
      const text = new TextDecoder().decode(buffer);
      const normalMatches = [...text.matchAll(/facet\s+normal\s+([\s\S]*?)endfacet/gi)];
      for (const match of normalMatches) {
        const block = match[0];
        const nMatch = block.match(/facet\s+normal\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/i);
        const nx = nMatch ? parseFloat(nMatch[1]) : 0;
        const ny = nMatch ? parseFloat(nMatch[2]) : 0;
        const nz = nMatch ? parseFloat(nMatch[3]) : 0;
        const vMatches = [...block.matchAll(/vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/gi)];
        if (vMatches.length === 3) {
          for (let j = 0; j < 3; j++) {
            positions.push(parseFloat(vMatches[j][1]), parseFloat(vMatches[j][2]), parseFloat(vMatches[j][3]));
            normals.push(nx, ny, nz);
          }
        }
      }
    }

    if (positions.length === 0) {
      alert('لم يتم العثور على أوجه ثلاثية الأبعاد في الملف.');
      return;
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (normals.length === positions.length) {
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    } else {
      geometry.computeVertexNormals();
    }

    // Convert 3D Printing STL Coordinates (Z-Up) to Three.js World (Y-Up)
    geometry.center();
    geometry.rotateX(-Math.PI / 2);
    
    // Snap model to sit flat on build plate grid (Y = 0)
    geometry.computeBoundingBox();
    const initMinY = geometry.boundingBox.min.y;
    geometry.translate(0, -initMinY, 0);

    if (this.threeMesh && this.threeScene) this.threeScene.remove(this.threeMesh);

    const material = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3, metalness: 0.2 });
    this.threeMesh = new THREE.Mesh(geometry, material);
    this.threeMesh.position.set(0, 0, 0);

    if (this.threeScene) this.threeScene.add(this.threeMesh);
    this.customSTLLoaded = true;

    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    const size = new THREE.Vector3();
    box.getSize(size);

    const maxDim = Math.max(size.x, size.y, size.z);
    if (this.threeCamera) {
      this.threeCamera.position.set(maxDim * 1.5, maxDim * 1.3, maxDim * 1.8);
      this.threeCamera.lookAt(0, size.y / 2, 0);
      if (this.threeControls) this.threeControls.target.set(0, size.y / 2, 0);
    }

    let volumeCm3 = 0;
    const posAttr = geometry.attributes.position;
    if (posAttr) {
      const p1 = new THREE.Vector3(), p2 = new THREE.Vector3(), p3 = new THREE.Vector3();
      for (let i = 0; i < posAttr.count; i += 3) {
        p1.fromBufferAttribute(posAttr, i);
        p2.fromBufferAttribute(posAttr, i + 1);
        p3.fromBufferAttribute(posAttr, i + 2);
        volumeCm3 += p1.dot(p2.cross(p3)) / 6.0;
      }
      volumeCm3 = Math.abs(volumeCm3) / 1000.0;
    }

    const filamentItem = PRESETS.filaments.find(f => f.id === this.state.selectedFilamentPreset);
    const density = filamentItem?.density || 1.24;
    const infillRatio = ((this.state.infillPercent || 20) / 100) * 0.45 + 0.25;
    const estimatedGrams = Math.max(1, Math.round(volumeCm3 * density * infillRatio));

    this.currentSTLData = {
      filename: filename.replace(/\.stl$/i, ''),
      dimensions: `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} مم`,
      volume: `${volumeCm3.toFixed(1)} سم³`,
      estimatedGrams: estimatedGrams
    };

    const infoBox = document.getElementById('stlInfoBox');
    if (infoBox) infoBox.classList.remove('hidden');

    this.updateElementText('stlDimsText', this.currentSTLData.dimensions);
    this.updateElementText('stlVolumeText', this.currentSTLData.volume);
    this.updateElementText('stlWeightText', `${estimatedGrams} جرام تقريباً`);

    this.showToast(`🧊 تم تحميل وعرض المجسم 3D بالزاوية الصحيحة (${estimatedGrams} جم مقدر)`);
  }

  applySTLDataToCalculator() {
    if (!this.currentSTLData) {
      alert('يرجى رفع ملف STL أولاً.');
      return;
    }
    if (this.currentSTLData.filename) this.state.projectName = this.currentSTLData.filename;
    if (this.currentSTLData.estimatedGrams) this.state.partWeight = this.currentSTLData.estimatedGrams;
    this.render();
    this.showToast(`✨ تم تطبيق وزن المجسم (${this.currentSTLData.estimatedGrams} جم) واسمه في الحاسبة!`);
  }

  rotateSTL(axis, degrees = 90) {
    if (!this.threeMesh || !this.threeMesh.geometry) {
      this.showToast('يرجى رفع ملف STL أولاً لتدويره.');
      return;
    }
    const rad = (degrees * Math.PI) / 180;
    const geom = this.threeMesh.geometry;

    if (axis === 'x') geom.rotateX(rad);
    else if (axis === 'y') geom.rotateY(rad);
    else if (axis === 'z') geom.rotateZ(rad);

    geom.computeBoundingBox();
    const box = geom.boundingBox;
    const center = new THREE.Vector3();
    box.getCenter(center);
    geom.translate(-center.x, -box.min.y, -center.z);

    const size = new THREE.Vector3();
    geom.boundingBox.getSize(size);
    this.updateElementText('stlDimsText', `${size.x.toFixed(1)} × ${size.y.toFixed(1)} × ${size.z.toFixed(1)} مم`);

    this.showToast(`🔄 تم تدوير المجسم 90° ومحاذاته على السرير`);
  }

  layFlatSTL() {
    if (!this.threeMesh || !this.threeMesh.geometry) return;
    const geom = this.threeMesh.geometry;
    geom.center();
    geom.computeBoundingBox();
    const minY = geom.boundingBox.min.y;
    geom.translate(0, -minY, 0);
    this.resetSTLCamera();
    this.showToast('📐 تم ضبط المجسم مستوياً على سرير الطباعة');
  }

  toggleSTLWireframe() {
    if (!this.threeMesh) return;
    this.threeMesh.material.wireframe = !this.threeMesh.material.wireframe;
    this.showToast(this.threeMesh.material.wireframe ? '🌐 وضع الشبكة نشط' : '🧊 تم إيقاف وضع الشبكة');
  }

  resetSTLCamera() {
    if (!this.threeCamera) return;
    this.threeCamera.position.set(80, 80, 100);
    this.threeCamera.lookAt(0, 12.5, 0);
    if (this.threeControls) this.threeControls.target.set(0, 12.5, 0);
  }

  handleWindowResize() {
    if (!this.threeRenderer || !this.threeCamera) return;
    const container = document.getElementById('stlCanvasContainer');
    if (!container) return;
    const width = container.clientWidth || 380;
    const height = container.clientHeight || 280;
    if (width === 0 || height === 0) return;
    this.threeCamera.aspect = width / height;
    this.threeCamera.updateProjectionMatrix();
    this.threeRenderer.setSize(width, height);
  }

  mountExtrasPanel() {
    const anchorEl = document.getElementById('tbl_failureRatePercent');
    if (!anchorEl || document.getElementById('extrasPanelV2')) return;
    const host = anchorEl.closest('section, .card, [class*="rounded-2xl"], [class*="rounded-xl"]') || anchorEl.parentElement;
    const f = (key, label, step = 1) => `<label class="block text-[11px] text-slate-500">${label}
      <input type="number" min="0" step="${step}" data-extra="${key}" value="${Number(this.state[key]) || 0}"
      class="mt-0.5 w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"></label>`;
    const fx = ['USD', 'SAR', 'AED'].map(c => `<label class="block text-[11px] text-slate-500">سعر الصرف ${c}
      <input type="number" min="0" step="0.0001" data-fx="${c}" value="${CURRENCY_RATES[c].rate}"
      class="mt-0.5 w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"></label>`).join('');
    const panel = document.createElement('div');
    panel.id = 'extrasPanelV2';
    panel.className = 'mt-4 p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3 no-print';
    panel.innerHTML = `<div class="font-bold text-sm">⚙️ تسعير متقدم (v2)</div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
        ${f('setupFee', 'رسوم تحضير الطلب (ج.م)')}
        ${f('postProcessCost', 'ما بعد المعالجة / قطعة', 1)}
        ${f('consumablesPerHour', 'مستهلكات / ساعة (نوزل، بلاط)', 0.1)}
        ${f('minOrderPrice', 'حد أدنى لسعر الطلب')}
      </div>
      <div class="text-[11px] text-slate-500">خصم الكمية (يُطبّق تلقائياً): 10+ قطع = <input data-tier="0" type="number" min="0" max="90" value="${this.state.discountTiers[0]?.pct ?? 0}" class="w-12 px-1 py-0.5 border rounded dark:bg-slate-900"> % — 50+ قطعة = <input data-tier="1" type="number" min="0" max="90" value="${this.state.discountTiers[1]?.pct ?? 0}" class="w-12 px-1 py-0.5 border rounded dark:bg-slate-900"> %</div>
      <div class="grid grid-cols-3 gap-2">${fx}</div>
      <div id="extrasResult" class="text-[11px] text-slate-600 dark:text-slate-300"></div>
      <div class="text-[10px] text-slate-400">الهامش المحسوب من سعر البيع (margin) وليس markup. الفشل يُحسب على الخامة والكهرباء والإهلاك فقط.</div>`;
    host.insertAdjacentElement('afterend', panel);
    panel.addEventListener('input', (e) => {
      const t = e.target, v = Math.max(0, Number(t.value) || 0);
      if (t.dataset.extra) this.state[t.dataset.extra] = v;
      if (t.dataset.tier !== undefined) {
        const i = Number(t.dataset.tier);
        this.state.discountTiers[i] = { min: i === 0 ? 10 : 50, pct: Math.min(90, v) };
      }
      if (t.dataset.fx) { this.state.fxRates = { ...this.state.fxRates, [t.dataset.fx]: v }; if (v > 0) CURRENCY_RATES[t.dataset.fx].rate = v; }
      this.saveState(); this.render();
      this.updateExtrasResult();
    });
    this.updateExtrasResult();
  }

  updateExtrasResult() {
    const el = document.getElementById('extrasResult');
    if (!el) return;
    const r = this.calculate();
    el.innerHTML = `هامش فعلي: <b>${r.realMarginPercent.toFixed(1)}%</b> • Markup: <b>${r.markupPercent.toFixed(1)}%</b>` +
      (r.discountPct ? ` • خصم كمية: <b>${r.discountPct}%</b>` : '') +
      (r.minPriceApplied ? ' • <b class="text-amber-600">تم تطبيق الحد الأدنى للسعر</b>' : '');
  }

  // ================= v2: التقارير المالية والمصروفات الثابتة =================
  mountReportsPanel() {
    const anchor = document.getElementById('kpiTotalRevenue');
    if (!anchor || document.getElementById('reportsPanelV2')) return;
    const host = anchor.closest('section, .card, [class*="rounded-2xl"]') || anchor.parentElement.parentElement;
    const panel = document.createElement('div');
    panel.id = 'reportsPanelV2';
    panel.className = 'mt-4 p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-3 no-print';
    host.insertAdjacentElement('afterend', panel);
    panel.addEventListener('input', (e) => {
      const t = e.target, i = t.dataset.exp;
      if (t.dataset.field === 'hours') this.state.monthlyPrintHours = Math.max(1, Number(t.value) || 1);
      else if (i !== undefined) {
        if (t.dataset.k === 'name') this.state.fixedExpenses[i].name = t.value.slice(0, 40);
        else this.state.fixedExpenses[i].monthly = Math.max(0, Number(t.value) || 0);
      } else return;
      this.saveState(); this.updateReportsSummary();
    });
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'add') this.state.fixedExpenses.push({ name: 'مصروف جديد', monthly: 0 });
      if (b.dataset.act === 'del') this.state.fixedExpenses.splice(Number(b.dataset.i), 1);
      if (b.dataset.act === 'apply') {
        const o = Reports.overheadPerHour(this.state.fixedExpenses, this.state.monthlyPrintHours);
        this.state.consumablesPerHour = Number(o.perHour.toFixed(2));
        this.showToast(`✅ تم تحميل ${o.perHour.toFixed(2)} ج/ساعة على المستهلكات/ساعة`);
        const inp = document.querySelector('[data-extra="consumablesPerHour"]'); if (inp) inp.value = this.state.consumablesPerHour;
        this.render();
      }
      this.saveState(); this.updateReportsPanel();
    });
    this.updateReportsPanel();
  }

  updateReportsPanel() {
    const panel = document.getElementById('reportsPanelV2');
    if (!panel || typeof Reports === 'undefined') return;
    const inp = 'class="px-2 py-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"';
    const rows = this.state.fixedExpenses.map((e, i) => `<div class="flex gap-2 items-center">
      <input data-exp="${i}" data-k="name" value="${escapeHtml(e.name)}" ${inp} style="flex:1">
      <input data-exp="${i}" data-k="monthly" type="number" min="0" value="${Number(e.monthly) || 0}" ${inp} style="width:90px">
      <button data-act="del" data-i="${i}" class="text-rose-500 text-xs">✕</button></div>`).join('');
    panel.innerHTML = `<div class="font-bold text-sm">📊 المصروفات الثابتة والتقارير المالية</div>
      <div class="space-y-1.5">${rows}</div>
      <div class="flex flex-wrap gap-2 items-center text-[11px]">
        <button data-act="add" class="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700">+ مصروف</button>
        <label>ساعات الطباعة الشهرية المتوقعة <input data-field="hours" type="number" min="1" value="${this.state.monthlyPrintHours}" ${inp} style="width:70px"></label>
        <button data-act="apply" class="px-2 py-1 rounded bg-emerald-600 text-white">طبّق التكلفة/ساعة على التسعير</button>
      </div>
      <div id="reportsSummary" class="text-xs"></div>`;
    this.updateReportsSummary();
  }

  updateReportsSummary() {
    const el = document.getElementById('reportsSummary'); if (!el) return;
    const o = Reports.overheadPerHour(this.state.fixedExpenses, this.state.monthlyPrintHours);
    const rep = Reports.monthlyReport(this.savedProjects, this.state.fixedExpenses, 6);
    const fmt = v => this.formatCurrency(v);
    const tr = rep.months.map(m => `<tr class="border-t border-slate-200 dark:border-slate-700"><td class="py-1">${m.month}</td><td>${m.jobs}</td><td>${fmt(m.revenue)}</td><td>${fmt(m.profit)}</td><td class="${m.net < 0 ? 'text-rose-600' : 'text-emerald-600'} font-bold">${fmt(m.net)}</td></tr>`).join('');
    const clients = Reports.topClients(this.savedProjects, 3).map(c => `${escapeHtml(c.name)} (${fmt(c.profit)})`).join(' • ') || '—';
    const mats = Reports.materialUsage(this.savedProjects).slice(0, 3).map(m => `${escapeHtml(m.name)}: ${(m.grams / 1000).toFixed(2)} كجم`).join(' • ') || '—';
    el.innerHTML = `<div class="mb-1">إجمالي المصروفات الثابتة: <b>${fmt(o.monthlyTotal)}</b>/شهر = <b>${o.perHour.toFixed(2)}</b> ج/ساعة طباعة
      ${rep.breakEvenJobs ? ` • نقطة التعادل ≈ <b>${rep.breakEvenJobs}</b> طلب/شهر` : ''}</div>
      <div class="overflow-x-auto"><table class="w-full text-right text-[11px]"><thead><tr class="text-slate-500"><th>الشهر</th><th>طلبات</th><th>إيراد</th><th>ربح</th><th>صافي بعد الثابت</th></tr></thead><tbody>${tr}</tbody></table></div>
      <div class="mt-1 text-slate-500">أفضل عملاء: ${clients}</div><div class="text-slate-500">استهلاك الخامات: ${mats}</div>`;
  }

  // ================= v2: Kanban للطلبات =================
  mountOrdersViewToggle() {
    const listEl = document.getElementById('customerOrdersList');
    if (!listEl || document.getElementById('ordersViewToggle')) return;
    this.ordersView = localStorage.getItem('3d_orders_view') || 'list';
    const bar = document.createElement('div');
    bar.id = 'ordersViewToggle'; bar.className = 'flex gap-2 text-[11px] mb-2';
    bar.innerHTML = `<button data-v="list" class="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700">☰ قائمة</button><button data-v="kanban" class="px-2 py-1 rounded bg-slate-200 dark:bg-slate-700">▦ Kanban</button>`;
    listEl.insertAdjacentElement('beforebegin', bar);
    bar.addEventListener('click', (e) => {
      const v = e.target.dataset.v; if (!v) return;
      this.ordersView = v; localStorage.setItem('3d_orders_view', v); this.renderCustomerOrders();
    });
  }

  renderOrdersKanban(listEl, orders) {
    const cols = [['pending_review', '⏳ مراجعة'], ['priced', '💰 مُسعّر'], ['printing', '🖨️ طباعة'], ['ready', '📦 جاهز'], ['delivered', '✅ سُلّم']];
    listEl.innerHTML = `<div class="flex gap-2 overflow-x-auto pb-2">${cols.map(([st, label]) => {
      const items = orders.filter(o => (o.Status || 'pending_review') === st);
      return `<div data-col="${st}" class="min-w-[170px] flex-1 rounded-xl bg-slate-100 dark:bg-slate-800 p-2">
        <div class="text-[11px] font-bold mb-2">${label} <span class="text-slate-400">(${items.length})</span></div>
        <div class="space-y-1.5">${items.map(o => `<div draggable="true" data-id="${escapeHtml(o.OrderID)}" class="p-2 rounded-lg bg-white dark:bg-slate-900 shadow-sm text-[11px] cursor-grab">
          <div class="font-bold">${escapeHtml(o.PartName || 'بدون اسم')}</div>
          <div class="text-slate-500">${escapeHtml(o.ClientName || '')}</div>
          <div class="font-mono text-emerald-600">${escapeHtml(o.FinalPrice || o.AutoPrice || '—')} ج.م</div></div>`).join('')}</div></div>`;
    }).join('')}</div><div class="text-[10px] text-slate-400">اسحب الكارت لتغيير الحالة</div>`;
    let dragId = null;
    listEl.querySelectorAll('[draggable]').forEach(c => c.addEventListener('dragstart', e => { dragId = c.dataset.id; e.dataTransfer.setData('text/plain', dragId); }));
    listEl.querySelectorAll('[data-col]').forEach(col => {
      col.addEventListener('dragover', e => e.preventDefault());
      col.addEventListener('drop', async e => {
        e.preventDefault();
        const id = dragId || e.dataTransfer.getData('text/plain'); if (!id) return;
        try {
          const res = await fetch(CUSTOMER_ORDERS_CONFIG.appsScriptUrl, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'update', key: getAdminKey(), orderId: id, status: col.dataset.col }) });
          const d = await res.json();
          if (d.success) { this.showToast('✅ تم نقل الطلب'); this.fetchCustomerOrders(); } else this.showToast('❌ ' + (d.error || 'فشل'));
        } catch (err) { this.showToast('❌ تعذر الاتصال'); }
      });
    });
  }

  gramsPerMeter() {
    const d = PRESETS.filaments.find(f => f.id === this.state.selectedFilamentPreset)?.density || 1.24;
    return Math.PI * Math.pow(0.0875, 2) * 100 * d; // خيط 1.75 مم
  }

  parseGCodeFile(file) {
    if (!file) return;
    this.showToast('⏳ جاري تحليل ملف الـ G-Code فورياً...');

    const parseTextContent = (text) => {
      let printTimeSeconds = 0;
      let filamentGrams = 0;

      // 1. Filament Weight Extraction
      const mG = text.match(/;\s*(?:total\s+)?filament\s+used\s*\[g\]\s*=\s*([\d.]+)/i) ||
                 text.match(/;\s*filament_used_g\s*=\s*([\d.]+)/i) ||
                 text.match(/;\s*(?:total_)?filament_weight\s*[:=]\s*([\d.]+)/i) ||
                 text.match(/;\s*material_weight\s*[:=]\s*([\d.]+)/i) ||
                 text.match(/;\s*Filament used:\s*([\d.]+)\s*g/i) ||
                 text.match(/;\s*Filament used:\s*([\d.]+)\s*grams/i) ||
                 text.match(/;\s*Filament weight\s*[:=]\s*([\d.]+)\s*g/i);

      const mMulti = text.match(/;\s*(?:total\s+)?filament\s+used\s*\[g\]\s*=\s*([\d.]+(?:\s*,\s*[\d.]+)+)/i);
      if (mMulti) {
        const parts = mMulti[1].split(',').map(x => parseFloat(x)).filter(Number.isFinite);
        filamentGrams = parts.reduce((s, x) => s + x, 0);
        this.showToast(`🎨 G-code متعدد الألوان (${parts.length} خامات) — تم جمع الوزن: ${filamentGrams.toFixed(1)} جم`);
      } else if (mG) {
        filamentGrams = parseFloat(mG[1]);
      } else {
        // Volume in cm3
        const mCm3 = text.match(/;\s*filament\s+used\s*\[cm3\]\s*=\s*([\d.]+)/i) ||
                     text.match(/;\s*Filament volume\s*[:=]\s*([\d.]+)\s*cm3/i);
        if (mCm3) {
          const density = PRESETS.filaments.find(f => f.id === this.state.selectedFilamentPreset)?.density || 1.24;
          filamentGrams = parseFloat(mCm3[1]) * density;
        } else {
          // Length in meters
          const mM = text.match(/;\s*Filament used:\s*([\d.]+)\s*m\b/i) ||
                     text.match(/;\s*Filament length\s*[:=]\s*([\d.]+)\s*m\b/i);
          if (mM) {
            filamentGrams = parseFloat(mM[1]) * this.gramsPerMeter();
          } else {
            // Length in mm
            const mMm = text.match(/;\s*(?:total\s+)?filament\s+used\s*\[mm\]\s*=\s*([\d.]+)/i) ||
                        text.match(/;\s*Filament used:\s*([\d.]+)\s*mm\b/i) ||
                        text.match(/;\s*Filament length\s*[:=]\s*([\d.]+)\s*mm\b/i);
            if (mMm) {
              filamentGrams = (parseFloat(mMm[1]) / 1000.0) * this.gramsPerMeter();
            }
          }
        }
      }

      // 2. Print Time Extraction
      const mSec = text.match(/;\s*(?:TIME|print_time|PRINT\.TIME|TIME_ELAPSED)\s*:\s*(\d+)/i) ||
                   text.match(/;\s*estimated printing time[^=]*=\s*(\d+)\s*s/i);
      if (mSec) {
        printTimeSeconds = parseInt(mSec[1], 10);
      } else {
        const mStr = text.match(/;\s*(?:estimated printing time|model printing time|total estimated time|Build time|Print time)[^=:]*[=:]\s*([^\n\r]+)/i);
        if (mStr) {
          const raw = mStr[1];
          let h = 0, m = 0, s = 0;
          const hM = raw.match(/(\d+)\s*(?:h|hour|hours)/i);
          const mM = raw.match(/(\d+)\s*(?:m|min|minute|minutes)/i);
          const sM = raw.match(/(\d+)\s*(?:s|sec|second|seconds)/i);
          if (hM) h = parseInt(hM[1], 10);
          if (mM) m = parseInt(mM[1], 10);
          if (sM) s = parseInt(sM[1], 10);
          printTimeSeconds = h * 3600 + m * 60 + s;
        }
      }

      // 3. Layer Height (optional)
      const mLayer = text.match(/;\s*layer_height\s*=\s*([\d.]+)/i) ||
                     text.match(/;\s*Layer height:\s*([\d.]+)/i);
      if (mLayer) {
        const lh = parseFloat(mLayer[1]);
        if (lh <= 0.14) this.state.layerHeight = '0.12 مم (تفاصيل دقيقة جداً)';
        else if (lh <= 0.18) this.state.layerHeight = '0.16 مم (تفاصيل عالية)';
        else if (lh <= 0.24) this.state.layerHeight = '0.20 مم (قياسي)';
        else if (lh <= 0.30) this.state.layerHeight = '0.28 مم (سريع)';
        else this.state.layerHeight = '0.32 مم (Draft سريع جداً)';
      }

      // 4. Update State & UI
      if (filamentGrams > 0) this.state.partWeight = Number(filamentGrams.toFixed(1));
      if (printTimeSeconds > 0) this.state.printHours = Number((printTimeSeconds / 3600).toFixed(2));

      const cleanName = file.name.replace(/\.gcode$/i, '').replace(/\.g$/i, '').replace(/\.gco$/i, '').replace(/\.nc$/i, '');
      if (cleanName) this.state.projectName = cleanName;

      this.render();

      if (filamentGrams > 0 || printTimeSeconds > 0) {
        this.showToast(`⚡ تم استخراج بيانات الـ G-Code: ${this.state.partWeight} جم • ${this.state.printHours} ساعة • ${this.state.projectName}`);
      } else {
        this.showToast(`⚠️ تم فتح ملف G-Code (${file.name}). يرجى التحقق من أرقام Slicer.`);
      }
    };

    // Fast chunked reading (Header 128KB + Footer 128KB)
    if (file.size > 262144) {
      const headBlob = file.slice(0, 131072);
      const footBlob = file.slice(-131072);

      const r1 = new FileReader();
      r1.onload = (e1) => {
        const headText = e1.target.result;
        const r2 = new FileReader();
        r2.onload = (e2) => {
          const footText = e2.target.result;
          parseTextContent(headText + '\n' + footText);
        };
        r2.readAsText(footBlob);
      };
      r1.readAsText(headBlob);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => parseTextContent(e.target.result);
      reader.readAsText(file);
    }
  }

  // ================= 13. CHARTS & QR CODE =================
  renderCharts(res) {
    if (!res) res = this.calculate();
    if (!res) return;

    const ctx = document.getElementById('costChart');
    if (ctx && typeof Chart !== 'undefined') {
      const dataValues = [res.materialCost, res.powerCost, res.depreciationCost, res.laborCost, res.marketingCost, res.failureCost, res.additionalCost].map(v => Number(v.toFixed(2)));
      const labels = ['خامة', 'كهرباء', 'إهلاك', 'عمالة', 'تسويق 📢', 'هدر', 'إضافات'];

      if (this.charts.cost) {
        this.charts.cost.data.datasets[0].data = dataValues;
        this.charts.cost.update();
      } else {
        this.charts.cost = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: labels,
            datasets: [{
              data: dataValues,
              backgroundColor: ['#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e', '#ec4899', '#ef4444', '#10b981']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } }
          }
        });
      }
    }
  }

  generateQRCode() {
    const canvas = document.getElementById('quoteQRCode');
    if (!canvas || typeof QRious === 'undefined') return;

    let phoneClean = this.state.clientPhone ? this.state.clientPhone.replace(/[^0-9]/g, '') : '';
    if (phoneClean.startsWith('01')) phoneClean = '2' + phoneClean;
    const url = phoneClean ? `https://wa.me/${phoneClean}` : 'https://wa.me/';

    new QRious({ element: canvas, value: url, size: 90, level: 'M' });
  }

  generateWhatsAppText() {
    const res = this.calculate();
    const s = this.state;
    const filament = PRESETS.filaments.find(f => f.id === s.selectedFilamentPreset)?.name || 'PLA';

    let text = `مرحباً ${s.clientName || 'عزيزي العميل'} 👋\n`;
    text += `إليك عرض سعر خدمة الطباعة ثلاثية الأبعاد (Elegoo Neptune 4 Pro):\n\n`;
    text += `📦 *القطعة / المشروع:* ${s.projectName || 'قطعة مخصصة'}\n`;
    text += `🎨 *اللون:* ${s.partColor}\n`;
    text += `🧵 *الخامة:* ${filament}\n`;
    text += `📏 *دقة الطباعة:* ${s.layerHeight}\n`;
    text += `🧱 *نسبة التعبئة:* ${s.infillPercent}%\n`;
    text += `⚖️ *الوزن المقدر:* ${s.partWeight} جرام\n`;
    text += `⏱️ *مدة الطباعة:* ${s.printHours} ساعة\n`;
    text += `🔢 *الكمية:* ${res.qty} قطعة\n`;
    text += `--------------------------\n`;
    text += `💰 *سعر القطعة:* ${this.formatCurrency(res.finalSellingPrice)}\n`;
    text += `💵 *إجمالي الطباعة:* ${this.formatCurrency(res.batchTotalPrice)}\n`;
    if (res.cadFee > 0) text += `✏️ *أجر التصميم CAD:* ${this.formatCurrency(res.cadFee)}\n`;
    if (res.includeVAT && res.vatAmount > 0) text += `🧾 *ضريبة القيمة المضافة (${res.vatPercent}%):* ${this.formatCurrency(res.vatAmount)}\n`;
    if (res.shippingFee > 0) text += `🚚 *الشحن والتوصيل:* ${this.formatCurrency(res.shippingFee)}\n`;
    text += `💳 *الإجمالي الكلي:* ${this.formatCurrency(res.grandOrderTotal)}\n`;
    if (res.deposit > 0) {
      text += `💵 *العربون المدفوع:* ${this.formatCurrency(res.deposit)}\n`;
      text += `✨ *المتبقي عند الاستلام:* ${this.formatCurrency(res.remainingBalance)}\n`;
    }
    text += `--------------------------\n`;
    text += `جاهزون للبدء والتسليم فور التأكيد! 🚀`;

    return encodeURIComponent(text);
  }

  openWhatsApp() {
    const encoded = this.generateWhatsAppText();
    let phoneClean = this.state.clientPhone ? this.state.clientPhone.replace(/[^0-9]/g, '') : '';
    if (phoneClean.startsWith('01')) phoneClean = '2' + phoneClean;
    const url = phoneClean ? `https://wa.me/${phoneClean}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  }

  copyWhatsAppText() {
    const raw = decodeURIComponent(this.generateWhatsAppText());
    navigator.clipboard.writeText(raw).then(() => {
      this.showToast('📋 تم نسخ نص عرض السعر لواتساب بنجاح!');
    });
  }

  printQuote() {
    window.print();
  }

  downloadPDF() {
    const element = document.querySelector('.quote-page');
    if (!element || typeof html2pdf === 'undefined') {
      window.print();
      return;
    }
    this.showToast('📄 جاري تصدير ملف الـ PDF...');
    const opt = {
      margin: 6,
      filename: `عرض_سعر_${this.state.projectName || '3D_Print'}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  }

  exportCSV() {
    const res = this.calculate();
    const s = this.state;
    const cur = CURRENCY_RATES[s.selectedCurrency] || CURRENCY_RATES.EGP;
    const rows = [
      ['البند', 'القيمة', 'الوحدة'],
      [`العملة المستخدمة في هذا التصدير`, cur.symbol, ''],
      ['اسم المشروع', s.projectName || 'غير مسمى', ''],
      ['اسم العميل', s.clientName || 'غير مسجل', ''],
      ['رقم الهاتف', s.clientPhone || '', ''],
      ['اللون', s.partColor, ''],
      ['دقة الطباعة', s.layerHeight, ''],
      ['وزن القطعة', s.partWeight, 'جرام'],
      ['سعر بكرة الفيلامنت', this.formatCurrency(s.spoolPrice), ''],
      ['تكلفة الخامة', this.formatCurrency(res.materialCost), ''],
      ['ساعات الطباعة', s.printHours, 'ساعة'],
      ['تكلفة الكهرباء', this.formatCurrency(res.powerCost), ''],
      ['تكلفة إهلاك الطابعة', this.formatCurrency(res.depreciationCost), ''],
      ['تكلفة العمالة', this.formatCurrency(res.laborCost), ''],
      ['إضافات ومستلزمات', this.formatCurrency(res.additionalCost), ''],
      ['تكلفة التسويق والإعلانات', this.formatCurrency(res.marketingCost), ''],
      ['تكلفة الفشل والهدر', this.formatCurrency(res.failureCost), ''],
      ['إجمالي التكلفة للقطعة', this.formatCurrency(res.totalCost), ''],
      ['سعر البيع المقترح للقطعة', this.formatCurrency(res.finalSellingPrice), ''],
      ['صافي الربح للقطعة', this.formatCurrency(res.profitAmount), ''],
      ['نسبة العائد (Markup)', res.markupPercent.toFixed(1) + '%', ''],
      ['الكمية', res.qty, 'قطعة'],
      ['إجمالي تكلفة الدفعة', this.formatCurrency(res.batchTotalCost), ''],
      ['إجمالي بيع الدفعة', this.formatCurrency(res.batchTotalPrice), ''],
      ['إجمالي صافي ربح الدفعة', this.formatCurrency(res.batchTotalProfit), ''],
      ['أجر التصميم CAD', this.formatCurrency(res.cadFee), ''],
      ['ضريبة القيمة المضافة (VAT)', res.includeVAT ? `${res.vatPercent}% = ${this.formatCurrency(res.vatAmount)}` : 'غير مفعّلة', ''],
      ['تكلفة الشحن', this.formatCurrency(res.shippingFee), ''],
      ['الإجمالي الكلي للطلب', this.formatCurrency(res.grandOrderTotal), ''],
      ['العربون المدفوع', this.formatCurrency(res.deposit), ''],
      ['المتبقي عند الاستلام', this.formatCurrency(res.remainingBalance), '']
    ];

    const csvContent = '\uFEFF' + rows.map(e => e.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `حساب_تكلفة_${s.projectName || '3D'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.showToast('📊 تم تصدير ملف CSV بنجاح!');
  }

  // ================= 14. SAVED PROJECTS & PIPELINE =================
  saveCurrentProject() {
    const res = this.calculate();
    const s = this.state;
    const project = {
      id: 'proj_' + Date.now(),
      createdAt: Date.now(),
      name: s.projectName || 'مشروع بدون اسم',
      client: s.clientName || 'عميل عام',
      phone: s.clientPhone || '',
      address: s.clientAddress || '',
      date: new Date().toLocaleDateString('ar-EG'),
      deliveryDueDate: s.deliveryDueDate || '',
      orderStatus: s.orderStatus || 'ready_print',
      sellingPrice: res.finalSellingPrice,
      totalCost: res.totalCost,
      profit: res.profitAmount,
      weight: s.partWeight,
      hours: s.printHours,
      state: { ...s }
    };

    this.savedProjects.unshift(project);
    this.saveProjectsToStorage();

    // Deduct the filament actually consumed by this order from the running spool balance
    let toastMsg = `💾 تم حفظ الطلب والمشروع: ${project.name}`;
    const consumedGrams = (Number(res.partWeight) || 0) * (Number(res.qty) || 1);
    if (consumedGrams > 0) {
      const before = Number(s.spoolRemaining) || 0;
      const after = Math.max(0, before - consumedGrams);
      this.state.spoolRemaining = after;
      project.state.spoolRemaining = after;

      // If an inventory spool is active, deduct from it too and log the movement
      const activeSpool = this.spoolInventory.find(sp => sp.id === s.activeSpoolId);
      let lowStockThreshold = Math.max(50, (Number(s.spoolWeight) || 1000) * 0.15);
      let spoolLabel = 'بكرة غير مسجلة في المخزون';

      if (activeSpool) {
        activeSpool.remainingWeight = Math.max(0, activeSpool.remainingWeight - consumedGrams);
        this.saveSpoolInventoryToStorage();
        const filament = PRESETS.filaments.find(f => f.id === activeSpool.filamentPresetId);
        spoolLabel = `${filament ? filament.name : ''} — ${activeSpool.colorName}`;
        lowStockThreshold = Math.max(50, activeSpool.spoolWeight * 0.15);
        this.renderSpoolInventory();
      }

      this.logSpoolMovement('استهلاك', spoolLabel, -consumedGrams, after, project.name);

      if (after <= lowStockThreshold) {
        toastMsg = `💾 تم الحفظ: ${project.name} — ⚠️ رصيد البكرة منخفض (${after.toFixed(0)} جم فقط، فكر في شراء بكرة جديدة)`;
      }
    }

    this.populateClientAutocomplete();
    this.renderSavedProjectsList();
    this.checkDeadlineAlerts();
    this.renderAnalyticsDashboard();
    this.render();
    this.showToast(toastMsg);
  }

  filterSavedProjects(status) {
    this.currentSavedFilter = status;
    this.renderSavedProjectsList();
  }

  searchSavedProjects(term) {
    this.currentSavedSearchTerm = (term || '').trim().toLowerCase();
    this.renderSavedProjectsList();
  }

  loadProject(id) {
    const proj = this.savedProjects.find(p => p.id === id);
    if (proj && proj.state) {
      this.state = { ...DEFAULT_STATE, ...proj.state };
      this.render();
      this.switchTab('table');
      this.showToast(`📂 تم استرجاع المشروع: ${proj.name}`);
    }
  }

  updateProjectStatus(id, newStatus) {
    const proj = this.savedProjects.find(p => p.id === id);
    if (proj) {
      proj.orderStatus = newStatus;
      if (proj.state) proj.state.orderStatus = newStatus;
      this.saveProjectsToStorage();
      this.renderSavedProjectsList();
      this.renderAnalyticsDashboard();
      this.checkDeadlineAlerts();
      this.showToast(`🔄 تم تحديث حالة الطلب`);
    }
  }

  deleteProject(id) {
    if (confirm('هل أنت متأكد من حذف هذا المشروع المحفوظ؟')) {
      this.savedProjects = this.savedProjects.filter(p => p.id !== id);
      this.saveProjectsToStorage();
      this.populateClientAutocomplete();
      this.renderSavedProjectsList();
      this.checkDeadlineAlerts();
      this.renderAnalyticsDashboard();
      this.showToast('🗑️ تم حذف المشروع.');
    }
  }

  renderSavedProjectsList() {
    const container = document.getElementById('savedProjectsList');
    if (!container) return;

    let list = this.savedProjects;
    if (this.currentSavedFilter && this.currentSavedFilter !== 'all') {
      list = list.filter(p => (p.orderStatus || 'ready_print') === this.currentSavedFilter);
    }

    const term = this.currentSavedSearchTerm || '';
    if (term) {
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(term) ||
        (p.client || '').toLowerCase().includes(term) ||
        (p.phone || '').toLowerCase().includes(term)
      );
    }

    if (list.length === 0) {
      container.innerHTML = '<div class="text-xs text-slate-400 text-center py-6">لا توجد طلبات مطابقة في هذا التصنيف.</div>';
      return;
    }

    const statusBadges = {
      pending_design: '<span class="px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300 font-bold text-[10px]">✏️ قيد التصميم</span>',
      ready_print: '<span class="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 font-bold text-[10px]">⏳ جاهز للطباعة</span>',
      printing: '<span class="px-2 py-0.5 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-900/60 dark:text-cyan-300 font-bold text-[10px]">🖨️ جاري الطباعة</span>',
      post_processing: '<span class="px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 font-bold text-[10px]">🔧 تشطيب ومعالجة</span>',
      ready_ship: '<span class="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-bold text-[10px]">📦 جاهز للشحن</span>',
      delivered: '<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 font-bold text-[10px]">✅ تم التسليم</span>'
    };

    container.innerHTML = list.map(p => `
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-xs gap-3">
        <div>
          <div class="flex items-center gap-2">
            <span class="font-bold text-sm text-slate-800 dark:text-slate-100">${p.name}</span>
            ${statusBadges[p.orderStatus || 'ready_print'] || ''}
          </div>
          <div class="text-slate-500 mt-1">${p.client} ${p.phone ? `(${p.phone})` : ''} • ${p.date} ${p.deliveryDueDate ? `• تسليم: ${p.deliveryDueDate}` : ''} • ${p.weight} جم • ${p.hours} ساعة</div>
        </div>
        <div class="flex items-center gap-2 self-end sm:self-auto">
          <select onchange="app.updateProjectStatus('${p.id}', this.value)" class="text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-2 py-1">
            <option value="pending_design" ${p.orderStatus === 'pending_design' ? 'selected' : ''}>✏️ قيد التصميم</option>
            <option value="ready_print" ${p.orderStatus === 'ready_print' ? 'selected' : ''}>⏳ جاهز للطباعة</option>
            <option value="printing" ${p.orderStatus === 'printing' ? 'selected' : ''}>🖨️ جاري الطباعة</option>
            <option value="post_processing" ${p.orderStatus === 'post_processing' ? 'selected' : ''}>🔧 تشطيب</option>
            <option value="ready_ship" ${p.orderStatus === 'ready_ship' ? 'selected' : ''}>📦 جاهز للشحن</option>
            <option value="delivered" ${p.orderStatus === 'delivered' ? 'selected' : ''}>✅ تم التسليم</option>
          </select>
          <span class="font-black text-emerald-600 font-mono-nums text-sm">${this.formatCurrency(p.sellingPrice)}</span>
          <button onclick="app.loadProject('${p.id}')" class="bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1.5 rounded-lg font-bold">فتح</button>
          <button onclick="app.deleteProject('${p.id}')" class="bg-rose-100 hover:bg-rose-200 text-rose-700 px-2 py-1.5 rounded-lg font-bold"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  // ================= 15. MULTI-SPOOL INVENTORY & MOVEMENT LOG =================
  addSpoolToInventory() {
    const filamentId = document.getElementById('newSpoolFilamentSelect')?.value;
    const colorEl = document.getElementById('newSpoolColorSelect');
    const weightInput = document.getElementById('newSpoolWeightInput');
    const priceInput = document.getElementById('newSpoolPriceInput');

    const filament = PRESETS.filaments.find(f => f.id === filamentId);
    if (!filament) {
      this.showToast('❌ يرجى اختيار نوع الخامة أولاً');
      return;
    }

    const weight = Math.max(1, parseFloat(weightInput?.value) || 1000);
    const price = parseFloat(priceInput?.value) || filament.price;
    const colorName = colorEl?.value || 'غير محدد';

    const spool = {
      id: 'spool_' + Date.now(),
      filamentPresetId: filament.id,
      colorName,
      spoolWeight: weight,
      remainingWeight: weight,
      price,
      dateAdded: new Date().toLocaleDateString('ar-EG')
    };

    this.spoolInventory.unshift(spool);
    this.saveSpoolInventoryToStorage();
    this.logSpoolMovement('إضافة بكرة جديدة', `${filament.name} — ${colorName}`, weight, weight, 'بكرة جديدة في المخزون');
    this.renderSpoolInventory();

    if (weightInput) weightInput.value = '1000';
    if (priceInput) priceInput.value = '';
    this.showToast(`✅ تمت إضافة بكرة: ${filament.name} — ${colorName}`);
  }

  useSpool(id) {
    const spool = this.spoolInventory.find(sp => sp.id === id);
    if (!spool) return;
    const filament = PRESETS.filaments.find(f => f.id === spool.filamentPresetId);

    this.state.activeSpoolId = spool.id;
    this.state.selectedFilamentPreset = spool.filamentPresetId;
    this.state.spoolPrice = spool.price;
    this.state.spoolWeight = spool.spoolWeight;
    this.state.spoolRemaining = spool.remainingWeight;
    if (spool.colorName && spool.colorName !== 'غير محدد') this.state.partColor = spool.colorName;

    this.renderSpoolInventory();
    this.render();
    this.showToast(`🎯 البكرة النشطة الآن: ${filament ? filament.name : ''} — ${spool.colorName}`);
  }

  refillSpool(id) {
    const spool = this.spoolInventory.find(sp => sp.id === id);
    if (!spool) return;
    if (!confirm('هل تريد تسجيل هذه البكرة كبكرة جديدة/ممتلئة بالكامل من جديد؟')) return;

    const added = Math.max(0, spool.spoolWeight - spool.remainingWeight);
    spool.remainingWeight = spool.spoolWeight;
    this.saveSpoolInventoryToStorage();

    const filament = PRESETS.filaments.find(f => f.id === spool.filamentPresetId);
    this.logSpoolMovement('إعادة تعبئة / بكرة بديلة', `${filament ? filament.name : ''} — ${spool.colorName}`, added, spool.remainingWeight, '');

    if (this.state.activeSpoolId === spool.id) {
      this.state.spoolRemaining = spool.remainingWeight;
      this.render();
    }
    this.renderSpoolInventory();
    this.showToast('🔄 تم تسجيل البكرة كبكرة جديدة بالكامل');
  }

  deleteSpool(id) {
    if (!confirm('هل تريد حذف هذه البكرة من المخزون؟ (هذا لن يمسح سجل حركتها السابق)')) return;
    this.spoolInventory = this.spoolInventory.filter(sp => sp.id !== id);
    if (this.state.activeSpoolId === id) {
      this.state.activeSpoolId = null;
      this.render();
    }
    this.saveSpoolInventoryToStorage();
    this.renderSpoolInventory();
    this.showToast('🗑️ تم حذف البكرة من المخزون');
  }

  renderSpoolInventory() {
    const container = document.getElementById('spoolInventoryList');
    if (!container) return;

    if (!this.spoolInventory || this.spoolInventory.length === 0) {
      container.innerHTML = '<div class="text-xs text-slate-400 text-center py-3">لا توجد بكرات مسجلة في المخزون بعد — أضف أول بكرة من الأعلى.</div>';
      return;
    }

    container.innerHTML = this.spoolInventory.map(sp => {
      const filament = PRESETS.filaments.find(f => f.id === sp.filamentPresetId);
      const pct = Math.min(100, Math.max(0, (sp.remainingWeight / (sp.spoolWeight || 1)) * 100));
      const isActive = this.state.activeSpoolId === sp.id;
      const isLow = sp.remainingWeight <= Math.max(50, sp.spoolWeight * 0.15);

      return `
        <div class="p-2.5 rounded-xl border ${isActive ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800'}">
          <div class="flex items-center justify-between mb-1">
            <span class="text-xs font-bold">${filament ? filament.name : 'خامة'} — ${sp.colorName} ${isActive ? '🎯' : ''}</span>
            <span class="text-[11px] font-mono ${isLow ? 'text-rose-500 font-bold' : 'text-slate-500'}">${sp.remainingWeight.toFixed(0)} / ${sp.spoolWeight} جم</span>
          </div>
          <div class="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
            <div class="${isLow ? 'bg-rose-500' : 'bg-blue-600'} h-full rounded-full transition-all" style="width:${pct}%"></div>
          </div>
          <div class="flex items-center gap-1.5 text-[11px]">
            <button onclick="app.useSpool('${sp.id}')" class="flex-1 ${isActive ? 'bg-slate-300 dark:bg-slate-600 cursor-default' : 'bg-blue-600 hover:bg-blue-700'} text-white font-bold py-1 rounded-lg transition">${isActive ? '✓ نشطة الآن' : 'استخدام الآن'}</button>
            <button onclick="app.refillSpool('${sp.id}')" title="بكرة جديدة/إعادة تعبئة" class="p-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-lg"><i class="fas fa-rotate"></i></button>
            <button onclick="app.deleteSpool('${sp.id}')" title="حذف" class="p-1.5 bg-rose-100 dark:bg-rose-950/40 text-rose-600 hover:bg-rose-200 rounded-lg"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
    }).join('');
  }

  logSpoolMovement(type, spoolName, delta, remainingAfter, note) {
    const entry = {
      id: 'log_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      date: new Date().toLocaleString('ar-EG'),
      type,
      spoolName,
      delta: Number(delta) || 0,
      remainingAfter: Number(remainingAfter) || 0,
      note: note || ''
    };
    this.spoolMovementLog.unshift(entry);
    if (this.spoolMovementLog.length > 200) this.spoolMovementLog = this.spoolMovementLog.slice(0, 200);
    this.saveSpoolMovementLogToStorage();
    this.renderSpoolMovementLog();
  }

  renderSpoolMovementLog() {
    const container = document.getElementById('spoolMovementLogList');
    if (!container) return;

    if (!this.spoolMovementLog || this.spoolMovementLog.length === 0) {
      container.innerHTML = '<div class="text-xs text-slate-400 text-center py-3">لا توجد حركات مسجلة بعد.</div>';
      return;
    }

    const typeColors = {
      'استهلاك': 'text-rose-500',
      'إضافة بكرة جديدة': 'text-emerald-600',
      'إعادة تعبئة / بكرة بديلة': 'text-blue-600'
    };

    container.innerHTML = this.spoolMovementLog.slice(0, 50).map(l => `
      <div class="flex items-center justify-between text-[11px] py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0 gap-2">
        <div class="min-w-0">
          <span class="font-bold ${typeColors[l.type] || 'text-slate-600'}">${l.type}</span>
          <span class="text-slate-400"> • ${l.spoolName}</span>
          ${l.note ? `<span class="text-slate-400"> • ${l.note}</span>` : ''}
        </div>
        <div class="text-left shrink-0">
          <div class="font-mono font-bold ${l.delta < 0 ? 'text-rose-500' : 'text-emerald-600'}">${l.delta > 0 ? '+' : ''}${l.delta.toFixed(0)} جم</div>
          <div class="text-slate-400 font-mono">${l.date}</div>
        </div>
      </div>
    `).join('');
  }

  clearSpoolMovementLog() {
    if (!confirm('هل تريد مسح كل سجل حركة البكرات؟ لا يمكن التراجع عن هذا.')) return;
    this.spoolMovementLog = [];
    this.saveSpoolMovementLogToStorage();
    this.renderSpoolMovementLog();
    this.showToast('🗑️ تم مسح سجل الحركة');
  }

  // ================= 16. BACKUP & RESTORE =================
  exportBackup() {
    try {
      const payload = {
        app: 'حاسبة 3D Pro مصر',
        version: 'v19.2',
        exportedAt: new Date().toISOString(),
        state: this.state,
        savedProjects: this.savedProjects,
        spoolInventory: this.spoolInventory,
        spoolMovementLog: this.spoolMovementLog
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `نسخة-احتياطية-حاسبة-3D-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast('📦 تم تنزيل النسخة الاحتياطية بنجاح!');
    } catch (e) {
      console.warn('Backup export failed:', e);
      this.showToast('❌ حدث خطأ أثناء إنشاء النسخة الاحتياطية.');
    }
  }

  triggerImportBackup() {
    const input = document.getElementById('backupImportInput');
    if (input) input.click();
  }

  importBackup(e) {
    const file = e?.target?.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (!data || (!data.state && !data.savedProjects)) {
          this.showToast('❌ ملف النسخة الاحتياطية غير صالح.');
          return;
        }

        const projectCount = Array.isArray(data.savedProjects) ? data.savedProjects.length : 0;
        const spoolCount = Array.isArray(data.spoolInventory) ? data.spoolInventory.length : 0;
        const confirmed = confirm(
          `سيتم استبدال كل البيانات الحالية (الحاسبة + ${this.savedProjects.length} طلب محفوظ + ${this.spoolInventory.length} بكرة) بالنسخة المستوردة (${projectCount} طلب محفوظ + ${spoolCount} بكرة). هل تريد المتابعة؟`
        );
        if (!confirmed) return;

        if (data.state) this.state = { ...DEFAULT_STATE, ...data.state };
        if (Array.isArray(data.savedProjects)) this.savedProjects = data.savedProjects;
        if (Array.isArray(data.spoolInventory)) this.spoolInventory = data.spoolInventory;
        if (Array.isArray(data.spoolMovementLog)) this.spoolMovementLog = data.spoolMovementLog;

        this.saveState();
        this.saveProjectsToStorage();
        this.saveSpoolInventoryToStorage();
        this.saveSpoolMovementLogToStorage();
        this.populatePresets();
        this.populateClientAutocomplete();
        this.renderSavedProjectsList();
        this.renderSpoolInventory();
        this.renderSpoolMovementLog();
        this.checkDeadlineAlerts();
        this.render();
        this.showToast('✅ تم استرجاع النسخة الاحتياطية بنجاح!');
      } catch (err) {
        console.warn('Backup import failed:', err);
        this.showToast('❌ تعذّرت قراءة ملف النسخة الاحتياطية.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  // ================= 17. TABS & THEME =================
  resetToDefaults() {
    if (confirm('هل تريد تصفير جميع القيم والبدء من جديد؟')) {
      this.state = { ...DEFAULT_STATE };
      this.render();
      this.showToast('🔄 تم تصفير جميع المدخلات للبدء من الصفر!');
    }
  }

  installPWA() {
    if (window.deferredPWAInstallPrompt) {
      window.deferredPWAInstallPrompt.prompt();
      window.deferredPWAInstallPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          this.showToast('🚀 جاري تثبيت التطبيق على هاتفك...');
        }
        window.deferredPWAInstallPrompt = null;
      });
    } else {
      alert('لتثبيت التطبيق على هاتفك أندرويد أو أيفون:\n\n1. افتح الموقع من المتصفح (Chrome أو Safari)\n2. اضغط القائمة (⋮) أو مشاركة (⎋)\n3. اختر "التثبيت كـ تطبيق" أو "إضافة إلى الشاشة الرئيسية"');
    }
  }

  toggleSidebar(forceState) {
    const sb = document.getElementById('appSidebar');
    const bd = document.getElementById('sidebarBackdrop');
    if (!sb) return;
    const isClosed = sb.classList.contains('translate-x-full');
    const shouldOpen = (forceState !== undefined) ? forceState : isClosed;

    if (shouldOpen) {
      sb.classList.remove('translate-x-full');
      if (bd) bd.classList.remove('hidden');
    } else {
      sb.classList.add('translate-x-full');
      if (bd) bd.classList.add('hidden');
    }
  }

  switchTab(tabName) {
    this.state.activeTab = tabName;
    const tabs = ['table', 'dashboard', 'client', 'assembly', 'roi', 'quote', 'analytics', 'troubleshoot', 'saved', 'customerOrders'];
    tabs.forEach(tab => {
      const pane = document.getElementById(`tabPane_${tab}`);
      const btn = document.getElementById(`tabBtn_${tab}`);
      if (pane) {
        if (tab === tabName) pane.classList.remove('hidden');
        else pane.classList.add('hidden');
      }
      if (btn) {
        if (tab === tabName) {
          btn.className = 'sidebar-nav-item active flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs bg-blue-600 text-white shadow-md transition group';
        } else {
          btn.className = 'sidebar-nav-item flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition group';
        }
      }
    });

    if (window.innerWidth < 1024) {
      this.toggleSidebar(false);
    }

    if (tabName === 'dashboard' || tabName === 'table' || tabName === 'analytics') {
      setTimeout(() => {
        const res = this.calculate();
        this.renderCharts(res);
        this.renderAnalyticsDashboard();
      }, 100);
    }

    if (tabName === 'dashboard') {
      // The STL viewer lives in this tab and starts out hidden, so its canvas was
      // sized against a fallback default. Re-sync it now that it's actually visible.
      setTimeout(() => this.handleWindowResize(), 100);
    }

    if (tabName === 'customerOrders') {
      this.fetchCustomerOrders();
    }
  }

  handleFilamentPresetChange(val) {
    const item = PRESETS.filaments.find(f => f.id === val);
    if (item) {
      this.state.selectedFilamentPreset = item.id;
      this.state.spoolPrice = item.price;
      this.state.spoolWeight = item.weight;
      this.render();
      this.showToast(`✨ تم اختيار: ${item.name} (${item.price} ج.م)`);
    }
  }

  toggleTheme() {
    this.state.darkMode = !this.state.darkMode;
    this.applyTheme();
    this.saveState();
    this.renderCharts(this.calculate());
  }

  applyTheme() {
    const isDark = this.state.darkMode;
    document.documentElement.classList.toggle('dark', isDark);

    const icon = document.getElementById('themeIcon');
    const text = document.getElementById('themeText');
    if (icon) icon.className = isDark ? 'fas fa-sun text-amber-400 text-sm' : 'fas fa-moon text-slate-600 dark:text-slate-300 text-sm';
    if (text) text.textContent = isDark ? 'الوضع النهاري' : 'الوضع الليلي';

    if (this.threeScene && typeof THREE !== 'undefined') {
      this.threeScene.background = new THREE.Color(isDark ? 0x090d16 : 0xf1f5f9);
    }
  }

  // ================= 18. CUSTOMER ORDERS (Google Sheets Backend) =================
  isCustomerOrdersConfigured() {
    return CUSTOMER_ORDERS_CONFIG.appsScriptUrl && !CUSTOMER_ORDERS_CONFIG.appsScriptUrl.includes('PASTE_YOUR');
  }

  async fetchCustomerOrders() {
    const listEl = document.getElementById('customerOrdersList');
    const warningEl = document.getElementById('customerOrdersConfigWarning');
    if (!listEl) return;

    if (!this.isCustomerOrdersConfigured()) {
      if (warningEl) warningEl.classList.remove('hidden');
      listEl.innerHTML = '';
      return;
    }
    if (warningEl) warningEl.classList.add('hidden');

    listEl.innerHTML = '<div class="text-xs text-slate-400 text-center py-6">⏳ جاري تحميل الطلبات...</div>';

    try {
      const key = getAdminKey();
      if (!key) { listEl.innerHTML = '<div class="text-xs text-slate-400 text-center py-6">🔒 مطلوب كلمة سر الأدمن</div>'; return; }
      const res = await fetch(CUSTOMER_ORDERS_CONFIG.appsScriptUrl, {
        method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'list', key })
      });
      const data = await res.json();

      if (!data.success) {
        if (data.error === 'unauthorized') sessionStorage.removeItem('3d_admin_key');
        listEl.innerHTML = `<div class="text-xs text-rose-500 text-center py-6">❌ ${escapeHtml(data.error || 'تعذر تحميل الطلبات')}</div>`;
        return;
      }

      this.customerOrders = data.orders || [];
      this.renderCustomerOrders();
      this.updateCustomerOrdersBadge();
    } catch (err) {
      console.warn('Fetch customer orders failed:', err);
      listEl.innerHTML = '<div class="text-xs text-rose-500 text-center py-6">❌ تعذر الاتصال بقاعدة البيانات. تحقق من الإنترنت والرابط.</div>';
    }
  }

  updateCustomerOrdersBadge() {
    const badge = document.getElementById('customerOrdersBadge');
    if (!badge) return;
    const pendingCount = (this.customerOrders || []).filter(o => o.Status === 'pending_review').length;
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  renderCustomerOrders() {
    const listEl = document.getElementById('customerOrdersList');
    if (!listEl) return;

    const orders = this.customerOrders || [];
    if (this.ordersView === 'kanban' && orders.length) { this.renderOrdersKanban(listEl, orders); return; }
    if (orders.length === 0) {
      listEl.innerHTML = '<div class="text-xs text-slate-400 text-center py-6">لا توجد طلبات من العملاء حتى الآن.</div>';
      return;
    }

    const statusBadges = {
      pending_review: '<span class="px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300 font-bold text-[10px]">⏳ قيد المراجعة</span>',
      priced: '<span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300 font-bold text-[10px]">💰 تم التسعير</span>',
      printing: '<span class="px-2 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 font-bold text-[10px]">🖨️ جاري الطباعة</span>',
      ready: '<span class="px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300 font-bold text-[10px]">📦 جاهز</span>',
      delivered: '<span class="px-2 py-0.5 rounded bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300 font-bold text-[10px]">✅ تم التسليم</span>',
      rejected: '<span class="px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300 font-bold text-[10px]">❌ مرفوض</span>'
    };

    listEl.innerHTML = orders.map(o => {
      const status = o.Status || 'pending_review';
      const price = o.FinalPrice || o.AutoPrice || '';
      const fileTypeLabel = o.FileType === 'gcode' ? '⚡ G-code' : o.FileType === 'stl' ? '🧊 STL' : '📎 بدون ملف';
      const dateStr = o.DateSubmitted ? new Date(o.DateSubmitted).toLocaleString('ar-EG') : '';

      return `
        <div class="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 space-y-2.5">
          <div class="flex items-center justify-between flex-wrap gap-1.5">
            <div>
              <div class="font-bold text-sm">${escapeHtml(o.PartName || 'بدون اسم')}</div>
              <div class="text-[11px] text-slate-500">${escapeHtml(o.ClientName || '')} • ${escapeHtml(o.Phone || '')} ${o.Phone ? `<a target="_blank" rel="noopener" class="text-emerald-600" href="https://wa.me/${String(o.Phone).replace(/[^0-9]/g,'').replace(/^0/,'20')}?text=${encodeURIComponent('أهلاً ' + (o.ClientName||'') + '، بخصوص طلبك كود ' + (o.TrackingCode||'') + ' — الحالة: ' + (status))}">💬 واتساب</a>` : ''}</div>
            </div>
            ${statusBadges[status] || ''}
          </div>

          <div class="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
            <span>${fileTypeLabel}</span>
            ${o.ExtractedWeight ? `<span>⚖️ ${o.ExtractedWeight} جم</span>` : ''}
            ${o.ExtractedHours ? `<span>⏱️ ${o.ExtractedHours} ساعة</span>` : ''}
            <span>${dateStr}</span>
          </div>

          ${o.Notes ? `<div class="text-[11px] text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 p-2 rounded-lg">📝 ${escapeHtml(o.Notes)}</div>` : ''}
          ${safeDriveLink(o.FileLink) ? `<a rel="noopener" href="${escapeHtml(safeDriveLink(o.FileLink))}" target="_blank" class="inline-block text-[11px] text-blue-600 hover:underline"><i class="fas fa-file-arrow-down"></i> فتح الملف المرفوع</a>` : ''}

          <div class="grid grid-cols-2 gap-2 pt-1">
            <div>
              <label class="block text-[10px] text-slate-500 mb-0.5">السعر النهائي (ج.م)</label>
              <input type="number" id="price_${o.OrderID}" value="${o.FinalPrice || o.AutoPrice || ''}" placeholder="حدد السعر" class="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono">
            </div>
            <div>
              <label class="block text-[10px] text-slate-500 mb-0.5">الحالة</label>
              <select id="status_${o.OrderID}" class="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs">
                <option value="pending_review" ${status === 'pending_review' ? 'selected' : ''}>⏳ قيد المراجعة</option>
                <option value="priced" ${status === 'priced' ? 'selected' : ''}>💰 تم التسعير</option>
                <option value="printing" ${status === 'printing' ? 'selected' : ''}>🖨️ جاري الطباعة</option>
                <option value="ready" ${status === 'ready' ? 'selected' : ''}>📦 جاهز</option>
                <option value="delivered" ${status === 'delivered' ? 'selected' : ''}>✅ تم التسليم</option>
                <option value="rejected" ${status === 'rejected' ? 'selected' : ''}>❌ مرفوض</option>
              </select>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button onclick="app.saveCustomerOrderUpdate('${escapeHtml(o.OrderID)}')" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 rounded-lg transition">
              <i class="fas fa-check"></i> حفظ السعر والحالة
            </button>
            <button onclick="app.convertCustomerOrderToProject('${escapeHtml(o.OrderID)}')" title="نقل بيانات الطلب للحاسبة الرئيسية" class="px-3 py-1.5 bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 text-xs font-bold rounded-lg transition">
              <i class="fas fa-arrow-left-long"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  async saveCustomerOrderUpdate(orderId) {
    if (!this.isCustomerOrdersConfigured()) return;
    const priceInput = document.getElementById(`price_${orderId}`);
    const statusSelect = document.getElementById(`status_${orderId}`);
    const finalPrice = priceInput ? priceInput.value : '';
    const status = statusSelect ? statusSelect.value : '';

    try {
      const res = await fetch(CUSTOMER_ORDERS_CONFIG.appsScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'update',
          key: getAdminKey(),
          orderId, finalPrice, status
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('✅ تم تحديث الطلب بنجاح');
        this.fetchCustomerOrders();
      } else {
        this.showToast('❌ ' + (data.error || 'فشل التحديث'));
      }
    } catch (err) {
      this.showToast('❌ تعذر الاتصال بقاعدة البيانات');
    }
  }

  convertCustomerOrderToProject(orderId) {
    const order = (this.customerOrders || []).find(o => o.OrderID === orderId);
    if (!order) return;

    const clean = v => String(v || '').replace(/[<>]/g, '');
    this.state.projectName = clean(order.PartName);
    this.state.clientName = clean(order.ClientName);
    this.state.clientPhone = clean(order.Phone);
    if (Number(order.ExtractedWeight) > 0) this.state.partWeight = Number(order.ExtractedWeight);
    if (Number(order.ExtractedHours) > 0) this.state.printHours = Number(order.ExtractedHours);

    this.switchTab('table');
    this.render();
    this.showToast(`🔄 تم نقل بيانات "${order.PartName}" للحاسبة — كمّل الإعداد واحفظ الطلب من هنا`);
  }

  // ================= 19. UTILITIES =================
  showToast(msg) {
    let toast = document.getElementById('appToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToast';
      toast.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 transition-all duration-300 transform opacity-0 translate-y-4';
      document.body.appendChild(toast);
    }
    toast.innerHTML = `<i class="fas fa-check-circle text-emerald-400 text-lg"></i> <span>${msg}</span>`;
    toast.classList.remove('opacity-0', 'translate-y-4');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', 'translate-y-4');
    }, 2800);
  }
}

// Global initialization
let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new CostCalculatorApp();
});

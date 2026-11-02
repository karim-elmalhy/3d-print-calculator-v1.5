/**
 * ELMALHY.3D Workshop Manager - Main Application Controller
 * ربط الواجهة التفاعلية والأحداث والموديلات
 */
(function (root) {
  'use strict';

  const DB = root.WorkshopDB;
  const Calc = root.WorkshopCalc;
  const Events = root.WorkshopEvents;
  const Inventory = root.WorkshopInventory;
  const Orders = root.WorkshopOrders;
  const Products = root.WorkshopProducts;
  const Customers = root.WorkshopCustomers;
  const Printer = root.WorkshopPrinter;
  const Dashboard = root.WorkshopDashboard;

  const App = {
    currentTab: 'dashboard',

    init() {
      this.bindNavigation();
      this.populateSelects();
      this.renderCurrentTab();
      this.subscribeEvents();
      this.initCalculator();
      this.initCustomerOrdersConfig();
      console.log('ELMALHY.3D Workshop Manager initialized successfully.');
    },

    bindNavigation() {
      const navItems = document.querySelectorAll('.nav-item');
      navItems.forEach(item => {
        item.addEventListener('click', () => {
          const tab = item.dataset.tab;
          if (!tab) return;
          this.switchTab(tab);
        });
      });
    },

    switchTab(tabId) {
      this.currentTab = tabId;
      // Close mobile sidebar on tab switch
      const sidebar = document.querySelector('.sidebar');
      const overlay = document.getElementById('mobile-overlay');
      if (sidebar) sidebar.classList.remove('mobile-open');
      if (overlay) overlay.classList.remove('active');
      document.querySelectorAll('.nav-item').forEach(it => {
        it.classList.toggle('active', it.dataset.tab === tabId);
      });
      document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.toggle('active', pane.id === `tab-${tabId}`);
      });
      this.renderCurrentTab();
    },

    renderCurrentTab() {
      switch (this.currentTab) {
        case 'dashboard':
          this.renderDashboard();
          break;
        case 'calculator':
          this.calcUpdate();
          break;
        case 'orders':
          this.renderOrders();
          break;
        case 'quotations':
          this.renderQuotations();
          break;
        case 'inventory':
          this.renderInventory();
          break;
        case 'products':
          this.renderProducts();
          break;
        case 'customers':
          this.renderCustomers();
          break;
        case 'printer':
          this.renderPrinter();
          break;
        case 'assembly':
          this.renderAssembly();
          break;
        case 'roi':
          this.renderROI();
          break;
        case 'customer-orders':
          this.renderCustomerOrders();
          break;
        case 'troubleshoot':
          break;
        case 'backup':
          break;
      }
      this.updateStockAlertBadge();
    },

    subscribeEvents() {
      Events.on('inventory:updated', () => this.renderCurrentTab());
      Events.on('order:created', () => this.renderCurrentTab());
      Events.on('order:stage_changed', () => this.renderCurrentTab());
      Events.on('order:payment_recorded', () => this.renderCurrentTab());
      Events.on('production:completed', () => this.renderCurrentTab());
      Events.on('product:added', () => { this.populateSelects(); this.renderCurrentTab(); });
      Events.on('customer:added', () => this.renderCurrentTab());
    },

    // 1. لوحة التحكم
    renderDashboard() {
      const stats = Dashboard.getDashboardStats();

      document.getElementById('kpi-total-sales').textContent = `${stats.financials.totalSales.toLocaleString()} ج.م`;
      document.getElementById('kpi-net-profits').textContent = `${stats.financials.totalProfits.toLocaleString()} ج.م`;
      document.getElementById('kpi-margin-rate').textContent = `هامش الربح: ${stats.financials.marginPercent}%`;
      document.getElementById('kpi-profit-per-hour').textContent = `${stats.efficiency.profitPerPrintHour} ج.م/س`;
      document.getElementById('kpi-failure-rate').textContent = `${stats.efficiency.failureRate}%`;
      document.getElementById('kpi-utilization-rate').textContent = `استغلال الماكينة: ${stats.efficiency.utilizationRate}%`;
      document.getElementById('kpi-active-orders').textContent = stats.orders.inProduction;
      document.getElementById('kpi-delayed-orders').textContent = `طلبات متأخرة: ${stats.orders.delayed}`;
      document.getElementById('kpi-remaining-balance').textContent = `${stats.financials.totalRemaining.toLocaleString()} ج.م`;

      // التنبيهات
      const alertsContainer = document.getElementById('dashboard-stock-alerts-container');
      if (stats.inventory.lowStockAlertsCount > 0) {
        alertsContainer.innerHTML = `
          <div class="alert-banner critical">
            <span>⚠️ يوجد <strong>${stats.inventory.lowStockAlertsCount} أصناف</strong> في المخزون قاربت على النفاد أو تجاوزت حد إعادة الطلب!</span>
            <button class="btn btn-sm btn-secondary" onclick="App.switchTab('inventory')" style="margin-right: auto;">عرض المخزون</button>
          </div>
        `;
      } else {
        alertsContainer.innerHTML = '';
      }

      // جدول الأكثر مبيعاً
      const topSellingTbody = document.getElementById('top-selling-table-body');
      if (stats.products.topSelling.length) {
        topSellingTbody.innerHTML = stats.products.topSelling.map(p => `
          <tr>
            <td><strong>${p.name}</strong></td>
            <td><code>${p.sku || 'N/A'}</code></td>
            <td>${p.soldQty} قطعة</td>
            <td style="color: var(--accent-green);">${p.revenue.toLocaleString()} ج.م</td>
          </tr>
        `).join('');
      } else {
        topSellingTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">لا توجد مبيعات مكتملة بعد</td></tr>`;
      }

      // جدول الأكثر ربحية
      const profitableTbody = document.getElementById('most-profitable-table-body');
      if (stats.products.mostProfitable.length) {
        profitableTbody.innerHTML = stats.products.mostProfitable.map(p => `
          <tr>
            <td><strong>${p.name}</strong></td>
            <td><code>${p.sku || 'N/A'}</code></td>
            <td style="color: var(--accent-cyan); font-weight: 700;">${p.profit.toLocaleString()} ج.م</td>
          </tr>
        `).join('');
      } else {
        profitableTbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted);">لا توجد بيانات كافية</td></tr>`;
      }
    },

    // 2. مسار الطلبات والمراحل الـ 11
    renderOrders() {
      const orders = Orders.getAllOrders();
      const nonQuotationOrders = orders.filter(o => o.stage !== 'quotation');

      // رندر الكانبان
      const kanbanBoard = document.getElementById('orders-kanban-board');
      kanbanBoard.innerHTML = DB.ORDER_STAGES.map(stage => {
        const stageOrders = orders.filter(o => o.stage === stage.id);
        return `
          <div class="kanban-col">
            <div class="kanban-col-header" style="color: ${stage.color};">
              <span>${stage.icon} ${stage.name}</span>
              <span class="stage-badge" style="background: rgba(255,255,255,0.08);">${stageOrders.length}</span>
            </div>
            <div class="kanban-cards-wrapper" style="display: flex; flex-direction: column; gap: 8px;">
              ${stageOrders.length ? stageOrders.map(o => `
                <div class="kanban-card">
                  <div class="kanban-card-title">${o.code} - ${o.customerName}</div>
                  <div style="font-size: 0.8rem; color: var(--text-muted);">${(o.items || []).map(i => `${i.name} (x${i.quantity})`).join(', ')}</div>
                  <div class="kanban-card-meta">
                    <span style="color: var(--accent-green);">${o.financials.grandTotal} ج.م</span>
                    ${o.productionJob?.stockDeducted ? '<span title="تم خصم الخامات">🧵 تم الخصم</span>' : ''}
                  </div>
                  <div style="display: flex; gap: 4px; margin-top: 6px;">
                    <select class="form-control" style="padding: 4px 6px; font-size: 0.75rem;" onchange="App.onStageSelectChange('${o.id}', this.value)">
                      ${DB.ORDER_STAGES.map(s => `<option value="${s.id}" ${s.id === o.stage ? 'selected' : ''}>${s.name}</option>`).join('')}
                    </select>
                    ${o.stage === 'printing' ? `<button class="btn btn-sm btn-success" onclick="App.openCompleteJobModal('${o.id}')" title="إنهاء وفحص الجودة">🔍</button>` : ''}
                  </div>
                </div>
              `).join('') : '<div style="font-size: 0.75rem; color: var(--text-muted); text-align: center; padding: 10px;">لا توجد طلبات</div>'}
            </div>
          </div>
        `;
      }).join('');

      // رندر الجدول
      const tbody = document.getElementById('orders-table-body');
      if (nonQuotationOrders.length) {
        tbody.innerHTML = nonQuotationOrders.map(o => {
          const currentStageObj = DB.ORDER_STAGES.find(s => s.id === o.stage) || { name: o.stage, color: '#fff' };
          const stageBadge = `<span class="stage-badge stage-${o.stage}">${currentStageObj.icon || ''} ${currentStageObj.name}</span>`;
          const itemsDesc = (o.items || []).map(i => `${i.name} [x${i.quantity}]`).join('<br>');
          const stockStatus = o.productionJob?.stockDeducted
            ? '<span style="color: var(--accent-green); font-size: 0.8rem;">✔️ مخصومة</span>'
            : '<span style="color: var(--text-muted); font-size: 0.8rem;">⏳ لم تخصم بعد</span>';

          return `
            <tr>
              <td><strong>${o.code}</strong></td>
              <td>${o.customerName}<br><small style="color: var(--text-muted);">${o.customerPhone || ''}</small></td>
              <td>${itemsDesc}</td>
              <td>${stageBadge}</td>
              <td><strong>${o.financials.grandTotal} ج.م</strong></td>
              <td>
                <span style="color: var(--accent-green);">${o.financials.depositPaid} ج.م مدفوع</span>
                ${o.financials.remainingBalance > 0 ? `<br><span style="color: var(--accent-orange); font-size: 0.8rem;">متبقي: ${o.financials.remainingBalance} ج.م</span>` : ''}
              </td>
              <td>${stockStatus}</td>
              <td>
                <div style="display: flex; gap: 6px;">
                  <button class="btn btn-sm btn-secondary" onclick="App.openPaymentModal('${o.id}')" title="تسجيل دفعة">💵</button>
                  ${o.stage === 'printing' ? `<button class="btn btn-sm btn-success" onclick="App.openCompleteJobModal('${o.id}')">فحص الجودة</button>` : ''}
                  ${o.stage !== 'printing' && o.stage !== 'delivered' ? `
                    <button class="btn btn-sm btn-primary" onclick="App.confirmMoveToPrinting('${o.id}')" title="نقل للطباعة وخصم الخامات">🖨️ طباعة</button>
                  ` : ''}
                </div>
              </td>
            </tr>
          `;
        }).join('');
      } else {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">لا توجد طلبات إنتاج حالياً</td></tr>`;
      }
    },

    // 3. عروض الأسعار
    renderQuotations() {
      const orders = Orders.getAllOrders();
      const quotations = orders.filter(o => o.stage === 'quotation');
      const tbody = document.getElementById('quotations-table-body');

      if (quotations.length) {
        tbody.innerHTML = quotations.map(q => `
          <tr>
            <td><strong>${q.code}</strong></td>
            <td>${q.customerName}</td>
            <td>${q.customerPhone || '—'}</td>
            <td>${(q.items || []).map(i => `${i.name} (x${i.quantity}) - ${i.unitPrice} ج.م`).join('<br>')}</td>
            <td style="color: var(--accent-green); font-weight: 700;">${q.financials.grandTotal} ج.م</td>
            <td>${new Date(q.createdAt).toLocaleDateString('ar-EG')}</td>
            <td>
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-sm btn-success" onclick="App.approveQuotation('${q.id}')">✅ موافقة وتحويل لإنتاج</button>
              </div>
            </td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">لا توجد عروض أسعار مفتوحة</td></tr>`;
      }
    },

    // 4. المخزون المتكامل
    renderInventory() {
      const inv = Inventory.getInventory();
      const db = DB.loadDB();

      // الفلمنت
      const filTbody = document.getElementById('filaments-table-body');
      filTbody.innerHTML = (inv.filaments || []).map(f => {
        const isLow = f.remainingWeightG <= f.reorderLevelG;
        const statusBadge = isLow
          ? `<span class="stage-badge" style="background: rgba(239, 68, 68, 0.2); color: var(--accent-red);">⚠️ منخفض</span>`
          : `<span class="stage-badge" style="background: rgba(16, 185, 129, 0.2); color: var(--accent-green);">متوفر</span>`;

        return `
          <tr>
            <td><strong>${f.name}</strong></td>
            <td><code>${f.material}</code></td>
            <td>${f.color}</td>
            <td style="font-weight: 700; ${isLow ? 'color: var(--accent-red);' : ''}">${f.remainingWeightG} جرام</td>
            <td>${f.reorderLevelG} جرام</td>
            <td>${f.spoolPrice} ج.م</td>
            <td>${statusBadge}</td>
            <td>
              <button class="btn btn-sm btn-secondary" onclick="App.quickStockAdjust('filament', '${f.id}', 1000, 'شراء بكرة جديدة')">+ بكرة</button>
            </td>
          </tr>
        `;
      }).join('');

      // الملحقات
      const hwTbody = document.getElementById('hardware-table-body');
      hwTbody.innerHTML = (inv.hardware || []).map(h => {
        const isLow = h.currentQty <= h.reorderLevel;
        return `
          <tr>
            <td><strong>${h.name}</strong></td>
            <td>${h.category}</td>
            <td style="font-weight: 700; ${isLow ? 'color: var(--accent-red);' : ''}">${h.currentQty}</td>
            <td>${h.unit}</td>
            <td>${h.costPerUnit} ج.م</td>
            <td>${h.reorderLevel}</td>
            <td>
              <button class="btn btn-sm btn-secondary" onclick="App.quickStockAdjust('hardware', '${h.id}', 50, 'توريد دفعة إضافية')">+50</button>
            </td>
          </tr>
        `;
      }).join('');

      // مواد التغليف
      const pkgTbody = document.getElementById('packaging-table-body');
      pkgTbody.innerHTML = (inv.packaging || []).map(p => `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.currentQty} ${p.unit}</td>
          <td>${p.costPerUnit} ج.م</td>
        </tr>
      `).join('');

      // المنتجات التامة
      const fgTbody = document.getElementById('finished-goods-table-body');
      fgTbody.innerHTML = (inv.finishedGoods || []).map(g => `
        <tr>
          <td><strong>${g.name}</strong></td>
          <td><code>${g.sku}</code></td>
          <td>${g.currentStockQty} قطعة</td>
          <td style="color: var(--accent-green);">${g.sellingPrice} ج.م</td>
        </tr>
      `).join('');

      // سجل الحركات
      const ledgerTbody = document.getElementById('stock-ledger-table-body');
      const ledger = (db.stockLedger || []).slice(0, 15);
      if (ledger.length) {
        ledgerTbody.innerHTML = ledger.map(l => {
          const typeMap = {
            'out_production': '<span style="color: var(--accent-orange);">صرف إنتاج</span>',
            'in': '<span style="color: var(--accent-green);">توريد / إضافة</span>',
            'waste': '<span style="color: var(--accent-red);">هالك / تالف</span>',
            'adjustment': '<span>تسوية جردية</span>'
          };
          return `
            <tr>
              <td><small>${new Date(l.timestamp).toLocaleString('ar-EG')}</small></td>
              <td><strong>${l.itemName || l.itemId}</strong></td>
              <td>${typeMap[l.changeType] || l.changeType}</td>
              <td style="font-weight: 700; direction: ltr; text-align: right;">${l.qty} ${l.unit || ''}</td>
              <td>${l.balanceAfter}</td>
              <td><code>${l.referenceJobId || '—'}</code></td>
              <td><small style="color: var(--text-muted);">${l.notes || ''}</small></td>
            </tr>
          `;
        }).join('');
      } else {
        ledgerTbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">لا توجد حركات مسجلة</td></tr>`;
      }
    },

    // 5. كتالوج المنتجات
    renderProducts() {
      const products = Products.getProducts();
      const tbody = document.getElementById('products-catalog-table-body');

      tbody.innerHTML = products.map(p => {
        const hwText = (p.hardwareRequired || []).map(h => `${h.name} (x${h.qty})`).join(', ') || 'لا يوجد';
        const tiersText = (p.wholesaleTiers || []).map(t => `${t.min}+ قطة خصم ${t.pct}%`).join(' | ') || '—';

        return `
          <tr>
            <td><code>${p.sku}</code></td>
            <td><strong>${p.name}</strong><br><small style="color: var(--text-muted);">${p.description || ''}</small></td>
            <td>${p.category}</td>
            <td style="color: var(--accent-green); font-weight: 700;">${p.basePrice} ج.م</td>
            <td>${p.defaultWeightG} جرام</td>
            <td>${p.defaultPrintHours} س</td>
            <td><small>${tiersText}</small></td>
            <td><small>${hwText}</small></td>
            <td style="text-align:center">
              <button type="button" class="btn btn-xs btn-primary" onclick="App.openProduct3DModal('${p.id}')">👁️ استعراض 3D</button>
            </td>
          </tr>
        `;
      }).join('');
    },

    // 6. العملاء
    renderCustomers() {
      const customers = Customers.getCustomers();
      const tbody = document.getElementById('customers-table-body');

      tbody.innerHTML = customers.map(c => `
        <tr>
          <td><strong>${c.name}</strong></td>
          <td>${c.phone || '—'}</td>
          <td>${c.address || '—'}</td>
          <td>${c.ordersCount || 0}</td>
          <td style="color: var(--accent-green); font-weight: 700;">${(c.totalSpent || 0).toLocaleString()} ج.م</td>
          <td><small style="color: var(--text-muted);">${c.notes || ''}</small></td>
        </tr>
      `).join('');
    },

    // 7. إعدادات الطابعة
    renderPrinter() {
      const printer = Printer.getPrimaryPrinter();
      const hourly = Printer.calculateHourlyCost();
      const db = DB.loadDB();

      document.getElementById('printer-name').value = printer.name;
      document.getElementById('printer-price').value = printer.purchasePrice;
      document.getElementById('printer-lifespan').value = printer.lifespanHours;
      document.getElementById('printer-power').value = printer.powerKw;
      document.getElementById('printer-elec-rate').value = db.settings?.electricityRate || 2.5;
      document.getElementById('printer-consumables').value = printer.consumablesCostPerHour;

      document.getElementById('calc-hourly-power').textContent = `${hourly.powerCostPerHour} ج.م/س`;
      document.getElementById('calc-hourly-deprec').textContent = `${hourly.depreciationPerHour} ج.م/س`;
      document.getElementById('calc-hourly-consumables').textContent = `${hourly.consumablesPerHour} ج.م/س`;
      document.getElementById('calc-hourly-total').textContent = `${hourly.totalHourlyCost} ج.م/س`;
    },

    updateStockAlertBadge() {
      const alerts = Inventory.getLowStockAlerts();
      const badge = document.getElementById('sidebar-stock-alert-badge');
      if (alerts.length > 0) {
        badge.textContent = alerts.length;
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    },

    populateSelects() {
      // ملء الفلمنت
      const inv = Inventory.getInventory();
      const filSelect = document.getElementById('order-filament-select');
      if (filSelect) {
        filSelect.innerHTML = (inv.filaments || []).map(f =>
          `<option value="${f.id}">${f.name} - ${f.color} (${f.remainingWeightG}g متبقي)</option>`
        ).join('');
      }

      // ملء المنتجات
      const products = Products.getProducts();
      const prodSelect = document.getElementById('order-product-select');
      if (prodSelect) {
        prodSelect.innerHTML = '<option value="">-- قطعة مخصصة حسب الطلب --</option>' +
          products.map(p => `<option value="${p.id}">${p.name} (${p.sku})</option>`).join('');
      }
    },

    // Modal Operations
    openNewOrderModal(isQuotation = false) {
      document.getElementById('order-is-quote').value = isQuotation ? 'true' : 'false';
      document.getElementById('modal-order-title').textContent = isQuotation ? 'إنشاء عرض سعر رسمي جديد' : 'إنشاء طلب إنتاج مباشر';
      document.getElementById('order-form').reset();
      this.populateSelects();
      this.recalcOrderModal();
      this.openModal('modal-order');
    },

    onOrderProductSelected() {
      const selId = document.getElementById('order-product-select').value;
      if (!selId) return;
      const prod = Products.getProductById(selId);
      if (!prod) return;

      document.getElementById('order-item-name').value = prod.name;
      document.getElementById('order-item-weight').value = prod.defaultWeightG;
      document.getElementById('order-item-hours').value = prod.defaultPrintHours;
      this.recalcOrderModal();
    },

    recalcOrderModal() {
      const weight = Number(document.getElementById('order-item-weight').value) || 0;
      const hours = Number(document.getElementById('order-item-hours').value) || 0;
      const qty = Number(document.getElementById('order-item-qty').value) || 1;
      const margin = Number(document.getElementById('order-margin-pct').value) || 40;
      const postCost = Number(document.getElementById('order-postprocess-cost').value) || 0;
      const shipping = Number(document.getElementById('order-shipping-fee').value) || 0;
      const deposit = Number(document.getElementById('order-deposit-paid').value) || 0;

      const calcRes = Calc.calculateCost({
        partWeight: weight,
        printHours: hours,
        quantity: qty,
        profitMarginPercent: margin,
        postProcessCost: postCost,
        shippingFee: shipping,
        depositPaid: deposit
      });

      document.getElementById('modal-calc-unit-cost').textContent = `${calcRes.totalUnitCost} ج.م`;
      document.getElementById('modal-calc-unit-price').textContent = `${calcRes.finalUnitPrice} ج.م`;
      document.getElementById('modal-calc-grand-total').textContent = `${calcRes.grandOrderTotal} ج.م`;
      document.getElementById('modal-calc-remaining').textContent = `${calcRes.remainingBalance} ج.م`;
    },

    saveNewOrder(e) {
      e.preventDefault();
      const isQuote = document.getElementById('order-is-quote').value === 'true';
      const custName = document.getElementById('order-cust-name').value.trim();
      const custPhone = document.getElementById('order-cust-phone').value.trim();
      const itemName = document.getElementById('order-item-name').value.trim();
      const prodId = document.getElementById('order-product-select').value || null;
      const filId = document.getElementById('order-filament-select').value;
      const weight = Number(document.getElementById('order-item-weight').value) || 50;
      const hours = Number(document.getElementById('order-item-hours').value) || 2;
      const qty = Number(document.getElementById('order-item-qty').value) || 1;
      const margin = Number(document.getElementById('order-margin-pct').value) || 40;
      const postCost = Number(document.getElementById('order-postprocess-cost').value) || 0;
      const shipping = Number(document.getElementById('order-shipping-fee').value) || 0;
      const deposit = Number(document.getElementById('order-deposit-paid').value) || 0;
      const notes = document.getElementById('order-notes')?.value.trim() || '';

      const order = Orders.createOrder({
        notes: notes,
        customerName: custName,
        customerPhone: custPhone,
        isQuotation: isQuote,
        stage: isQuote ? 'quotation' : 'new',
        shippingFee: shipping,
        depositPaid: deposit,
        items: [
          {
            productId: prodId,
            name: itemName,
            filamentId: filId,
            weight,
            hours,
            quantity: qty,
            marginPercent: margin,
            postProcessCost: postCost
          }
        ]
      });

      this.closeModal('modal-order');
      alert(`تم إنشاء ${isQuote ? 'عرض السعر' : 'الطلب'} ${order.code} بنجاح!`);
      this.switchTab(isQuote ? 'quotations' : 'orders');
    },

    onStageSelectChange(orderId, newStage) {
      if (newStage === 'printing') {
        this.confirmMoveToPrinting(orderId);
      } else {
        Orders.updateOrderStage(orderId, newStage);
      }
    },

    confirmMoveToPrinting(orderId) {
      const order = Orders.getOrderById(orderId);
      if (!order) return;

      const confirmMsg = `هل تريد نقل الطلب ${order.code} إلى مرحلة «جاري الطباعة»؟\n\nتنبيه: سيتم خصم الخامات (الفلمنت والملحقات) تلقائياً من المخزون وتثبيتها.`;
      if (confirm(confirmMsg)) {
        const res = Orders.updateOrderStage(orderId, 'printing');
        if (res.stockResult?.success) {
          alert(`تم بدء الطباعة وخصم الخامات بنجاح!\n${res.stockResult.message}`);
        }
      }
    },

    approveQuotation(orderId) {
      if (confirm('هل ترغب في اعتماد عرض السعر وتحويله إلى طلب مؤكد في خط الإنتاج؟')) {
        Orders.updateOrderStage(orderId, 'approved');
        this.switchTab('orders');
      }
    },

    openCompleteJobModal(orderId) {
      const order = Orders.getOrderById(orderId);
      if (!order) return;

      document.getElementById('job-order-id').value = orderId;
      document.getElementById('job-actual-weight').value = order.productionJob?.estimatedWeightG || 50;
      document.getElementById('job-actual-hours').value = order.productionJob?.estimatedHours || 2;
      this.openModal('modal-complete-job');
    },

    saveJobCompletion(e) {
      e.preventDefault();
      const orderId = document.getElementById('job-order-id').value;
      const status = document.getElementById('job-status').value;
      const actualWeightG = Number(document.getElementById('job-actual-weight').value);
      const actualHours = Number(document.getElementById('job-actual-hours').value);
      const notes = document.getElementById('job-notes').value.trim();

      const res = Orders.completeProductionJob(orderId, {
        status,
        actualWeightG,
        actualHours,
        notes
      });

      this.closeModal('modal-complete-job');
      alert(`تم تسجيل انتهاء مهمة الطباعة!\nفرق الوزن: ${res.comparison.variance.weightDiff}g (${res.comparison.variance.weightDiffPct}%)\nفرق الزمن: ${res.comparison.variance.timeDiff}h`);
    },

    // Inventory operations
    openAddInventoryModal() {
      this.openModal('modal-inventory');
    },

    onInvTypeChanged() {
      const type = document.getElementById('inv-item-type').value;
      document.getElementById('inv-filament-fields').style.display = type === 'filament' ? 'block' : 'none';
      document.getElementById('inv-other-fields').style.display = type !== 'filament' ? 'block' : 'none';
    },

    saveInventoryItem(e) {
      e.preventDefault();
      const type = document.getElementById('inv-item-type').value;
      const name = document.getElementById('inv-item-name').value.trim();
      const reorderLevel = Number(document.getElementById('inv-reorder-level').value) || 10;

      if (type === 'filament') {
        const material = document.getElementById('inv-fil-material').value.trim();
        const color = document.getElementById('inv-fil-color').value.trim();
        const weight = Number(document.getElementById('inv-fil-weight').value) || 1000;
        const price = Number(document.getElementById('inv-fil-price').value) || 750;

        Inventory.addFilament({
          brand: name,
          material,
          color,
          spoolWeightG: weight,
          spoolPrice: price,
          reorderLevelG: reorderLevel
        });
      } else if (type === 'hardware') {
        const qty = Number(document.getElementById('inv-other-qty').value) || 0;
        const cost = Number(document.getElementById('inv-other-cost').value) || 1;
        Inventory.addHardware({ name, currentQty: qty, costPerUnit: cost, reorderLevel });
      } else {
        const qty = Number(document.getElementById('inv-other-qty').value) || 0;
        const cost = Number(document.getElementById('inv-other-cost').value) || 1;
        Inventory.addPackaging({ name, currentQty: qty, costPerUnit: cost, reorderLevel });
      }

      this.closeModal('modal-inventory');
      alert('تمت إضافة الصنف إلى المخزون بنجاح!');
      this.renderCurrentTab();
    },

    quickStockAdjust(type, id, qty, notes) {
      Inventory.recordTransaction(type, id, 'in', qty, notes);
      alert('تم تحديث الرصيد بنجاح!');
    },

    // Product Modal
    openAddProductModal() {
      this.openModal('modal-product');
    },

    saveNewProduct(e) {
      e.preventDefault();
      const name = document.getElementById('prod-name').value.trim();
      const category = document.getElementById('prod-category').value;
      const sku = document.getElementById('prod-sku').value.trim();
      const basePrice = Number(document.getElementById('prod-base-price').value) || 0;
      const weight = Number(document.getElementById('prod-weight').value) || 50;
      const hours = Number(document.getElementById('prod-hours').value) || 2;

      Products.addProduct({
        name,
        category,
        sku,
        basePrice,
        defaultWeightG: weight,
        defaultPrintHours: hours
      });

      this.closeModal('modal-product');
      alert('تمت إضافة المنتج إلى الكتالوج بنجاح!');
      this.renderCurrentTab();
    },

    // Customer Modal
    openAddCustomerModal() {
      this.openModal('modal-customer');
    },

    saveNewCustomer(e) {
      e.preventDefault();
      const name = document.getElementById('cust-name').value.trim();
      const phone = document.getElementById('cust-phone').value.trim();
      const address = document.getElementById('cust-address').value.trim();
      const notes = document.getElementById('cust-notes').value.trim();

      Customers.addCustomer({ name, phone, address, notes });
      this.closeModal('modal-customer');
      alert('تم تسجيل العميل بنجاح!');
      this.renderCurrentTab();
    },

    // Payment Modal
    openPaymentModal(orderId) {
      const order = Orders.getOrderById(orderId);
      if (!order) return;
      document.getElementById('payment-order-id').value = orderId;
      document.getElementById('payment-amount').value = order.financials.remainingBalance || 0;
      this.openModal('modal-payment');
    },

    saveOrderPayment(e) {
      e.preventDefault();
      const orderId = document.getElementById('payment-order-id').value;
      const amount = Number(document.getElementById('payment-amount').value) || 0;
      const method = document.getElementById('payment-method').value;

      Orders.recordPayment(orderId, amount, method);
      this.closeModal('modal-payment');
      alert('تم تسجيل التحصيل وتحديث رصيد الطلب بنجاح!');
      this.renderCurrentTab();
    },

    // Printer settings
    savePrinterSettings(e) {
      e.preventDefault();
      const name = document.getElementById('printer-name').value.trim();
      const price = Number(document.getElementById('printer-price').value);
      const lifespan = Number(document.getElementById('printer-lifespan').value);
      const power = Number(document.getElementById('printer-power').value);
      const elecRate = Number(document.getElementById('printer-elec-rate').value);
      const consumables = Number(document.getElementById('printer-consumables').value);

      const db = DB.loadDB();
      db.settings.electricityRate = elecRate;
      DB.saveDB(db);

      const primary = Printer.getPrimaryPrinter();
      Printer.updatePrinter(primary.id, {
        name,
        purchasePrice: price,
        lifespanHours: lifespan,
        powerKw: power,
        consumablesCostPerHour: consumables
      });

      alert('تم حفظ إعدادات الطابعة وتحديث تكلفة ساعة التشغيل!');
      this.renderPrinter();
    },

    // Backup & Restore
    exportBackup() {
      const json = DB.exportBackupJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ELMALHY_3D_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },

    importBackup() {
      const fileInput = document.getElementById('backup-file-input');
      const file = fileInput.files[0];
      if (!file) {
        alert('يرجى اختيار ملف JSON للاستعادة');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = DB.importBackupJSON(e.target.result);
        if (result.success) {
          alert('تم استعادة كافة بيانات الورشة بنجاح!');
          this.renderCurrentTab();
        } else {
          alert('فشلت الاستعادة: ' + result.error);
        }
      };
      reader.readAsText(file);
    },

    // Modal Helpers
    openModal(id) {
      const modal = document.getElementById(id);
      if (modal) modal.classList.add('active');
    },

    closeModal(id) {
      const modal = document.getElementById(id);
      if (modal) modal.classList.remove('active');
    },

    // ===== CALCULATOR INTEGRATED METHODS (GENIADY 3D ENGINE) =====
    _currentMarketId: 'EG',
    _activePresetId: '3dbenchy',
    _modelGeometry: {
      solidVolumeMm3: 11350,
      surfaceAreaMm2: 8400,
      dimensions: { width: 60, depth: 31, height: 48 },
      triangleCount: 12500,
      name: '#3DBenchy Boat'
    },
    _lastIntegratedCalcResult: null,
    _threeState: null,

    initCalculator() {
      const CalcMod = root.WorkshopCalculator;
      if (!CalcMod) return;

      this.calcSetMarket('EG', false);
      this.init3DViewer();
      this.setupSTLDropzone();
      this.calcLoadDefaultGeometry();
      this.calcUpdate();
    },

    init3DViewer() {
      const container = document.getElementById('calc-viewport-container');
      const canvas = document.getElementById('calc-3d-canvas');
      if (!container || !canvas) return;

      if (root.WorkshopViewer3D) {
        this._main3DViewer = root.WorkshopViewer3D.createViewer(canvas, container, {
          bedWidth: 225,
          bedDepth: 225,
          color: root.WorkshopViewer3D.FILAMENT_COLORS.sky.hex
        });
        return;
      }

      if (typeof THREE === 'undefined') {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = container.clientWidth || 300;
          canvas.height = 240;
          ctx.fillStyle = '#f1f5f9';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = 'rgba(2, 132, 199, 0.2)';
          ctx.lineWidth = 1;
          for (let x = 20; x < canvas.width; x += 30) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
          }
          for (let y = 20; y < canvas.height; y += 30) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
          }
          ctx.fillStyle = '#0284c7';
          ctx.font = '13px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('🖨️ سطح طابعة ورشة ELMALHY.3D', canvas.width / 2, canvas.height / 2);
        }
        return;
      }

      try {
        const width = container.clientWidth || 300;
        const height = 240;

        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xf1f5f9);

        const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
        camera.position.set(120, -180, 130);
        camera.up.set(0, 0, 1);

        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        const ambLight = new THREE.AmbientLight(0xffffff, 0.85);
        scene.add(ambLight);

        const dirLight = new THREE.DirectionalLight(0x0284c7, 0.9);
        dirLight.position.set(100, -100, 200);
        scene.add(dirLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
        fillLight.position.set(-100, 100, 100);
        scene.add(fillLight);

        const gridHelper = new THREE.GridHelper(225, 15, 0x0284c7, 0xcbd5e1);
        gridHelper.rotation.x = Math.PI / 2;
        scene.add(gridHelper);

        const meshGroup = new THREE.Group();
        scene.add(meshGroup);

        this._threeState = {
          scene,
          camera,
          renderer,
          meshGroup,
          gridHelper,
          wireframe: false,
          autoRotate: true
        };

        const animate = () => {
          if (!this._threeState) return;
          requestAnimationFrame(animate);
          if (this._threeState.autoRotate && this._threeState.meshGroup) {
            this._threeState.meshGroup.rotation.z += 0.008;
          }
          camera.lookAt(0, 0, 20);
          renderer.render(scene, camera);
        };
        animate();

        window.addEventListener('resize', () => {
          if (!this._threeState || !container) return;
          const w = container.clientWidth;
          const h = 240;
          this._threeState.camera.aspect = w / h;
          this._threeState.camera.updateProjectionMatrix();
          this._threeState.renderer.setSize(w, h);
        });
      } catch (e) {
        console.warn('3D initialization warning:', e);
      }
    },

    calcUpdate3DGeometry(geo, name = '3D Model') {
      const nameEl = document.getElementById('viewport-model-name');
      if (nameEl) nameEl.textContent = name;

      if (!this._threeState || typeof THREE === 'undefined') return;
      const { scene, meshGroup, wireframe } = this._threeState;

      while (meshGroup.children.length > 0) {
        const obj = meshGroup.children[0];
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
        meshGroup.remove(obj);
      }

      let threeGeo;
      if (geo instanceof THREE.BufferGeometry) {
        threeGeo = geo;
      } else {
        const w = Math.min(150, Math.max(10, geo?.dimensions?.width || 50));
        const d = Math.min(150, Math.max(10, geo?.dimensions?.depth || 30));
        const h = Math.min(150, Math.max(10, geo?.dimensions?.height || 40));
        threeGeo = new THREE.BoxGeometry(w, d, h);
        threeGeo.translate(0, 0, h / 2);
      }

      const mat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        roughness: 0.35,
        metalness: 0.15,
        wireframe: wireframe
      });

      const mesh = new THREE.Mesh(threeGeo, mat);
      meshGroup.add(mesh);
    },

    calcToggleWireframe() {
      if (!this._threeState) return;
      this._threeState.wireframe = !this._threeState.wireframe;
      if (this._threeState.meshGroup) {
        this._threeState.meshGroup.traverse(child => {
          if (child.isMesh && child.material) {
            child.material.wireframe = this._threeState.wireframe;
          }
        });
      }
    },

    calcResetCamera() {
      if (!this._threeState) return;
      this._threeState.camera.position.set(120, -180, 130);
      if (this._threeState.meshGroup) {
        this._threeState.meshGroup.rotation.z = 0;
      }
    },

    setupSTLDropzone() {
      const dropzone = document.getElementById('stl-dropzone');
      if (!dropzone) return;

      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          dropzone.classList.remove('dragover');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files && files.length > 0) {
          const file = files[0];
          const ext = file.name.split('.').pop().toLowerCase();
          if (['gcode', 'gco', 'nc'].includes(ext)) {
            this.calcProcessGCodeFile(file);
          } else {
            this.calcProcessSTLFile(file);
          }
        }
      });
    },

    calcHandleFileUpload(event) {
      const file = event.target.files?.[0];
      if (file) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (['gcode', 'gco', 'nc'].includes(ext)) {
          this.calcProcessGCodeFile(file);
        } else {
          this.calcProcessSTLFile(file);
        }
      }
    },

    calcProcessGCodeFile(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const parsed = root.WorkshopCalc.parseGCode(text);
          if (!parsed) throw new Error('تعذر قراءة بيانات السلايسر من الملف');

          this._activePresetId = 'custom-gcode';
          const name = file.name.replace(/\.[^/.]+$/, '');
          this._modelGeometry = {
            name: name,
            solidVolumeMm3: Math.round(parsed.filamentGrams / 1.24 * 1000),
            surfaceAreaMm2: 0,
            dimensions: { width: 0, depth: 0, height: 0 },
            triangleCount: 0
          };

          const moToggle = document.getElementById('calc-manual-override-toggle');
          if (moToggle) {
            moToggle.checked = true;
            this.calcToggleManualOverride();
          }

          const weightInput = document.getElementById('calc-manual-weight-input');
          if (weightInput && parsed.filamentGrams > 0) weightInput.value = parsed.filamentGrams;

          const hours = Math.floor(parsed.printHours);
          const mins = Math.round((parsed.printHours - hours) * 60);
          const hInput = document.getElementById('calc-manual-hours-input');
          const mInput = document.getElementById('calc-manual-mins-input');
          if (hInput) hInput.value = hours;
          if (mInput) mInput.value = mins;

          if (parsed.layerHeight) {
            const lhInput = document.getElementById('calc-layer-height');
            if (lhInput) lhInput.value = parsed.layerHeight.toFixed(2);
          }

          const dimEl = document.getElementById('m-metric-dim');
          const volEl = document.getElementById('m-metric-vol');
          const areaEl = document.getElementById('m-metric-area');
          const triEl = document.getElementById('m-metric-tri');

          if (dimEl) dimEl.textContent = 'مسلوس مسبقاً (G-Code)';
          if (volEl) volEl.textContent = `${parsed.filamentGrams} جم`;
          if (areaEl) areaEl.textContent = `${hours} س ${mins} د`;
          if (triEl) triEl.textContent = 'أوامر حركية جاهزة';

          this.calcUpdate3DGeometry(this._modelGeometry, `⚙️ ${name} (G-Code)`);
          this.calcUpdate();

          alert(`✅ تم استخراج بيانات السلايسر بنجاح من ${file.name}:\n• وزن الفلمنت: ${parsed.filamentGrams} جم\n• زمن الطباعة: ${hours} ساعة و ${mins} دقيقة\n• دقة الطبقة: ${parsed.layerHeight} مم`);
        } catch (err) {
          alert('تعذر قراءة ملف G-Code: ' + (err.message || 'تأكد من وجود تعليقات السلايسر'));
          console.error(err);
        }
      };
      reader.readAsText(file);
    },

    calcProcessSTLFile(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const buffer = e.target.result;
          const parsed = root.WorkshopCalc.parseSTL(buffer);

          this._activePresetId = 'custom-stl';
          this._modelGeometry = {
            name: file.name.replace(/\.[^/.]+$/, ''),
            solidVolumeMm3: parsed.volumeMm3,
            surfaceAreaMm2: parsed.surfaceAreaMm2,
            dimensions: parsed.dimensions,
            triangleCount: parsed.triangleCount
          };

          document.querySelectorAll('.model-preset-card').forEach(c => c.classList.remove('active'));

          const dimEl = document.getElementById('m-metric-dim');
          const volEl = document.getElementById('m-metric-vol');
          const areaEl = document.getElementById('m-metric-area');
          const triEl = document.getElementById('m-metric-tri');

          if (dimEl) dimEl.textContent = `${parsed.dimensions.width} × ${parsed.dimensions.depth} × ${parsed.dimensions.height} مم`;
          if (volEl) volEl.textContent = `${parsed.volumeCm3} cm³`;
          if (areaEl) areaEl.textContent = `${parsed.surfaceAreaCm2} cm²`;
          if (triEl) triEl.textContent = parsed.triangleCount.toLocaleString('ar-EG');

          if (this._main3DViewer && parsed.positions) {
            this._main3DViewer.loadSTLPositions(parsed.positions, file.name);
          } else {
            this.calcUpdate3DGeometry(this._modelGeometry, `📂 ${this._modelGeometry.name}`);
          }
          this.calcAutoNesting();
          this.calcUpdate();
        } catch (err) {
          alert('تعذر قراءة ملف STL: يرجى التأكد من صحة الملف بصيغة Binary أو ASCII.');
          console.error(err);
        }
      };
      reader.readAsArrayBuffer(file);
    },

    calcSetMarket(marketId, update = true) {
      const CalcMod = root.WorkshopCalculator;
      if (!CalcMod) return;

      const markets = CalcMod.getMarkets();
      const market = markets[marketId] || markets.EG;
      this._currentMarketId = market.id;

      document.querySelectorAll('.market-pill').forEach(pill => {
        pill.classList.toggle('active', pill.dataset.market === market.id);
      });

      const badge = document.getElementById('calc-out-market-badge');
      if (badge) badge.textContent = `${market.flag} ${market.currency.code}`;

      const sym = document.getElementById('calc-out-currency-sym');
      if (sym) sym.textContent = market.currency.symbol;

      const spoolCur = document.getElementById('calc-spool-currency');
      if (spoolCur) spoolCur.textContent = market.currency.symbol;

      document.querySelectorAll('.calc-cur-label').forEach(el => {
        el.textContent = market.currency.symbol;
      });

      const elecEl = document.getElementById('calc-elec-rate');
      if (elecEl) elecEl.value = market.electricityCostPerKwh;

      const laborEl = document.getElementById('calc-labor-rate');
      if (laborEl) laborEl.value = market.laborHourlyRate;

      const failEl = document.getElementById('calc-failure');
      if (failEl) failEl.value = market.defaultFailureRatePercent;

      const margEl = document.getElementById('calc-margin');
      if (margEl) margEl.value = market.defaultProfitMarginPercent;

      const maintEl = document.getElementById('calc-maint-rate');
      if (maintEl) maintEl.value = market.defaultMaintenancePercentOfDepreciation;

      const printerEl = document.getElementById('calc-printer-cost');
      if (printerEl) {
        printerEl.value = market.id === 'EG' ? 22000 : market.defaultPrinterCost;
      }

      this.onCalcMaterialChange();
      if (update) this.calcUpdate();
    },

    calcLoadDefaultGeometry() {
      this._activePresetId = 'default-model';
      this._modelGeometry = {
        name: 'نموذج معاينة ثلاثي الأبعاد',
        solidVolumeMm3: 11350,
        surfaceAreaMm2: 8400,
        dimensions: { width: 60, depth: 31, height: 48 },
        triangleCount: 12500
      };

      const dimEl = document.getElementById('m-metric-dim');
      const volEl = document.getElementById('m-metric-vol');
      const areaEl = document.getElementById('m-metric-area');
      const triEl = document.getElementById('m-metric-tri');

      if (dimEl) dimEl.textContent = '60 × 31 × 48 مم';
      if (volEl) volEl.textContent = '11.35 cm³';
      if (areaEl) areaEl.textContent = '84.0 cm²';
      if (triEl) triEl.textContent = (12500).toLocaleString('ar-EG');

      this.calcUpdate3DGeometry(this._modelGeometry, '📦 نموذج معاينة ثلاثي الأبعاد');
      this.calcAutoNesting();
    },

    calcLoadPreset(presetId) {
      this.calcLoadDefaultGeometry();
      this.calcUpdate();
    },

    calcToggleManualOverride() {
      const toggle = document.getElementById('calc-manual-override-toggle');
      const fields = document.getElementById('manual-override-fields');
      const chip = document.getElementById('chip-manual-override-status');
      if (!toggle) return;

      const active = toggle.checked;
      if (fields) fields.style.display = active ? 'block' : 'none';
      if (chip) chip.textContent = active ? 'مفعل (إدخال يدوي)' : 'معطل';
      this.calcUpdate();
    },

    calcStepQty(delta) {
      const qtyEl = document.getElementById('calc-qty');
      if (!qtyEl) return;
      const cur = parseInt(qtyEl.value, 10) || 1;
      qtyEl.value = Math.max(1, cur + delta);
      this.calcUpdate();
    },

    onInfillSliderChange() {
      const slider = document.getElementById('calc-infill');
      const badge = document.getElementById('calc-infill-badge');
      if (slider && badge) {
        badge.textContent = slider.value + '%';
      }
      this.calcUpdate();
    },

    calcToggleMulticolor() {
      const toggle = document.getElementById('calc-multicolor-toggle');
      const fields = document.getElementById('multicolor-fields');
      const chip = document.getElementById('chip-multicolor-status');
      if (!toggle) return;

      const active = toggle.checked;
      if (fields) fields.style.display = active ? 'block' : 'none';
      if (chip) chip.textContent = active ? 'مفعل (هدر إضافي)' : 'معطل';
      this.calcUpdate();
    },

    onCalcMaterialChange() {
      const matSel = document.getElementById('calc-material');
      const spoolInput = document.getElementById('calc-spool-price');
      if (!matSel || !spoolInput) return;

      const CalcMod = root.WorkshopCalculator;
      if (!CalcMod) return;

      const markets = CalcMod.getMarkets();
      const market = markets[this._currentMarketId] || markets.EG;
      const matId = matSel.value;
      const defaultPrice = market.filamentPricePerKg[matId] || 900;

      spoolInput.value = defaultPrice;
      this.calcUpdate();
    },

    onPrinterProfileChange() {
      const profSel = document.getElementById('calc-printer-profile');
      if (!profSel) return;

      const CalcMod = root.WorkshopCalculator;
      if (!CalcMod) return;

      const profiles = CalcMod.getPrinterProfiles();
      const profile = profiles[profSel.value] || profiles.neptune_4_pro;

      const pWatts = document.getElementById('calc-power-watts');
      if (pWatts) pWatts.value = profile.powerConsumptionWatts;

      const pCost = document.getElementById('calc-printer-cost');
      if (pCost) {
        pCost.value = this._currentMarketId === 'EG' ? (profile.defaultCostEGP || 22000) : profile.defaultCostUSD;
      }

      const pLife = document.getElementById('calc-lifespan-hours');
      if (pLife) pLife.value = profile.lifespanHours;

      const bedChip = document.getElementById('chip-bed-size');
      if (bedChip) {
        bedChip.textContent = `سطح الطابعة: ${profile.bedSizeMm.x} × ${profile.bedSizeMm.y} مم`;
      }

      this.calcAutoNesting();
      this.calcUpdate();
    },

    calcAutoNesting() {
      const Calc = root.WorkshopCalc;
      const CalcMod = root.WorkshopCalculator;
      if (!Calc || !CalcMod) return;

      const profiles = CalcMod.getPrinterProfiles();
      const profId = document.getElementById('calc-printer-profile')?.value || 'neptune_4_pro';
      const printer = profiles[profId] || profiles.neptune_4_pro;

      const footprint = {
        x: this._modelGeometry?.dimensions?.width || 50,
        y: this._modelGeometry?.dimensions?.depth || 50
      };
      const height = this._modelGeometry?.dimensions?.height || 50;
      const hasPrime = document.getElementById('calc-multicolor-toggle')?.checked === true;

      const autoCap = Calc.calculatePlateNesting(footprint, height, printer.bedSizeMm, hasPrime);

      const pppEl = document.getElementById('calc-pieces-per-plate');
      const autoCapEl = document.getElementById('calc-out-auto-capacity');
      if (pppEl) pppEl.value = autoCap;
      if (autoCapEl) autoCapEl.textContent = `${autoCap} قطع`;

      this.calcUpdate();
    },

    calcUpdate() {
      const CalcMod = root.WorkshopCalculator;
      if (!CalcMod) return;

      const solidVol = this._modelGeometry?.solidVolumeMm3 || 11350;
      const surfArea = this._modelGeometry?.surfaceAreaMm2 || 8400;
      const heightMm = this._modelGeometry?.dimensions?.height || 48;
      const footprintX = this._modelGeometry?.dimensions?.width || 60;
      const footprintY = this._modelGeometry?.dimensions?.depth || 31;

      const infill = Number(document.getElementById('calc-infill')?.value ?? 15);
      const walls = Number(document.getElementById('calc-walls')?.value ?? 3);
      const layerH = Number(document.getElementById('calc-layer-height')?.value ?? 0.2);
      const supType = document.getElementById('calc-support-type')?.value || 'tree';
      const supCustom = Number(document.getElementById('calc-support-custom')?.value ?? 15);

      const customSupGrp = document.getElementById('group-custom-support');
      if (customSupGrp) {
        customSupGrp.style.display = supType === 'custom' ? 'block' : 'none';
      }

      const mcEnabled = document.getElementById('calc-multicolor-toggle')?.checked === true;
      const colorSwaps = Number(document.getElementById('calc-color-swaps')?.value ?? 48);
      const flushVol = Number(document.getElementById('calc-flush-vol')?.value ?? 280);

      const manualOverride = document.getElementById('calc-manual-override-toggle')?.checked === true;
      const manualWeight = Number(document.getElementById('calc-manual-weight-input')?.value || 0);
      const manualH = Number(document.getElementById('calc-manual-hours-input')?.value || 0);
      const manualM = Number(document.getElementById('calc-manual-mins-input')?.value || 0);
      const totalManualHours = manualH + (manualM / 60);

      const inputs = {
        marketId: this._currentMarketId,
        printerProfileId: document.getElementById('calc-printer-profile')?.value || 'neptune_4_pro',
        materialId: document.getElementById('calc-material')?.value || 'pla_plus',
        solidVolumeMm3: solidVol,
        surfaceAreaMm2: surfArea,
        heightMm: heightMm,
        footprintX: footprintX,
        footprintY: footprintY,
        infillPercent: infill,
        wallCount: walls,
        layerHeightMm: layerH,
        nozzleDiameter: Number(document.getElementById('calc-nozzle')?.value || 0.4),
        infillPattern: document.getElementById('calc-infill-pattern')?.value || 'grid',
        manualWeightOverride: manualOverride && manualWeight > 0,
        manualWeightGrams: manualWeight,
        manualTimeOverride: manualOverride && totalManualHours > 0,
        manualPrintHours: totalManualHours,
        supportType: supType,
        supportCustomPercent: supCustom,
        multiColorEnabled: mcEnabled,
        colorSwapsCount: colorSwaps,
        flushVolumePerSwapMm3: flushVol,
        quantity: parseInt(document.getElementById('calc-qty')?.value, 10) || 1,
        piecesPerPlate: parseInt(document.getElementById('calc-pieces-per-plate')?.value, 10) || 8,
        spoolPrice: Number(document.getElementById('calc-spool-price')?.value) || 950,
        printerPowerWatts: Number(document.getElementById('calc-power-watts')?.value) || 220,
        electricityRate: Number(document.getElementById('calc-elec-rate')?.value) || 2.5,
        printerCost: Number(document.getElementById('calc-printer-cost')?.value) || 22000,
        lifespanHours: Number(document.getElementById('calc-lifespan-hours')?.value) || 6000,
        maintenanceRatePct: Number(document.getElementById('calc-maint-rate')?.value) || 20,
        laborRatePerHour: Number(document.getElementById('calc-labor-rate')?.value) || 95,
        prepMinutesPerPlate: Number(document.getElementById('calc-prep-mins')?.value ?? 5),
        postMinutesPerPiece: Number(document.getElementById('calc-post-mins')?.value ?? 5),
        hardwareCost: Number(document.getElementById('calc-hardware')?.value) || 0,
        postProcessCost: 0,
        packagingCost: Number(document.getElementById('calc-packaging')?.value) || 0,
        shippingFee: Number(document.getElementById('calc-shipping')?.value) || 0,
        failureRiskPercent: Number(document.getElementById('calc-failure')?.value ?? 7),
        targetMarginPercent: Number(document.getElementById('calc-margin')?.value ?? 45),
        minOrderPrice: Number(document.getElementById('calc-min-price')?.value) || 0
      };

      const res = CalcMod.calculateIntegrated(inputs);
      this._lastIntegratedCalcResult = res;

      // Update form fields with calculated values
      const weightInput = document.getElementById('calc-weight');
      if (weightInput && document.activeElement !== weightInput) {
        weightInput.value = res.mass.singlePieceTotalGrams;
      }

      const hoursInput = document.getElementById('calc-hours');
      if (hoursInput && document.activeElement !== hoursInput) {
        hoursInput.value = res.time.printHoursPerPiece;
      }

      const platesEl = document.getElementById('calc-out-plates');
      if (platesEl) platesEl.textContent = `${res.nesting.platesNeeded} ألواح طباعة (${res.nesting.piecesPerPlate} قطع/لوح)`;

      const hourlyMachineRateEl = document.getElementById('calc-hourly-machine-rate');
      if (hourlyMachineRateEl) {
        const hourlyDeprec = res.printer.lifespanHours > 0 ? (inputs.printerCost / inputs.lifespanHours) : 0;
        const hourlyMaint = hourlyDeprec * (inputs.maintenanceRatePct / 100);
        hourlyMachineRateEl.value = (hourlyDeprec + hourlyMaint).toFixed(2);
      }

      // Waste summary bar
      const supGEl = document.getElementById('calc-out-sup-g');
      const purgeGEl = document.getElementById('calc-out-purge-g');
      const totalWasteGEl = document.getElementById('calc-out-total-waste-g');
      if (supGEl) supGEl.textContent = `${res.mass.supportMassGrams}g`;
      if (purgeGEl) purgeGEl.textContent = `${res.mass.flushMassGrams + res.mass.primeTowerMassGrams}g`;
      if (totalWasteGEl) totalWasteGEl.textContent = `${res.mass.totalWasteMassGrams}g (${res.mass.wastePercentageOfTotal}%)`;

      // Results Card Output
      const cur = res.currency;
      const fmt = (v) => CalcMod.formatCurrency(v, cur);

      const outPrice = document.getElementById('calc-out-price');
      if (outPrice) outPrice.textContent = (Math.round((res.costs.suggestedRetailPrice || 0) * 100) / 100).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      const outMat = document.getElementById('calc-out-material');
      if (outMat) outMat.textContent = fmt(res.costs.netFilamentCost);

      const outWaste = document.getElementById('calc-out-waste');
      if (outWaste) outWaste.textContent = fmt(res.costs.wasteCost);

      const outPow = document.getElementById('calc-out-power');
      if (outPow) outPow.textContent = fmt(res.costs.powerCost);

      const outDep = document.getElementById('calc-out-deprec');
      if (outDep) outDep.textContent = fmt(res.costs.depreciationCost);

      const outCons = document.getElementById('calc-out-consumables');
      if (outCons) outCons.textContent = fmt(res.costs.maintenanceCost);

      const outLab = document.getElementById('calc-out-labor');
      if (outLab) outLab.textContent = fmt(res.costs.laborCostPerPiece);

      const outExt = document.getElementById('calc-out-extras');
      if (outExt) outExt.textContent = fmt(res.costs.hardwareCost + res.costs.packagingCost);

      const outFail = document.getElementById('calc-out-failure');
      if (outFail) outFail.textContent = fmt(res.costs.failureRiskBuffer);

      const outTotal = document.getElementById('calc-out-total-cost');
      if (outTotal) outTotal.textContent = fmt(res.costs.totalManufacturingCost);

      const outMarg = document.getElementById('calc-out-margin');
      if (outMarg) outMarg.textContent = `${res.costs.targetMarginPercent}%`;

      const outProf = document.getElementById('calc-out-profit');
      if (outProf) outProf.textContent = fmt(res.costs.unitGrossProfit);

      const outQtyLbl = document.getElementById('calc-out-qty-label');
      if (outQtyLbl) outQtyLbl.textContent = `×${res.nesting.quantity}`;

      const outBatch = document.getElementById('calc-out-batch');
      if (outBatch) outBatch.textContent = fmt(res.batch.batchTotalPrice);

      const outBatchProf = document.getElementById('calc-out-batch-profit');
      if (outBatchProf) outBatchProf.textContent = fmt(res.batch.batchGrossProfit);

      const outGram = document.getElementById('calc-out-per-gram');
      if (outGram) {
        outGram.textContent = res.mass.singlePieceTotalGrams > 0
          ? (res.costs.totalManufacturingCost / res.mass.singlePieceTotalGrams).toFixed(2)
          : '0.00';
      }

      const outHour = document.getElementById('calc-out-per-hour');
      if (outHour) {
        outHour.textContent = res.costs.profitPerHour > 0
          ? `${res.costs.profitPerHour.toFixed(1)} ${cur.symbol}`
          : '0.00';
      }

      const outMark = document.getElementById('calc-out-markup');
      if (outMark) outMark.textContent = `${res.costs.actualMarkupPercent.toFixed(1)}%`;

      // تحديث شريط التوزيع البصري للتكاليف والأرباح
      if (res.breakdown) {
        const segMat = document.getElementById('bar-seg-mat');
        const segMachine = document.getElementById('bar-seg-machine');
        const segLabor = document.getElementById('bar-seg-labor');
        const segRisk = document.getElementById('bar-seg-risk');
        const segProfit = document.getElementById('bar-seg-profit');

        if (segMat) segMat.style.width = `${res.breakdown.materialPct}%`;
        if (segMachine) segMachine.style.width = `${res.breakdown.machinePct}%`;
        if (segLabor) segLabor.style.width = `${res.breakdown.laborPct}%`;
        if (segRisk) segRisk.style.width = `${res.breakdown.riskPct}%`;
        if (segProfit) segProfit.style.width = `${res.breakdown.profitPct}%`;

        const valMat = document.getElementById('bar-val-mat');
        const valMachine = document.getElementById('bar-val-machine');
        const valLabor = document.getElementById('bar-val-labor');
        const valProfit = document.getElementById('bar-val-profit');
        const sumEl = document.getElementById('calc-out-bar-summary');

        if (valMat) valMat.textContent = `${res.breakdown.materialPct}%`;
        if (valMachine) valMachine.textContent = `${res.breakdown.machinePct}%`;
        if (valLabor) valLabor.textContent = `${res.breakdown.laborPct}%`;
        if (valProfit) valProfit.textContent = `${res.breakdown.profitPct}%`;
        if (sumEl) sumEl.textContent = `خامة: ${res.breakdown.materialPct}% • ربح: ${res.breakdown.profitPct}%`;
      }
    },

    calcReset() {
      this.calcLoadDefaultGeometry();
      document.getElementById('calc-qty').value = 1;
      document.getElementById('calc-packaging').value = 0;
      document.getElementById('calc-shipping').value = 0;
      document.getElementById('calc-hardware').value = 0;
      const moToggle = document.getElementById('calc-manual-override-toggle');
      if (moToggle && moToggle.checked) {
        moToggle.checked = false;
        this.calcToggleManualOverride();
      }
      this.calcUpdate();
    },

    calcSaveAsQuote() {
      if (!this._lastIntegratedCalcResult) this.calcUpdate();
      const r = this._lastIntegratedCalcResult;
      if (!r) return;

      document.getElementById('order-is-quote').value = 'true';
      document.getElementById('modal-order-title').textContent = `إنشاء عرض سعر: ${this._modelGeometry.name}`;
      document.getElementById('order-item-name').value = this._modelGeometry.name || 'قطعة طباعة مخصصة';
      document.getElementById('order-item-weight').value = r.mass.singlePieceTotalGrams;
      document.getElementById('order-item-hours').value = r.time.printHoursPerPiece;
      document.getElementById('order-item-qty').value = r.nesting.quantity;
      document.getElementById('order-margin-pct').value = r.costs.targetMarginPercent;
      document.getElementById('order-shipping-fee').value = r.batch.shippingFee || 0;

      this.openModal('modal-order');
      this.recalcOrderModal();
    },

    calcCopyWhatsapp() {
      if (!this._lastIntegratedCalcResult) this.calcUpdate();
      const r = this._lastIntegratedCalcResult;
      if (!r) return;

      const cur = r.currency.symbol;
      const name = this._modelGeometry.name || 'قطعة 3D';
      const text =
        `🏭 *ELMALHY.3D — عرض سعر تصنيع طباعة ثلاثية الأبعاد*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `📦 *القطعة:* ${name}\n` +
        `🧵 *الخامة:* ${r.material.name} (${r.material.fullName})\n` +
        `⚖️ *الوزن:* ${r.mass.singlePieceTotalGrams}g (صافي: ${r.mass.netModelMassGrams}g)\n` +
        `⏱️ *زمن الطباعة:* ${r.time.formattedDuration}\n` +
        `🔢 *الكمية:* ${r.nesting.quantity} قطعة (${r.nesting.platesNeeded} ألواح طباعة)\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 *سعر القطعة الواحدة:* ${r.costs.suggestedRetailPrice} ${cur}\n` +
        `📦 *إجمالي الطلبية بالكامل:* ${r.batch.batchTotalPrice} ${cur}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `للطلب وتأكيد الإنتاج، يرجى الرد على هذه الرسالة 🤝`;

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          alert('تم نسخ رسالة الواتساب بنجاح! يمكنك لصقها وإرسالها للعميل.');
        }).catch(() => {
          prompt('انسخ الرسالة التالية:', text);
        });
      } else {
        prompt('انسخ الرسالة التالية:', text);
      }
    },

    calcOpenSummaryModal() {
      if (!this._lastIntegratedCalcResult) this.calcUpdate();
      const r = this._lastIntegratedCalcResult;
      if (!r) return;

      const cur = r.currency.symbol;
      const content = `
        <div style="background:var(--bg-primary); border:1px solid var(--border); border-radius:var(--radius-sm); padding:16px; margin-bottom:16px">
          <h4 style="color:var(--accent); margin-bottom:6px">🏭 ورشة ELMALHY.3D — تقرير مواصفات التصنيع والتسعير</h4>
          <p style="font-size:0.8rem; color:var(--text-muted)">نموذج: <strong>${this._modelGeometry.name}</strong> • تم حسابه في: ${new Date().toLocaleDateString('ar-EG')}</p>
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px">
          <div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:var(--radius-sm)">
            <h5 style="color:var(--accent-2); margin-bottom:4px">📐 المواصفات الفنية</h5>
            <div>• الأبعاد: ${this._modelGeometry.dimensions.width} × ${this._modelGeometry.dimensions.depth} × ${this._modelGeometry.dimensions.height} مم</div>
            <div>• الحجم المصمت: ${(r.geometry.solidVolumeMm3 / 1000).toFixed(2)} cm³</div>
            <div>• الخامة: ${r.material.name} (كثافة: ${r.material.density} g/cm³)</div>
            <div>• الحشو والجدران: ${r.geometry.infillPercent}% • ${r.geometry.wallCount} جدران</div>
            <div>• الدعامات: ${r.mass.supportMassGrams}g (${r.geometry.layerCount} طبقة)</div>
          </div>
          <div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:var(--radius-sm)">
            <h5 style="color:var(--green); margin-bottom:4px">💰 الحسابات المالية</h5>
            <div>• تكلفة المواد والهدر: ${r.costs.totalMaterialCost} ${cur}</div>
            <div>• تكلفة الكهرباء والإهلاك: ${(r.costs.powerCost + r.costs.depreciationCost).toFixed(2)} ${cur}</div>
            <div>• تكلفة العمالة والصيانة: ${(r.costs.laborCostPerPiece + r.costs.maintenanceCost).toFixed(2)} ${cur}</div>
            <div>• احتياطي المخاطر: ${r.costs.failureRiskBuffer} ${cur}</div>
            <div>• <strong>إجمالي التكلفة للقطعة: ${r.costs.totalManufacturingCost} ${cur}</strong></div>
          </div>
        </div>
        <div style="background:linear-gradient(135deg, rgba(56,189,248,0.12), rgba(45,212,191,0.08)); border:1px solid var(--border-bright); padding:14px; border-radius:var(--radius-sm); display:flex; justify-content:space-between; align-items:center">
          <div>
            <div style="font-size:0.8rem; color:var(--text-muted)">سعر بيع القطعة المقترح:</div>
            <div style="font-size:1.5rem; font-weight:800; color:var(--accent-2)">${r.costs.suggestedRetailPrice} ${cur}</div>
          </div>
          <div>
            <div style="font-size:0.8rem; color:var(--text-muted)">إجمالي الباتش (${r.nesting.quantity} قطع):</div>
            <div style="font-size:1.5rem; font-weight:800; color:var(--green)">${r.batch.batchTotalPrice} ${cur}</div>
          </div>
        </div>
      `;

      const target = document.getElementById('calc-summary-content');
      if (target) target.innerHTML = content;
      this.openModal('modal-calc-summary');
    }
,
    // ==========================================
    // Pricing Templates Quick Apply
    // ==========================================
    calcApplyTemplate(templateId) {
      const templates = {
        economy: { margin: 25, layer: '0.28', infill: 15, walls: 2, pattern: 'grid' },
        standard: { margin: 40, layer: '0.20', infill: 20, walls: 3, pattern: 'grid' },
        professional: { margin: 55, layer: '0.12', infill: 30, walls: 4, pattern: 'gyroid' },
        industrial: { margin: 50, layer: '0.20', infill: 50, walls: 5, pattern: 'honeycomb' }
      };

      const t = templates[templateId];
      if (!t) return;

      const marginEl = document.getElementById('calc-margin');
      if (marginEl) marginEl.value = t.margin;
      const marginBadge = document.getElementById('calc-margin-badge');
      if (marginBadge) marginBadge.textContent = t.margin + '%';

      const layerEl = document.getElementById('calc-layer-height');
      if (layerEl) layerEl.value = t.layer;

      const infillEl = document.getElementById('calc-infill');
      if (infillEl) infillEl.value = t.infill;
      const infillBadge = document.getElementById('calc-infill-badge');
      if (infillBadge) infillBadge.textContent = t.infill + '%';

      const wallsEl = document.getElementById('calc-walls');
      if (wallsEl) wallsEl.value = t.walls;

      const patEl = document.getElementById('calc-infill-pattern');
      if (patEl) patEl.value = t.pattern;

      this.calcUpdate();
    },

    // ==========================================
    // Printable Invoice Modal (A4 / PDF)
    // ==========================================
    renderPrintableInvoice() { return this.openPrintableInvoice(); },

    openPrintableInvoice() {
      if (!this._lastIntegratedCalcResult) this.calcUpdate();
      const r = this._lastIntegratedCalcResult;
      if (!r) return;

      const cur = r.currency.symbol;
      const invNumber = 'INV-' + Date.now().toString().slice(-6);
      const invDate = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
      const modelName = this._modelGeometry.name || 'قطعة طباعة مخصصة';
      const qty = r.nesting.quantity || 1;
      const unitPrice = r.costs.suggestedRetailPrice;
      const totalPrice = r.batch.batchTotalPrice;
      const unitCost = r.costs.totalManufacturingCost;

      const html = `
        <div class="printable-invoice-header">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; border-bottom:2px solid var(--border); padding-bottom:14px">
            <div>
              <div style="font-size:1.4rem; font-weight:900; color:var(--text-primary); letter-spacing:-0.5px">
                🏭 ورشة <span style="color:var(--accent)">ELMALHY.3D</span> للطباعة الرقمية
              </div>
              <div style="font-size:0.85rem; color:var(--text-muted); margin-top:3px">
                تصنيع رقمي دقيق • نمذجة هندسية • قطع غيار وتجميعات ميكانيكية
              </div>
            </div>
            <div style="text-align:left">
              <span class="badge" style="background:#e0f2fe; color:#0284c7; font-weight:800; font-size:0.85rem; padding:4px 10px; border-radius:6px">
                📄 عرض سعر رسمي معتمد
              </span>
              <div style="font-size:0.8rem; color:var(--text-muted); margin-top:5px">
                رقم العرض: <strong>${invNumber}</strong><br>
                التاريخ: <strong>${invDate}</strong>
              </div>
            </div>
          </div>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px; font-size:0.85rem">
            <div style="background:var(--bg-tertiary); padding:12px; border-radius:8px">
              <div style="font-weight:700; color:var(--accent); margin-bottom:4px">بيانات العميل / الجهة الطالبة:</div>
              <div>• الاسم: عميل نقدي / طلب ورشة</div>
              <div>• المشروع: تصنيع نماذج ثلاثية الأبعاد</div>
              <div>• العملة المعتمدة: ${cur} (الجنيه المصري)</div>
            </div>
            <div style="background:var(--bg-tertiary); padding:12px; border-radius:8px">
              <div style="font-weight:700; color:var(--accent-2); margin-bottom:4px">بيانات الورشة والتنفيذ:</div>
              <div>• ماكينة الإنتاج: Elegoo Neptune 4 Pro (Klipper Core)</div>
              <div>• معايير الجودة: تفاوت هندسي ±0.15 مم • ملء صلب للمقابس</div>
              <div>• مدة سريان العرض: 7 أيام عمل من تاريخه</div>
            </div>
          </div>

          <table style="width:100%; border-collapse:collapse; margin-bottom:20px; font-size:0.85rem">
            <thead>
              <tr style="background:var(--bg-tertiary); border-bottom:2px solid var(--border)">
                <th style="padding:10px; text-align:right">البند والمواصفات الفنية</th>
                <th style="padding:10px; text-align:center">الخامة والدقة</th>
                <th style="padding:10px; text-align:center">الكمية</th>
                <th style="padding:10px; text-align:left">سعر القطعة</th>
                <th style="padding:10px; text-align:left">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom:1px solid var(--border)">
                <td style="padding:12px 10px">
                  <strong>${modelName}</strong>
                  <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px">
                    الأبعاد: ${this._modelGeometry.dimensions.width}×${this._modelGeometry.dimensions.depth}×${this._modelGeometry.dimensions.height} مم • الوزن: ${r.mass.singlePieceTotalGrams}g • زمن الطباعة: ${r.time.formattedDuration}
                  </div>
                </td>
                <td style="padding:12px 10px; text-align:center">
                  ${r.material.name}<br>
                  <span style="font-size:0.75rem; color:var(--text-muted)">طبقة ${r.geometry.layerHeightMm} مم • حشو ${r.geometry.infillPercent}%</span>
                </td>
                <td style="padding:12px 10px; text-align:center; font-weight:700">${qty}</td>
                <td style="padding:12px 10px; text-align:left">${unitPrice} ${cur}</td>
                <td style="padding:12px 10px; text-align:left; font-weight:800; color:var(--accent)">${totalPrice} ${cur}</td>
              </tr>
            </tbody>
          </table>

          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:20px">
            <div style="max-width:55%; font-size:0.78rem; color:var(--text-muted); line-height:1.6">
              <div style="font-weight:700; color:var(--text-primary); margin-bottom:4px">شروط التصنيع والضمان:</div>
              1. يتم احتساب الأبعاد النهائية طبقاً لملف الـ 3D المعتمد من قبل العميل.<br>
              2. الدفعة المقدمة 50% لتأمين الخامات وبدء أمر الإنتاج المباشر.<br>
              3. يتم تسليم القطع مفحوصة ومزال منها الدعامات وجاهزة للتركيب فوراً.
            </div>
            <div style="min-width:240px; background:var(--bg-tertiary); padding:14px; border-radius:8px; font-size:0.85rem">
              <div style="display:flex; justify-content:space-between; margin-bottom:6px">
                <span>إجمالي الخامات والتصنيع:</span>
                <span>${(unitCost * qty).toFixed(2)} ${cur}</span>
              </div>
              <div style="display:flex; justify-content:space-between; margin-bottom:6px">
                <span>مصاريف الشحن / التوصيل:</span>
                <span>${r.batch.shippingFee || '0.00'} ${cur}</span>
              </div>
              <div style="border-top:2px solid var(--border); padding-top:8px; margin-top:8px; display:flex; justify-content:space-between; font-weight:900; font-size:1.1rem; color:var(--green)">
                <span>المبلغ الإجمالي المستحق:</span>
                <span>${totalPrice} ${cur}</span>
              </div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:flex-end; border-top:1px dashed var(--border); padding-top:16px; margin-top:20px; font-size:0.8rem">
            <div>
              <div>توقيع واستلام العميل: __________________</div>
            </div>
            <div style="text-align:left">
              <div style="font-weight:700; color:var(--text-primary)">اعتماد إدارة ورشة ELMALHY.3D</div>
              <div style="font-size:0.75rem; color:var(--text-muted)">المهندس كريم المالحي — مهندس التصنيع</div>
            </div>
          </div>
        </div>
      `;

      const target = document.getElementById('printable-invoice-content');
      if (target) target.innerHTML = html;
      this.openModal('modal-printable-invoice');
    },

    // ==========================================
    // Multi-Part Assembly Controller (تجميعات القطع)
    // ==========================================
    _assemblyParts: [],

    assemblyAddPart() {
      const nameInput = document.getElementById('assembly-part-name');
      const matSelect = document.getElementById('assembly-part-material');
      const weightInput = document.getElementById('assembly-part-weight');
      const hoursInput = document.getElementById('assembly-part-hours');
      const qtyInput = document.getElementById('assembly-part-qty');

      const name = nameInput?.value.trim();
      const material = matSelect?.value || 'patron_pla_plus';
      const weight = parseFloat(weightInput?.value);
      const hours = parseFloat(hoursInput?.value);
      const qty = parseInt(qtyInput?.value, 10) || 1;

      if (!name) {
        alert('من فضلك اكتب اسم الجزء أو المكون.');
        nameInput?.focus();
        return;
      }
      if (isNaN(weight) || weight <= 0) {
        alert('من فضلك أدخل وزن الجزء بالجرام بشكل صحيح.');
        weightInput?.focus();
        return;
      }
      if (isNaN(hours) || hours <= 0) {
        alert('من فضلك أدخل ساعات طباعة الجزء بشكل صحيح.');
        hoursInput?.focus();
        return;
      }

      const matNames = {
        patron_pla_plus: 'Patron PLA+',
        patron_pla: 'Patron PLA',
        patron_petg: 'Patron PETG',
        patron_abs: 'Patron ABS',
        esun_pla_plus: 'eSUN PLA+',
        tpu: 'TPU 95A'
      };

      const part = {
        id: 'asm-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        name: name,
        material: material,
        materialName: matNames[material] || material,
        weight: weight,
        hours: hours,
        qty: qty
      };

      this._assemblyParts.push(part);

      if (nameInput) nameInput.value = '';
      if (weightInput) weightInput.value = '';
      if (hoursInput) hoursInput.value = '';
      if (qtyInput) qtyInput.value = '1';

      this.renderAssembly();
    },

    assemblyRemovePart(id) {
      this._assemblyParts = this._assemblyParts.filter(p => p.id !== id);
      this.renderAssembly();
    },

    assemblyClear() {
      if (this._assemblyParts.length === 0) return;
      if (confirm('هل أنت متأكد من تفريغ جميع أجزاء التجميعة الحالية؟')) {
        this._assemblyParts = [];
        this.renderAssembly();
      }
    },

    renderAssembly() {
      const tbody = document.getElementById('assembly-table-body');
      const countEl = document.getElementById('assembly-parts-count');
      if (!tbody) return;

      if (countEl) countEl.textContent = this._assemblyParts.length;

      if (this._assemblyParts.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted)">
              لم تتم إضافة أجزاء للتجميعة بعد. استخدم النموذج أعلاه لإضافة مكونات المجسم.
            </td>
          </tr>
        `;
        document.getElementById('assembly-total-price').textContent = '0.00';
        document.getElementById('assembly-total-pieces').textContent = '0 قطعة';
        document.getElementById('assembly-total-weight').textContent = '0.0 g';
        document.getElementById('assembly-total-hours').textContent = '0.0 ساعة';
        document.getElementById('assembly-cost-material').textContent = '0.00 ج.م';
        document.getElementById('assembly-cost-machine').textContent = '0.00 ج.م';
        document.getElementById('assembly-total-cost').textContent = '0.00 ج.م';
        document.getElementById('assembly-total-profit').textContent = '0.00 ج.م';
        return;
      }

      const CalcMod = root.WorkshopCalculator;
      const mats = CalcMod ? CalcMod.MATERIALS : {};
      const primaryPrinter = Printer ? Printer.getPrimaryPrinter() : null;
      const hourlyOperatingCost = primaryPrinter ? Printer.calculateHourlyCost(primaryPrinter).totalHourlyOperatingCost : 18.5;

      let totalPieces = 0;
      let totalWeight = 0;
      let totalHours = 0;
      let totalMatCost = 0;
      let totalMachineCost = 0;

      const rows = this._assemblyParts.map((p, idx) => {
        const pTotalWeight = p.weight * p.qty;
        const pTotalHours = p.hours * p.qty;
        const pricePerKg = mats[p.material]?.pricePerKg || 650;
        const matCost = pTotalWeight * (pricePerKg / 1000) * 1.05;
        const machCost = pTotalHours * hourlyOperatingCost;

        totalPieces += p.qty;
        totalWeight += pTotalWeight;
        totalHours += pTotalHours;
        totalMatCost += matCost;
        totalMachineCost += machCost;

        return `
          <tr>
            <td><strong>${idx + 1}. ${p.name}</strong></td>
            <td><span class="badge" style="background:#e0f2fe; color:#0284c7; font-size:0.75rem">${p.materialName}</span></td>
            <td>${p.weight.toFixed(1)} g</td>
            <td>${p.hours.toFixed(1)} h</td>
            <td><strong>${p.qty}</strong></td>
            <td><strong>${pTotalWeight.toFixed(1)} g</strong></td>
            <td>${pTotalHours.toFixed(1)} h</td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="App.assemblyRemovePart('${p.id}')">حذف</button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.innerHTML = rows;

      const totalCost = totalMatCost + totalMachineCost;
      const margin = 0.40;
      const suggestedPrice = Math.round(totalCost / (1 - margin));
      const profit = suggestedPrice - totalCost;

      document.getElementById('assembly-total-price').textContent = suggestedPrice.toFixed(2);
      document.getElementById('assembly-total-pieces').textContent = `${totalPieces} قطعة (${this._assemblyParts.length} مكونات)`;
      document.getElementById('assembly-total-weight').textContent = `${totalWeight.toFixed(1)} g`;
      document.getElementById('assembly-total-hours').textContent = `${totalHours.toFixed(1)} ساعة`;
      document.getElementById('assembly-cost-material').textContent = `${totalMatCost.toFixed(2)} ج.م`;
      document.getElementById('assembly-cost-machine').textContent = `${totalMachineCost.toFixed(2)} ج.م`;
      document.getElementById('assembly-total-cost').textContent = `${totalCost.toFixed(2)} ج.م`;
      document.getElementById('assembly-total-profit').textContent = `${profit.toFixed(2)} ج.م`;
    },

    assemblySaveAsQuote() {
      if (this._assemblyParts.length === 0) {
        alert('يرجى إضافة أجزاء للتجميعة أولاً قبل حفظها كعرض سعر.');
        return;
      }

      let totalWeight = 0;
      let totalHours = 0;
      const summaryNames = this._assemblyParts.map(p => `${p.name} (${p.qty}x)`).join(' + ');
      this._assemblyParts.forEach(p => {
        totalWeight += p.weight * p.qty;
        totalHours += p.hours * p.qty;
      });

      this.openNewOrderModal(true);
      document.getElementById('order-item-name').value = `تجميعة مركبة: ${summaryNames}`;
      document.getElementById('order-item-weight').value = Math.round(totalWeight);
      document.getElementById('order-item-hours').value = parseFloat(totalHours.toFixed(1));
      document.getElementById('order-item-qty').value = '1';
      document.getElementById('order-margin-pct').value = '40';
      document.getElementById('order-notes').value = `مكونات التجميعة:\n` + this._assemblyParts.map(p => `• ${p.name}: ${p.qty} قطع × ${p.weight}g (${p.hours}h) - ${p.materialName}`).join('\n');
      this.recalcOrderModal();
    },

    assemblySaveAsProduct() {
      if (this._assemblyParts.length === 0) {
        alert('يرجى إضافة أجزاء للتجميعة أولاً قبل حفظها كمنتج في الكتالوج.');
        return;
      }

      let totalWeight = 0;
      let totalHours = 0;
      this._assemblyParts.forEach(p => {
        totalWeight += p.weight * p.qty;
        totalHours += p.hours * p.qty;
      });

      const price = parseFloat(document.getElementById('assembly-total-price').textContent) || 0;
      const totalCost = parseFloat(document.getElementById('assembly-total-cost').textContent) || 0;

      this.openModal('modal-product');
      document.getElementById('modal-product-title').textContent = 'إضافة تجميعة جديدة كمنتج جاهز';
      document.getElementById('prod-form').reset();
      document.getElementById('prod-sku').value = 'ASM-' + Date.now().toString().slice(-5);
      document.getElementById('prod-name').value = 'تجميعة مركبة (' + this._assemblyParts.length + ' أجزاء)';
      document.getElementById('prod-category').value = 'assemblies';
      document.getElementById('prod-weight').value = Math.round(totalWeight);
      document.getElementById('prod-hours').value = parseFloat(totalHours.toFixed(1));
      document.getElementById('prod-price').value = price;
      document.getElementById('prod-cost').value = Math.round(totalCost);
      document.getElementById('prod-desc').value = 'مكونات التجميعة:\n' + this._assemblyParts.map(p => `• ${p.name}: ${p.qty} قطع × ${p.weight}g`).join('\n');
    },

    // ==========================================
    // ROI & Payback Controller (العائد على الاستثمار)
    // ==========================================
    renderROI() {
      this.roiCalculate();
    },

    roiCalculate() {
      const printerCost = parseFloat(document.getElementById('roi-printer-cost')?.value) || 26000;
      const printerLife = parseFloat(document.getElementById('roi-printer-life')?.value) || 5000;
      const avgProfit = parseFloat(document.getElementById('roi-avg-profit')?.value) || 85;
      const avgHours = parseFloat(document.getElementById('roi-avg-hours')?.value) || 2.5;
      const monthlyVolume = parseFloat(document.getElementById('roi-monthly-volume')?.value) || 35;
      const dailyHours = parseFloat(document.getElementById('roi-daily-hours')?.value) || 10;

      const paybackUnits = avgProfit > 0 ? Math.ceil(printerCost / avgProfit) : 0;
      const paybackHours = Math.round(paybackUnits * avgHours);
      const monthlyProfit = Math.round(monthlyVolume * avgProfit);
      const monthsToBreakEven = monthlyProfit > 0 ? (printerCost / monthlyProfit).toFixed(1) : '∞';

      let actualProfit = 0;
      try {
        const orders = DB.getOrders ? DB.getOrders() : [];
        orders.forEach(o => {
          if (o.stage === 'delivered' || o.stage === 'completed') {
            actualProfit += (o.financials?.profit || 0);
          }
        });
      } catch (e) {}

      const progressPct = printerCost > 0 ? Math.min(100, Math.round((actualProfit / printerCost) * 100)) : 0;

      const unitsEl = document.getElementById('roi-out-units');
      const hoursEl = document.getElementById('roi-out-hours');
      const profitEl = document.getElementById('roi-out-monthly-profit');
      const monthsEl = document.getElementById('roi-out-months');
      const actualEl = document.getElementById('roi-actual-profit');
      const targetEl = document.getElementById('roi-target-cost');
      const fillEl = document.getElementById('roi-progress-fill');
      const pctEl = document.getElementById('roi-progress-percent');
      const statusEl = document.getElementById('roi-recovery-status');

      if (unitsEl) unitsEl.textContent = `${paybackUnits.toLocaleString('ar-EG')} قطعة`;
      if (hoursEl) hoursEl.textContent = `${paybackHours.toLocaleString('ar-EG')} ساعة`;
      if (profitEl) profitEl.textContent = `${monthlyProfit.toLocaleString('ar-EG')} ج.م`;
      if (monthsEl) monthsEl.textContent = `${monthsToBreakEven} شهر`;
      if (actualEl) actualEl.textContent = `${actualProfit.toLocaleString('ar-EG')} ج.م`;
      if (targetEl) targetEl.textContent = `${printerCost.toLocaleString('ar-EG')} ج.م`;
      if (fillEl) fillEl.style.width = `${progressPct}%`;
      if (pctEl) pctEl.textContent = `${progressPct}%`;

      if (statusEl) {
        if (progressPct >= 100) {
          statusEl.textContent = '🎉 مبروك! تم استرداد تكلفة الطابعة بالكامل وتوليد أرباح صافية 100%.';
          statusEl.style.color = 'var(--green)';
        } else {
          const remaining = Math.max(0, printerCost - actualProfit);
          statusEl.textContent = `متبقي ${remaining.toLocaleString('ar-EG')} ج.م أرباح صافية للوصول لنقطة التعادل التام.`;
          statusEl.style.color = 'var(--text-muted)';
        }
      }
    },

    // ==========================================
    // Customer Orders Controller (طلبات العملاء الخارجية)
    // ==========================================
    _customerOrders: [],

    initCustomerOrdersConfig() {
      const savedUrl = localStorage.getItem('cust_orders_url');
      const savedKey = localStorage.getItem('cust_orders_key');
      if (savedUrl) { const el = document.getElementById('cust-orders-url'); if (el) el.value = savedUrl; }
      if (savedKey) { const el = document.getElementById('cust-orders-key'); if (el) el.value = savedKey; }
      this.customerOrdersFetch(false);
    },

    customerOrdersSaveConfig() {
      const url = document.getElementById('cust-orders-url')?.value.trim() || '';
      const key = document.getElementById('cust-orders-key')?.value.trim() || '';
      localStorage.setItem('cust_orders_url', url);
      localStorage.setItem('cust_orders_key', key);
    },

    customerOrdersUpdateBadge() {
      try {
        const local = JSON.parse(localStorage.getItem('elmalhy_customer_web_orders') || '[]');
        const pendingCount = local.filter(o => o.Status === 'pending_review' || o.status === 'جديد (New)').length;
        const badge = document.getElementById('sidebar-web-orders-badge');
        if (badge) {
          badge.textContent = pendingCount > 0 ? pendingCount : '0';
          badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        }
      } catch (e) {}
    },

    async customerOrdersFetch(showAlert = true) {
      const url = localStorage.getItem('cust_orders_url') || document.getElementById('cust-orders-url')?.value.trim() || '';
      const key = localStorage.getItem('cust_orders_key') || document.getElementById('cust-orders-key')?.value.trim() || '';

      let fetchedOrders = [];

      if (url && !url.includes('PASTE_YOUR')) {
        try {
          const res = await fetch(`${url}?action=list&key=${encodeURIComponent(key)}`);
          const data = await res.json();
          if (data.success && Array.isArray(data.orders)) {
            fetchedOrders = data.orders;
            localStorage.setItem('elmalhy_customer_web_orders', JSON.stringify(fetchedOrders));
            if (showAlert) alert(`✅ تم جلب ${fetchedOrders.length} طلب بنجاح من Google Sheets.`);
          } else if (showAlert) {
            alert('تعذر جلب الطلبات: ' + (data.error || 'تأكد من صحة الرابط وكلمة السر'));
          }
        } catch (err) {
          console.warn('Google Sheets fetch failed, falling back to local orders:', err);
          if (showAlert) alert('تعذر الاتصال بالسيرفر السحابي، سيتم عرض الطلبات المخزنة محلياً.');
        }
      }

      try {
        let local = JSON.parse(localStorage.getItem('elmalhy_customer_web_orders') || '[]');
        if (local.length === 0) {
          local = [{
            TrackingCode: 'ORD-894210',
            Timestamp: new Date().toISOString(),
            PartName: 'ترس ميكانيكي (Gearbox Bracket)',
            ClientName: 'م. أحمد محمود',
            Phone: '01012345678',
            Notes: 'الخامة المطلوبة PETG أسود بملء 40%',
            FileType: 'STL',
            FileName: 'gearbox_bracket.stl',
            Weight: 54,
            Hours: 3.2,
            AutoPrice: 165,
            FinalPrice: 165,
            Status: 'pending_review'
          }];
          localStorage.setItem('elmalhy_customer_web_orders', JSON.stringify(local));
        }
        this._customerOrders = local;
      } catch (e) {
        this._customerOrders = [];
      }

      this.renderCustomerOrders();
      this.customerOrdersUpdateBadge();
    },

    renderCustomerOrders() {
      const tbody = document.getElementById('cust-orders-tbody');
      const countEl = document.getElementById('cust-orders-count');
      if (!tbody) return;

      const orders = this._customerOrders || [];
      if (countEl) countEl.textContent = orders.length;

      if (orders.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align:center; padding:30px; color:var(--text-muted)">
              لا توجد طلبات عملاء حتى الآن. يمكنك إرسال طلب تجريبي عبر صفحة العميل order.html.
            </td>
          </tr>
        `;
        return;
      }

      const statusLabels = {
        pending_review: '<span class="badge" style="background:#fef3c7; color:#d97706">⏳ قيد المراجعة</span>',
        priced: '<span class="badge" style="background:#e0f2fe; color:#0284c7">💰 تم التسعير</span>',
        printing: '<span class="badge" style="background:#e0e7ff; color:#4f46e5">🖨️ جاري الطباعة</span>',
        ready: '<span class="badge" style="background:#dcfce7; color:#16a34a">📦 جاهز</span>',
        delivered: '<span class="badge" style="background:#dcfce7; color:#16a34a">✅ تم التسليم</span>',
        converted: '<span class="badge" style="background:#f1f5f9; color:#64748b">🏭 تم تحويله للورشة</span>'
      };

      const rows = orders.map(o => {
        const code = o.TrackingCode || o.code || '—';
        const dateStr = o.Timestamp || o.date ? new Date(o.Timestamp || o.date).toLocaleDateString('ar-EG') : '—';
        const client = o.ClientName || o.customerName || '—';
        const phone = o.Phone || o.customerPhone || '—';
        const part = o.PartName || o.fileName || 'مجسم ثلاثي الأبعاد';
        const file = o.FileName || o.fileName || 'ملف مرفق';
        const weight = o.Weight || o.weight ? `${o.Weight || o.weight} g` : '—';
        const price = (o.FinalPrice || o.AutoPrice || o.price || 0) + ' ج.م';
        const rawStatus = o.Status || o.status || 'pending_review';
        const statusHtml = statusLabels[rawStatus] || `<span class="badge">${rawStatus}</span>`;

        return `
          <tr>
            <td><strong style="color:var(--accent); font-family:monospace">${code}</strong></td>
            <td>${dateStr}</td>
            <td><strong>${client}</strong></td>
            <td><a href="tel:${phone}" style="color:var(--accent)">${phone}</a></td>
            <td>${part}</td>
            <td><span style="font-size:0.75rem; color:var(--text-muted)">📎 ${file}</span></td>
            <td>${weight}</td>
            <td><strong style="color:var(--green)">${price}</strong></td>
            <td>${statusHtml}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="App.customerOrderConvertToOrder('${code}')">🏭 اعتماد كطلب ورشة</button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.innerHTML = rows;
    },

    customerOrderConvertToOrder(code) {
      const order = (this._customerOrders || []).find(o => (o.TrackingCode || o.code) === code);
      if (!order) return;

      this.openNewOrderModal(false);

      const client = order.ClientName || order.customerName || '';
      const phone = order.Phone || order.customerPhone || '';
      const part = order.PartName || order.fileName || 'مجسم ثلاثي الأبعاد';
      const weight = order.Weight || order.weight || 50;
      const hours = order.Hours || order.hours || 2.5;
      const notes = order.Notes || order.notes || '';

      document.getElementById('order-item-name').value = `طلب عميل: ${part}`;
      document.getElementById('order-item-weight').value = weight;
      document.getElementById('order-item-hours').value = hours;
      document.getElementById('order-item-qty').value = '1';
      document.getElementById('order-notes').value = `كود المتابعة: ${code} • العميل: ${client} (${phone})\n${notes}`;

      this.recalcOrderModal();

      order.Status = 'converted';
      localStorage.setItem('elmalhy_customer_web_orders', JSON.stringify(this._customerOrders));
      this.customerOrdersUpdateBadge();
    }

,
    // ==========================================
    // Advanced 3D Engine & Showcase Controls
    // ==========================================
    calcSet3DColor(colorKey) {
      if (this._main3DViewer) {
        this._main3DViewer.setColor(colorKey);
      }
    },

    calcToggleAutoRotate() {
      if (this._main3DViewer) {
        const active = this._main3DViewer.toggleAutoRotate();
        const btn = document.getElementById('btn-3d-autorotate');
        if (btn) btn.classList.toggle('active', active);
      }
    },

    calcToggleBBox() {
      if (this._main3DViewer) {
        this._showBBox = !this._showBBox;
        this._main3DViewer.toggleBoundingBox(this._showBBox);
        const btn = document.getElementById('btn-3d-bbox');
        if (btn) btn.classList.toggle('active', this._showBBox);
      }
    },

    calcOnSlicingChange(val) {
      const num = parseInt(val, 10);
      if (this._main3DViewer) {
        this._main3DViewer.setSlicePercent(num);
      }
      const badge = document.getElementById('calc-3d-slicing-badge');
      if (badge) badge.textContent = num + '%';
    },

    // ==========================================
    // 3D Product Showcase (كتالوج المنتجات)
    // ==========================================
    _activeProduct3D: null,
    _product3DViewer: null,

    openProduct3DModal(productId) {
      const prod = Products.getProductById(productId);
      if (!prod) return;

      this._activeProduct3D = prod;

      document.getElementById('product-3d-modal-title').textContent = `استعراض: ${prod.name}`;
      document.getElementById('product-3d-badge-name').textContent = prod.name;
      document.getElementById('product-3d-name').textContent = prod.name;
      document.getElementById('product-3d-sku').textContent = prod.sku;
      document.getElementById('product-3d-cat').textContent = prod.category;
      document.getElementById('product-3d-desc').textContent = prod.description || 'منتج عالي الجودة مطبوع بتقنية FDM بدقة متناهية وطبقات ملتحمة.';
      document.getElementById('product-3d-weight').textContent = `${prod.defaultWeightG} جرام`;
      document.getElementById('product-3d-hours').textContent = `${prod.defaultPrintHours} ساعة`;
      document.getElementById('product-3d-price').textContent = `${prod.basePrice} ج.م`;

      // Approximate dimensions based on category & weight
      const estDim = Math.round(Math.cbrt((prod.defaultWeightG / 1.24) * 1000));
      document.getElementById('product-3d-dims').textContent = `${estDim} × ${estDim} × ${Math.round(estDim * 1.2)} مم`;

      this.openModal('modal-product-3d-view');

      // Initialize or reuse product 3D viewer
      setTimeout(() => {
        const container = document.getElementById('product-3d-viewport-container');
        const canvas = document.getElementById('product-3d-canvas');
        if (!container || !canvas || !root.WorkshopViewer3D) return;

        if (!this._product3DViewer) {
          this._product3DViewer = root.WorkshopViewer3D.createViewer(canvas, container, {
            bedWidth: 200,
            bedDepth: 200,
            color: root.WorkshopViewer3D.FILAMENT_COLORS.sky.hex
          });
        }

        // Determine shape
        let shapeType = 'box';
        const nameLower = (prod.name + ' ' + (prod.sku || '')).toLowerCase();
        if (nameLower.includes('moon') || nameLower.includes('قمر') || nameLower.includes('مصباح')) shapeType = 'moon-lamp';
        else if (nameLower.includes('stand') || nameLower.includes('حامل')) shapeType = 'phone-stand';
        else if (nameLower.includes('key') || nameLower.includes('ميدالية')) shapeType = 'keychain';
        else if (nameLower.includes('vase') || nameLower.includes('فازة')) shapeType = 'vase';
        else if (nameLower.includes('gear') || nameLower.includes('ترس')) shapeType = 'gear';

        this._product3DViewer.loadProceduralModel(shapeType, { width: estDim, depth: estDim, height: Math.round(estDim * 1.2) });
      }, 100);
    },

    product3DSetColor(colorKey) {
      if (this._product3DViewer) {
        this._product3DViewer.setColor(colorKey);
      }
    },

    product3DToggleWireframe() {
      if (this._product3DViewer) {
        this._product3DViewer.toggleWireframe();
      }
    },

    product3DResetCamera() {
      if (this._product3DViewer) {
        this._product3DViewer.resetView();
      }
    },

    product3DCreateQuote() {
      if (!this._activeProduct3D) return;
      const prod = this._activeProduct3D;
      this.closeModal('modal-product-3d-view');
      this.openNewOrderModal(true);
      document.getElementById('order-product-select').value = prod.id;
      this.onOrderProductSelected();
    },

    product3DCreateOrder() {
      if (!this._activeProduct3D) return;
      const prod = this._activeProduct3D;
      this.closeModal('modal-product-3d-view');
      this.openNewOrderModal(false);
      document.getElementById('order-product-select').value = prod.id;
      this.onOrderProductSelected();
    },

  };



  root.App = App;
  document.addEventListener('DOMContentLoaded', () => App.init());
})(typeof window !== 'undefined' ? window : this);

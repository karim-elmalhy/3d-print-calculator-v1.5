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

      const order = Orders.createOrder({
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

    // ===== CALCULATOR INTEGRATED METHODS =====
    initCalculator() {
      const defaults = root.WorkshopCalculator
        ? root.WorkshopCalculator.getDefaultSettings()
        : {};
      const powEl = document.getElementById('calc-power');
      const elecEl = document.getElementById('calc-elec-rate');
      const consEl = document.getElementById('calc-consumables');
      const margEl = document.getElementById('calc-margin');
      const depEl = document.getElementById('calc-deprec');

      if (powEl && defaults.printerPowerKw) powEl.value = defaults.printerPowerKw;
      if (elecEl && defaults.electricityRate) elecEl.value = defaults.electricityRate;
      if (consEl && defaults.consumablesPerHour) consEl.value = defaults.consumablesPerHour;
      if (margEl && defaults.defaultMarginPercent) margEl.value = defaults.defaultMarginPercent;
      if (depEl) {
        const depPerHour = ((defaults.printerPrice || 22000) / (defaults.printerLifespanHours || 6000));
        depEl.value = Math.round(depPerHour * 100) / 100;
      }
      this.calcUpdate();
    },

    onCalcMaterialChange() {
      const matSel = document.getElementById('calc-material');
      if (!matSel) return;
      const opt = matSel.options[matSel.selectedIndex];
      const defaultSpool = opt ? opt.getAttribute('data-spool') : null;
      if (defaultSpool) {
        document.getElementById('calc-spool-price').value = defaultSpool;
      }
      this.calcUpdate();
    },

    calcUpdate() {
      const CalcEngine = root.WorkshopCalc;
      if (!CalcEngine) return;

      const weightEl = document.getElementById('calc-weight');
      if (!weightEl) return;

      const params = {
        partWeight: Number(weightEl.value) || 0,
        printHours: Number(document.getElementById('calc-hours').value) || 0,
        quantity: Math.max(1, Number(document.getElementById('calc-qty').value) || 1),
        spoolPrice: Number(document.getElementById('calc-spool-price').value) || 700,
        spoolWeight: 1000,
        printerPowerKw: Number(document.getElementById('calc-power').value) || 0.22,
        electricityRate: Number(document.getElementById('calc-elec-rate').value) || 2.5,
        printerPrice: 0,
        printerLifespanHours: 1,
        consumablesPerHour: Number(document.getElementById('calc-consumables').value) || 5,
        laborHours: Number(document.getElementById('calc-labor-hours').value) || 0,
        laborRatePerHour: Number(document.getElementById('calc-labor-rate').value) || 50,
        hardwareCost: Number(document.getElementById('calc-hardware').value) || 0,
        postProcessCost: Number(document.getElementById('calc-postprocess').value) || 0,
        packagingCost: Number(document.getElementById('calc-packaging').value) || 0,
        shippingFee: Number(document.getElementById('calc-shipping').value) || 0,
        profitMarginPercent: Number(document.getElementById('calc-margin').value) || 40,
        failureRatePercent: Number(document.getElementById('calc-failure').value) || 5,
        minOrderPrice: Number(document.getElementById('calc-min-price').value) || 0,
      };

      const deprecPerHour = Number(document.getElementById('calc-deprec').value) || 0;
      params.consumablesPerHour = (Number(document.getElementById('calc-consumables').value) || 5) + deprecPerHour;

      const res = CalcEngine.calculateCost(params);
      const qty = params.quantity;

      const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG', {minimumFractionDigits: 2, maximumFractionDigits: 2});

      const outPrice = document.getElementById('calc-out-price');
      if (outPrice) outPrice.textContent = fmt(res.finalUnitPrice);

      const outMat = document.getElementById('calc-out-material');
      if (outMat) outMat.textContent = fmt(res.materialCost) + ' ج.م';

      const outPow = document.getElementById('calc-out-power');
      if (outPow) outPow.textContent = fmt(res.powerCost) + ' ج.م';

      const outDep = document.getElementById('calc-out-deprec');
      if (outDep) outDep.textContent = fmt(deprecPerHour * params.printHours) + ' ج.م';

      const outCons = document.getElementById('calc-out-consumables');
      if (outCons) outCons.textContent = fmt((Number(document.getElementById('calc-consumables').value) || 5) * params.printHours) + ' ج.م';

      const outLab = document.getElementById('calc-out-labor');
      if (outLab) outLab.textContent = fmt(res.laborCost + res.postProcessCost) + ' ج.م';

      const outExt = document.getElementById('calc-out-extras');
      if (outExt) outExt.textContent = fmt(res.hardwareCost + res.packagingCost) + ' ج.م';

      const outFail = document.getElementById('calc-out-failure');
      if (outFail) outFail.textContent = fmt(res.failureCost) + ' ج.م';

      const outTotal = document.getElementById('calc-out-total-cost');
      if (outTotal) outTotal.textContent = fmt(res.totalUnitCost) + ' ج.م';

      const outMarg = document.getElementById('calc-out-margin');
      if (outMarg) outMarg.textContent = res.actualMarginPercent + '%';

      const outProf = document.getElementById('calc-out-profit');
      if (outProf) outProf.textContent = fmt(res.unitProfit) + ' ج.م';

      const outQtyLbl = document.getElementById('calc-out-qty-label');
      if (outQtyLbl) outQtyLbl.textContent = '×' + qty;

      const outBatch = document.getElementById('calc-out-batch');
      if (outBatch) outBatch.textContent = fmt(res.batchTotalPrice) + ' ج.م';

      const outGram = document.getElementById('calc-out-per-gram');
      if (outGram) outGram.textContent = res.partWeight > 0 ? fmt(res.totalUnitCost / res.partWeight) : '0';

      const outHour = document.getElementById('calc-out-per-hour');
      if (outHour) outHour.textContent = res.printHours > 0 ? fmt(res.totalUnitCost / res.printHours) : '0';

      const outMark = document.getElementById('calc-out-markup');
      if (outMark) outMark.textContent = res.markupPercent + '%';

      this._lastCalcResult = res;
    },

    calcConvertLength() {
      const CalcMod = root.WorkshopCalculator;
      if (!CalcMod) return;
      const lenMm = Number(document.getElementById('calc-length-mm').value) || 0;
      if (!lenMm) return;
      const diamMm = Number(document.getElementById('calc-diameter').value) || 1.75;
      const matId = document.getElementById('calc-material').value;
      const wg = CalcMod.convertFilamentLength(lenMm, diamMm, matId);
      document.getElementById('calc-weight').value = wg;
      this.calcUpdate();
    },

    calcReset() {
      document.getElementById('calc-weight').value = 50;
      document.getElementById('calc-hours').value = 2.5;
      document.getElementById('calc-qty').value = 1;
      document.getElementById('calc-spool-price').value = 700;
      document.getElementById('calc-labor-hours').value = 0;
      document.getElementById('calc-hardware').value = 0;
      document.getElementById('calc-postprocess').value = 0;
      document.getElementById('calc-packaging').value = 0;
      document.getElementById('calc-shipping').value = 0;
      const lenEl = document.getElementById('calc-length-mm');
      if (lenEl) lenEl.value = '';
      this.calcUpdate();
    },

    calcSaveAsQuote() {
      if (!this._lastCalcResult) { this.calcUpdate(); }
      const r = this._lastCalcResult;
      if (!r) return;
      document.getElementById('order-is-quote').value = 'true';
      document.getElementById('modal-order-title').textContent = 'إنشاء عرض سعر من الحاسبة';
      document.getElementById('order-item-name').value = 'قطعة مخصصة';
      document.getElementById('order-item-weight').value = r.partWeight;
      document.getElementById('order-item-hours').value = r.printHours;
      document.getElementById('order-item-qty').value = r.quantity;
      document.getElementById('order-margin-pct').value = r.actualMarginPercent;
      this.openModal('modal-order');
      this.recalcOrderModal();
    },

    calcCopyWhatsapp() {
      if (!this._lastCalcResult) this.calcUpdate();
      const r = this._lastCalcResult;
      if (!r) return;
      const text = `🖨️ *ELMALHY.3D — عرض سعر قطعة طباعة ثلاثية الأبعاد*\n\nالوزن: ${r.partWeight} جرام | وقت الطباعة: ${r.printHours} ساعة\n💰 سعر القطعة: ${r.finalUnitPrice} ج.م\n📦 إجمالي الطلبية (الكمية ×${r.quantity}): ${r.batchTotalPrice} ج.م\n\nللطلب والاستفسار يرجى الرد على هذه الرسالة 🤝`;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
          alert('تم نسخ رسالة الواتساب بنجاح! يمكنك لصقها الآن في المحادثة.');
        }).catch(() => {
          prompt('انسخ الرسالة التالية:', text);
        });
      } else {
        prompt('انسخ الرسالة التالية:', text);
      }
    }
  };

  root.App = App;
  document.addEventListener('DOMContentLoaded', () => App.init());
})(typeof window !== 'undefined' ? window : this);

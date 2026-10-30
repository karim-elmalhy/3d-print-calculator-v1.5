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
      this.calcLoadPreset('3dbenchy');
      this.calcUpdate();
    },

    init3DViewer() {
      const container = document.getElementById('calc-viewport-container');
      const canvas = document.getElementById('calc-3d-canvas');
      if (!container || !canvas) return;

      if (typeof THREE === 'undefined') {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = container.clientWidth || 300;
          canvas.height = 240;
          ctx.fillStyle = '#0e1726';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
          ctx.lineWidth = 1;
          for (let x = 20; x < canvas.width; x += 30) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
          }
          for (let y = 20; y < canvas.height; y += 30) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
          }
          ctx.fillStyle = '#38bdf8';
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
        scene.background = new THREE.Color(0x0a101d);

        const camera = new THREE.PerspectiveCamera(45, width / height, 1, 2000);
        camera.position.set(120, -180, 130);
        camera.up.set(0, 0, 1);

        const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

        const ambLight = new THREE.AmbientLight(0xffffff, 0.65);
        scene.add(ambLight);

        const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
        dirLight.position.set(100, -100, 200);
        scene.add(dirLight);

        const gridHelper = new THREE.GridHelper(225, 15, 0x38bdf8, 0x1f3454);
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
          this.calcProcessSTLFile(files[0]);
        }
      });
    },

    calcHandleFileUpload(event) {
      const file = event.target.files?.[0];
      if (file) {
        this.calcProcessSTLFile(file);
      }
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

          this.calcUpdate3DGeometry(this._modelGeometry, `📂 ${this._modelGeometry.name}`);
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

    calcLoadPreset(presetId) {
      const CalcMod = root.WorkshopCalculator;
      if (!CalcMod) return;

      const presets = CalcMod.getModelPresets();
      const preset = presets.find(p => p.id === presetId) || presets[0];
      this._activePresetId = preset.id;

      document.querySelectorAll('.model-preset-card').forEach(c => {
        c.classList.toggle('active', c.dataset.preset === preset.id);
      });

      this._modelGeometry = {
        name: preset.name,
        solidVolumeMm3: preset.volumeMm3,
        surfaceAreaMm2: preset.surfaceAreaMm2,
        dimensions: preset.dimensions,
        triangleCount: preset.id === '3dbenchy' ? 12500 : 25000
      };

      const dimEl = document.getElementById('m-metric-dim');
      const volEl = document.getElementById('m-metric-vol');
      const areaEl = document.getElementById('m-metric-area');
      const triEl = document.getElementById('m-metric-tri');

      if (dimEl) dimEl.textContent = `${preset.dimensions.width} × ${preset.dimensions.depth} × ${preset.dimensions.height} مم`;
      if (volEl) volEl.textContent = `${(preset.volumeMm3 / 1000).toFixed(2)} cm³`;
      if (areaEl) areaEl.textContent = `${(preset.surfaceAreaMm2 / 100).toFixed(1)} cm²`;
      if (triEl) triEl.textContent = this._modelGeometry.triangleCount.toLocaleString('ar-EG');

      if (preset.defaultInfill !== undefined) {
        const infillInput = document.getElementById('calc-infill');
        const infillBadge = document.getElementById('calc-infill-badge');
        if (infillInput) infillInput.value = preset.defaultInfill;
        if (infillBadge) infillBadge.textContent = preset.defaultInfill + '%';
      }

      if (preset.defaultWalls !== undefined) {
        const wallInput = document.getElementById('calc-walls');
        if (wallInput) wallInput.value = preset.defaultWalls;
      }

      const mcToggle = document.getElementById('calc-multicolor-toggle');
      const mcFields = document.getElementById('multicolor-fields');
      const mcChip = document.getElementById('chip-multicolor-status');
      if (preset.multiColor?.enabled) {
        if (mcToggle) mcToggle.checked = true;
        if (mcFields) mcFields.style.display = 'block';
        if (mcChip) mcChip.textContent = `${preset.multiColor.colorSwapsCount} تبديلة`;
        const swapsEl = document.getElementById('calc-color-swaps');
        if (swapsEl) swapsEl.value = preset.multiColor.colorSwapsCount;
      } else {
        if (mcToggle) mcToggle.checked = false;
        if (mcFields) mcFields.style.display = 'none';
        if (mcChip) mcChip.textContent = 'معطل';
      }

      this.calcUpdate3DGeometry(this._modelGeometry, `${preset.icon} ${preset.name}`);
      this.calcAutoNesting();
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
    },

    calcReset() {
      this.calcLoadPreset('3dbenchy');
      document.getElementById('calc-qty').value = 1;
      document.getElementById('calc-packaging').value = 0;
      document.getElementById('calc-shipping').value = 0;
      document.getElementById('calc-hardware').value = 0;
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
  };

  root.App = App;
  document.addEventListener('DOMContentLoaded', () => App.init());
})(typeof window !== 'undefined' ? window : this);

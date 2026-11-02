// ============================================================
// حاسبة 3D Pro — نظام طلبات العملاء (Backend بدون سيرفر)
// ============================================================
// طريقة التركيب (5 دقايق):
// 1) روح على sheets.google.com واعمل شيت جديد فاضي (Blank Sheet)
// 2) من القائمة العلوية: Extensions > Apps Script
// 3) امسح أي كود موجود في المحرر، والصق هذا الملف بالكامل مكانه
// 4) غيّر ADMIN_SECRET_KEY تحت لأي كلمة سر خاصة بيك أنت بس (خليها معقدة)
// 5) لو حابب، عدّل أرقام PRICING تحت عشان تطابق أسعارك الحقيقية
// 6) من فوق يمين: Deploy > New deployment
//      - اضغط أيقونة الترس بجانب "Select type" واختار "Web app"
//      - Execute as: Me
//      - Who has access: Anyone
//      - اضغط Deploy، واقبل صلاحيات جوجل اللي هتظهرلك
// 7) هيديك رابط (Web app URL) — انسخه وابعته لإكمال ربط الموقع
//
// ملاحظة أمان: مفيش سيرفر تاني بيشوف كلمة السر دي غير الأدمن بتاعك،
// بس لو حد فتح كود app.js وشافها هيقدر يستخدمها. ده مقبول لحجم مشروع
// صغير زي ده، بس متشاركش رابط الـ Web App أو الكلمة دي مع حد.
// ============================================================

const ADMIN_SECRET_KEY = 'CHANGE-ME-TO-YOUR-OWN-SECRET-1234';
const SHEET_NAME = 'Orders';
const DRIVE_FOLDER_NAME = '3D_Print_Customer_Orders';
const MAX_FILE_MB = 15;

// أسعار افتراضية لحساب السعر التلقائي لملفات G-code فقط
// (عدّل الأرقام دي لتطابق أسعارك الحقيقية في الحاسبة)
const PRICING = {
  spoolPricePerGram: 0.60,        // 600 ج.م / 1000 جم
  printerPowerKw: 0.20,
  electricityRatePerKwh: 2.15,
  printerPrice: 9500,
  printerLifespanHours: 3000,
  laborRatePerHour: 30,           // إشراف جزئي أثناء الطباعة
  failureRatePercent: 10,
  profitMarginPercent: 40
};

// ---------------- Sheet Helpers ----------------
function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'OrderID', 'TrackingCode', 'DateSubmitted', 'PartName', 'ClientName', 'Phone',
      'Notes', 'FileType', 'FileLink', 'ExtractedWeight', 'ExtractedHours',
      'AutoPrice', 'FinalPrice', 'Status', 'AdminNotes', 'LastUpdated'
    ]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getFolder_() {
  const folders = DriveApp.getFoldersByName(DRIVE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(DRIVE_FOLDER_NAME);
}

function generateId_(prefix) {
  return prefix + '_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000);
}

function generateTrackingCode_() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // من غير حروف/أرقام ملتبسة
  let code = '';
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

function calcAutoPrice_(weight, hours) {
  const materialCost = weight * PRICING.spoolPricePerGram;
  const powerCost = hours * PRICING.printerPowerKw * PRICING.electricityRatePerKwh;
  const depreciationCost = hours * (PRICING.printerPrice / PRICING.printerLifespanHours);
  const laborCost = hours * PRICING.laborRatePerHour * 0.3;
  const subtotal = materialCost + powerCost + depreciationCost + laborCost;
  const failureCost = subtotal * (PRICING.failureRatePercent / 100);
  const totalCost = subtotal + failureCost;
  const finalPrice = totalCost / (1 - PRICING.profitMarginPercent / 100);
  return Math.ceil(finalPrice / 5) * 5; // تقريب لأقرب 5 جنيه
}

function rowToObject_(headers, row) {
  const obj = {};
  headers.forEach((h, i) => {
    let v = row[i];
    if (v instanceof Date) v = v.toISOString();
    obj[h] = v;
  });
  return obj;
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------- GET: تتبع الطلب / قائمة الأدمن ----------------
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'track') {
      const code = (e.parameter.code || '').toUpperCase().trim();
      const phone = (e.parameter.phone || '').replace(/[^0-9]/g, '');
      const sheet = getSheet_();
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const codeCol = headers.indexOf('TrackingCode');
      const phoneCol = headers.indexOf('Phone');

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        const rowCode = String(row[codeCol]).toUpperCase().trim();
        const rowPhone = String(row[phoneCol]).replace(/[^0-9]/g, '');
        if (rowCode === code && rowPhone.slice(-6) === phone.slice(-6) && phone.length >= 6) {
          return jsonResponse_({ success: true, order: rowToObject_(headers, row) });
        }
      }
      return jsonResponse_({ success: false, error: 'لم يتم العثور على طلب بهذا الكود ورقم الهاتف' });
    }

    if (action === 'list') {
      if (e.parameter.key !== ADMIN_SECRET_KEY) return jsonResponse_({ success: false, error: 'unauthorized' });
      const sheet = getSheet_();
      const data = sheet.getDataRange().getValues();
      const headers = data[0];
      const orders = [];
      for (let i = 1; i < data.length; i++) orders.push(rowToObject_(headers, data[i]));
      orders.reverse();
      return jsonResponse_({ success: true, orders });
    }

    return jsonResponse_({ success: false, error: 'invalid action' });
  } catch (err) {
    return jsonResponse_({ success: false, error: String(err) });
  }
}

// ---------------- POST: تقديم طلب / تحديث الأدمن ----------------
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    if (action === 'submit') return handleSubmit_(payload);

    if (action === 'update') {
      if (payload.key !== ADMIN_SECRET_KEY) return jsonResponse_({ success: false, error: 'unauthorized' });
      return handleUpdate_(payload);
    }

    return jsonResponse_({ success: false, error: 'invalid action' });
  } catch (err) {
    return jsonResponse_({ success: false, error: String(err) });
  }
}

function handleSubmit_(payload) {
  const sheet = getSheet_();
  const orderId = generateId_('order');
  const trackingCode = generateTrackingCode_();
  const weight = Number(payload.weight) || 0;
  const hours = Number(payload.hours) || 0;
  const fileType = payload.fileType || 'none';

  let autoPrice = '';
  let status = 'pending_review';

  if (fileType === 'gcode' && weight > 0 && hours > 0) {
    autoPrice = calcAutoPrice_(weight, hours);
    status = 'priced';
  }

  let fileLink = '';
  if (payload.fileData && payload.fileName) {
    try {
      const sizeMB = (payload.fileData.length * 0.75) / (1024 * 1024);
      if (sizeMB > MAX_FILE_MB) {
        fileLink = `الملف أكبر من ${MAX_FILE_MB} ميجا ولم يتم رفعه`;
      } else {
        const folder = getFolder_();
        const decoded = Utilities.base64Decode(payload.fileData);
        const blob = Utilities.newBlob(decoded, 'application/octet-stream', payload.fileName);
        const file = folder.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        fileLink = file.getUrl();
      }
    } catch (err) {
      fileLink = 'فشل رفع الملف: ' + err.message;
    }
  }

  sheet.appendRow([
    orderId, trackingCode, new Date(), payload.partName || '', payload.clientName || '',
    payload.phone || '', payload.notes || '', fileType, fileLink, weight, hours,
    autoPrice, '', status, '', new Date()
  ]);

  return jsonResponse_({ success: true, orderId, trackingCode, status, autoPrice });
}

function handleUpdate_(payload) {
  const sheet = getSheet_();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const idCol = headers.indexOf('OrderID');
  const priceCol = headers.indexOf('FinalPrice');
  const statusCol = headers.indexOf('Status');
  const notesCol = headers.indexOf('AdminNotes');
  const updatedCol = headers.indexOf('LastUpdated');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(payload.orderId)) {
      const rowNum = i + 1;
      if (payload.finalPrice !== undefined && payload.finalPrice !== '') {
        sheet.getRange(rowNum, priceCol + 1).setValue(Number(payload.finalPrice));
      }
      if (payload.status !== undefined) sheet.getRange(rowNum, statusCol + 1).setValue(payload.status);
      if (payload.adminNotes !== undefined) sheet.getRange(rowNum, notesCol + 1).setValue(payload.adminNotes);
      sheet.getRange(rowNum, updatedCol + 1).setValue(new Date());
      return jsonResponse_({ success: true });
    }
  }
  return jsonResponse_({ success: false, error: 'order not found' });
}

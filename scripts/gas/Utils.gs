/**
 * Coupon Wallet — shared helpers (Apps Script)
 */

var BUNDLED_TZ = 'Asia/Bangkok';

/* ------------------------------------------------------------------ */
/* Errors & responses                                                   */
/* ------------------------------------------------------------------ */

function appError(code, message) {
  var error = new Error(message);
  error.code = code;
  return error;
}

function jsonOut(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}

function respondOk(data, requestId) {
  return jsonOut({ ok: true, data: data, requestId: requestId });
}

function respondError(code, message, requestId) {
  return jsonOut({
    ok: false,
    error: { code: code, message: message },
    requestId: requestId,
  });
}

/* ------------------------------------------------------------------ */
/* Time                                                                 */
/* ------------------------------------------------------------------ */

function nowIso() {
  var now = new Date();
  return (
    Utilities.formatDate(now, BUNDLED_TZ, "yyyy-MM-dd'T'HH:mm:ss.SSS") + '+07:00'
  );
}

function todayBangkok() {
  return Utilities.formatDate(new Date(), BUNDLED_TZ, 'yyyy-MM-dd');
}

function yyMMdd() {
  return Utilities.formatDate(new Date(), BUNDLED_TZ, 'yyMMdd');
}

function toIsoString(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(value, BUNDLED_TZ, "yyyy-MM-dd'T'HH:mm:ss.SSS") + '+07:00';
  }
  if (value === null || value === undefined) return '';
  return String(value);
}

function normalizeCell(value) {
  if (value instanceof Date) return toIsoString(value);
  if (value === null || value === undefined) return '';
  return value;
}

function daysBetween(dateStr, todayStr) {
  var target = Date.parse(String(dateStr) + 'T00:00:00Z');
  var today = Date.parse(String(todayStr) + 'T00:00:00Z');
  if (isNaN(target) || isNaN(today)) return NaN;
  return Math.round((target - today) / 86400000);
}

function nearExpiryDays() {
  var raw = getConfig('nearExpiryDays');
  if (raw === '' || raw === null || raw === undefined) return 3;
  var configured = Number(raw);
  return !isNaN(configured) && configured >= 0 ? configured : 3;
}

/* ------------------------------------------------------------------ */
/* Text                                                                 */
/* ------------------------------------------------------------------ */

function truncate(value, max) {
  var text = String(value || '');
  return text.length <= max ? text : text.slice(0, max - 1) + '…';
}

function normalizeForCompare(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\/+$/, '');
}

function sanitizeForSheet(value) {
  var text = String(value === null || value === undefined ? '' : value);
  text = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}

function unsanitizeText(value) {
  if (typeof value !== 'string') return value;
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

function unsanitizeCoupon(coupon) {
  var copy = {};
  Object.keys(coupon).forEach(function (key) {
    copy[key] = coupon[key];
  });
  ['title', 'merchant', 'discountText', 'description', 'couponCode', 'qrRawValue', 'note'].forEach(
    function (field) {
      copy[field] = unsanitizeText(copy[field]);
    }
  );
  return copy;
}

/* ------------------------------------------------------------------ */
/* IDs                                                                  */
/* ------------------------------------------------------------------ */

function nextId(existingIds, prefix, width) {
  var max = 0;
  for (var i = 0; i < existingIds.length; i += 1) {
    var id = String(existingIds[i] || '');
    if (id.indexOf(prefix) !== 0) continue;
    var number = Number(id.slice(prefix.length));
    if (!isNaN(number) && number > max) max = number;
  }
  var sequence = String(max + 1);
  while (sequence.length < width) sequence = '0' + sequence;
  return prefix + sequence;
}

/* ------------------------------------------------------------------ */
/* Validation                                                           */
/* ------------------------------------------------------------------ */

function normalizeUserId(value) {
  var id = String(value === null || value === undefined ? '' : value).trim().toLowerCase();
  return /^[a-z0-9_-]{2,30}$/.test(id) ? id : '';
}

function requireUserId(value) {
  var id = normalizeUserId(value);
  if (!id) throw appError('VALIDATION_ERROR', 'ต้องระบุ userId (a-z, 0-9, - _ ความยาว 2–30)');
  return id;
}

function canAccessCoupon(coupon, actorId) {
  return String(coupon.userId) === String(actorId);
}

function locateAccessible(all, couponId, actorId) {
  var found = locateCoupon(all, couponId);
  if (!found || !canAccessCoupon(found.coupon, actorId)) {
    throw appError('NOT_FOUND', 'ไม่พบคูปองนี้');
  }
  return found;
}

function requireString(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw appError('VALIDATION_ERROR', 'กรุณาระบุ ' + field);
  }
  return value.trim();
}

function optionalString(value, field, maxLength) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') throw appError('VALIDATION_ERROR', field + ' ต้องเป็นข้อความ');
  var trimmed = value.trim();
  if (trimmed === '') return undefined;
  if (trimmed.length > maxLength) {
    throw appError('VALIDATION_ERROR', field + ' ต้องไม่เกิน ' + maxLength + ' ตัวอักษร');
  }
  return trimmed;
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  var parts = value.split('-');
  var year = Number(parts[0]);
  var month = Number(parts[1]);
  var day = Number(parts[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false;
  var date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/**
 * ตรวจและทำความสะอาดข้อมูลคูปอง
 * partial = true ใช้กับการแก้ไข (ไม่มีฟิลด์ไหนบังคับ)
 */
function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * ตรวจและทำความสะอาดข้อมูลคูปอง
 * partial = true ใช้กับการแก้ไข — ฟิลด์ที่ไม่ได้ส่งมาจะไม่ถูกแตะ
 * ฟิลด์ที่ส่งมาเป็น string ว่าง = ต้องการล้างค่า
 */
function validateCouponInput(input, partial) {
  var source = input || {};
  var out = {};

  function take(field, label, maxLength) {
    if (!hasOwn(source, field)) return;
    var value = source[field];
    if (value === undefined || value === null) {
      if (partial) out[field] = '';
      return;
    }
    if (typeof value !== 'string') {
      throw appError('VALIDATION_ERROR', label + ' ต้องเป็นข้อความ');
    }
    var trimmed = value.trim();
    if (trimmed === '') {
      if (partial) out[field] = '';
      return;
    }
    if (trimmed.length > maxLength) {
      throw appError('VALIDATION_ERROR', label + ' ต้องไม่เกิน ' + maxLength + ' ตัวอักษร');
    }
    out[field] = trimmed;
  }

  take('title', 'ชื่อคูปอง', 100);
  if (!partial && !out.title) throw appError('VALIDATION_ERROR', 'กรุณากรอกชื่อคูปอง');
  take('merchant', 'ชื่อร้าน', 50);
  take('discountText', 'รายละเอียดส่วนลด', 80);
  take('description', 'รายละเอียด', 100);
  take('couponCode', 'รหัสคูปอง', 100);
  take('qrRawValue', 'ข้อมูล QR', 2000);
  take('note', 'บันทึกช่วยจำ', 300);
  take('duplicateOf', 'คูปองที่ซ้ำ', 40);
  take('ocrTextRaw', 'ข้อความ OCR', 5000);

  if (hasOwn(source, 'expiryDate')) {
    var expiryRaw = source.expiryDate;
    if (expiryRaw === undefined || expiryRaw === null || expiryRaw === '') {
      if (partial) out.expiryDate = '';
    } else {
      var expiry = String(expiryRaw);
      if (!isValidDateString(expiry)) {
        throw appError('VALIDATION_ERROR', 'วันหมดอายุต้องเป็นรูปแบบ YYYY-MM-DD');
      }
      out.expiryDate = expiry;
    }
  }

  if (hasOwn(source, 'qrType') && source.qrType !== undefined && source.qrType !== '') {
    var qrType = String(source.qrType);
    if (['url', 'plain_code', 'json', 'unknown'].indexOf(qrType) === -1) {
      throw appError('VALIDATION_ERROR', 'ชนิด QR ไม่ถูกต้อง');
    }
    out.qrType = qrType;
  }

  if (hasOwn(source, 'source') && source.source !== undefined && source.source !== '') {
    var src = String(source.source);
    if (['upload', 'paste', 'share', 'manual'].indexOf(src) === -1) {
      throw appError('VALIDATION_ERROR', 'แหล่งที่มาไม่ถูกต้อง');
    }
    out.source = src;
  }

  if (hasOwn(source, 'ocrConfidence') && source.ocrConfidence !== undefined && source.ocrConfidence !== '') {
    var confidence = Number(source.ocrConfidence);
    if (isNaN(confidence) || confidence < 0 || confidence > 100) {
      throw appError('VALIDATION_ERROR', 'ความมั่นใจ OCR ต้องอยู่ระหว่าง 0-100');
    }
    out.ocrConfidence = confidence;
  }

  return out;
}

/* ------------------------------------------------------------------ */
/* Locking                                                              */
/* ------------------------------------------------------------------ */

function withLock(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) {
    throw appError('RATE_LIMITED', 'ระบบกำลังประมวลผลคำขออื่น กรุณาลองใหม่');
  }
  try {
    ensureAllSheets();
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------------------------------------------------ */
/* Status, filtering, sorting                                           */
/* ------------------------------------------------------------------ */

function matchesStatus(coupon, status, today) {
  if (!status || status === 'all') return true;
  if (status === 'used') return coupon.status === 'used';
  if (coupon.status === 'used') return false;

  var days = coupon.expiryDate ? daysBetween(coupon.expiryDate, today) : NaN;
  if (status === 'unused') return !coupon.expiryDate || isNaN(days) || days >= 0;
  if (status === 'expired') return Boolean(coupon.expiryDate) && days < 0;
  if (status === 'expiring') {
    return Boolean(coupon.expiryDate) && days >= 0 && days <= nearExpiryDays();
  }
  return true;
}

function rankOf(coupon, today) {
  if (coupon.status === 'used') return 3;
  if (!coupon.expiryDate) return 1;
  var days = daysBetween(coupon.expiryDate, today);
  if (days < 0) return 2;
  return days <= nearExpiryDays() ? 0 : 1;
}

function sortCoupons(coupons, today) {
  return coupons.slice().sort(function (a, b) {
    var rankDiff = rankOf(a, today) - rankOf(b, today);
    if (rankDiff !== 0) return rankDiff;

    if (a.status === 'used' && b.status === 'used') {
      return String(b.usedAt || b.updatedAt).localeCompare(String(a.usedAt || a.updatedAt));
    }
    if (a.expiryDate && b.expiryDate) {
      var diff = String(a.expiryDate).localeCompare(String(b.expiryDate));
      if (diff !== 0) return diff;
    } else if (a.expiryDate !== b.expiryDate) {
      return a.expiryDate ? -1 : 1;
    }
    return String(b.createdAt).localeCompare(String(a.createdAt));
  });
}

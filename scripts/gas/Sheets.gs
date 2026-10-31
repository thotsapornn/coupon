/**
 * Coupon Wallet — Google Sheets layer
 * 1 แถว = 1 คูปอง, header อยู่แถวที่ 1, ข้อมูลเริ่มแถวที่ 2
 */

var COUPON_HEADERS = [
  'couponId',
  'title',
  'merchant',
  'discountText',
  'description',
  'couponCode',
  'qrRawValue',
  'qrType',
  'expiryDate',
  'status',
  'imageFileId',
  'imageUrl',
  'imageStatus',
  'ocrTextRaw',
  'ocrConfidence',
  'note',
  'source',
  'duplicateOf',
  'createdAt',
  'updatedAt',
  'usedAt',
  'deletedAt',
  'notifiedAt',
  'userId',
];

var HISTORY_HEADERS = ['logId', 'couponId', 'action', 'fromStatus', 'toStatus', 'at', 'actor', 'metadata', 'requestId'];
var CONFIG_HEADERS = ['key', 'value'];
var ERROR_HEADERS = ['timestamp', 'requestId', 'action', 'code', 'message', 'stack', 'payloadPreview'];

/* ------------------------------------------------------------------ */
/* Sheets bootstrap                                                     */
/* ------------------------------------------------------------------ */

function getSpreadsheet() {
  var properties = PropertiesService.getScriptProperties();
  var configuredId = properties.getProperty('spreadsheetId');
  if (configuredId) {
    try {
      return SpreadsheetApp.openById(configuredId);
    } catch (error) {
      // ถ้า id ไม่ถูกต้อง ให้ fallback ไปใช้ bound spreadsheet
    }
  }
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (!active) {
    throw appError(
      'INTERNAL_ERROR',
      'ไม่พบ Google Sheets กรุณาสร้างสคริปต์จากเมนู Extensions > Apps Script ของ spreadsheet'
    );
  }
  properties.setProperty('spreadsheetId', active.getId());
  return active;
}

function ensureSheet(name, headers) {
  var spreadsheet = getSpreadsheet();
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.getRange(1, 1, sheet.getMaxRows(), headers.length).setNumberFormat('@');
  } else {
    // ชีตรุ่นก่อนอาจขาดคอลัมน์ใหม่ (เช่น userId) — เติมหัวตารางที่ว่าง
    var current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    for (var i = 0; i < headers.length; i += 1) {
      if (String(current[i] || '').trim() === '') {
        sheet.getRange(1, i + 1).setValue(headers[i]);
      }
    }
  }
  return sheet;
}

function ensureAllSheets() {
  ensureSheet('Coupons', COUPON_HEADERS);
  ensureSheet('UsageHistory', HISTORY_HEADERS);
  ensureSheet('Config', CONFIG_HEADERS);
  ensureSheet('ErrorLog', ERROR_HEADERS);
  ensureConfigDefaults();
}

function ensureConfigDefaults() {
  var defaults = {
    schemaVersion: '1',
    defaultTimezone: TZ,
    nearExpiryDays: '3',
  };
  Object.keys(defaults).forEach(function (key) {
    if (!getConfig(key)) setConfig(key, defaults[key]);
  });
}

/* ------------------------------------------------------------------ */
/* Config                                                               */
/* ------------------------------------------------------------------ */

function getConfig(key) {
  var sheet = getSpreadsheet().getSheetByName('Config');
  if (!sheet || sheet.getLastRow() < 2) return '';
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < values.length; i += 1) {
    if (String(values[i][0]) === String(key)) return String(values[i][1]);
  }
  return '';
}

function setConfig(key, value) {
  var spreadsheet = getSpreadsheet();
  var sheet = spreadsheet.getSheetByName('Config');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('Config');
    sheet.getRange(1, 1, 1, 2).setValues([CONFIG_HEADERS]);
    sheet.setFrozenRows(1);
  }
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var values = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
    for (var i = 0; i < values.length; i += 1) {
      if (String(values[i][0]) === String(key)) {
        sheet.getRange(i + 2, 2).setValue(value);
        return;
      }
    }
  }
  sheet.appendRow([key, value]);
}

/* ------------------------------------------------------------------ */
/* Coupons                                                              */
/* ------------------------------------------------------------------ */

function readAllCoupons() {
  var sheet = ensureSheet('Coupons', COUPON_HEADERS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, COUPON_HEADERS.length).getValues();
  return values
    .filter(function (row) {
      return String(row[0] || '').trim() !== '';
    })
    .map(function (row) {
      return couponFromRow(row);
    });
}

function couponFromRow(row) {
  var coupon = {};
  for (var i = 0; i < COUPON_HEADERS.length; i += 1) {
    var value = normalizeCell(row[i]);
    if (COUPON_HEADERS[i] === 'expiryDate' && value) {
      value = String(value).slice(0, 10);
    }
    if (COUPON_HEADERS[i] === 'ocrConfidence' && value !== '') {
      var confidence = Number(value);
      value = isNaN(confidence) ? '' : confidence;
    }
    if (COUPON_HEADERS[i] === 'userId' && !value) {
      value = 'legacy';
    }
    coupon[COUPON_HEADERS[i]] = value;
  }
  return coupon;
}

function couponToRow(coupon) {
  return COUPON_HEADERS.map(function (header) {
    var value = coupon[header];
    return value === undefined || value === null ? '' : value;
  });
}

function appendCouponRow(coupon) {
  var sheet = ensureSheet('Coupons', COUPON_HEADERS);
  sheet.appendRow(couponToRow(coupon));
}

function writeCouponRow(rowIndex, coupon) {
  var sheet = ensureSheet('Coupons', COUPON_HEADERS);
  sheet.getRange(rowIndex, 1, 1, COUPON_HEADERS.length).setValues([couponToRow(coupon)]);
}

function locateCoupon(all, couponId) {
  for (var i = 0; i < all.length; i += 1) {
    if (all[i].couponId === couponId && !all[i].deletedAt) {
      return { coupon: all[i], rowIndex: i + 2 };
    }
  }
  return null;
}

function requireCoupon(couponId, actorId) {
  var found = locateCoupon(readAllCoupons(), requireString(couponId, 'couponId'));
  if (!found || !canAccessCoupon(found.coupon, actorId)) {
    throw appError('NOT_FOUND', 'ไม่พบคูปองนี้');
  }
  return found.coupon;
}

function findDuplicate(all, input, userId) {
  var qr = normalizeForCompare(input.qrRawValue || '');
  var code = normalizeForCompare(input.couponCode || '');
  if (!qr && !code) return null;

  for (var i = 0; i < all.length; i += 1) {
    var coupon = all[i];
    if (coupon.deletedAt) continue;
    if (String(coupon.userId) !== String(userId)) continue;
    if (qr && normalizeForCompare(coupon.qrRawValue) === qr) return coupon;
    if (code && normalizeForCompare(coupon.couponCode) === code) return coupon;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Usage history                                                        */
/* ------------------------------------------------------------------ */

function appendLog(entry) {
  var sheet = ensureSheet('UsageHistory', HISTORY_HEADERS);
  var couponId = entry.couponId;
  var logId = nextId(
    readAllLogIds(),
    'LOG-' + yyMMdd() + '-',
    4
  );

  var metadata = '';
  if (entry.metadata) {
    try {
      metadata = JSON.stringify(entry.metadata);
    } catch (error) {
      metadata = '';
    }
  }

  sheet.appendRow([
    logId,
    couponId,
    entry.action,
    entry.fromStatus || '',
    entry.toStatus || '',
    nowIso(),
    'owner',
    metadata,
    entry.requestId || '',
  ]);
}

function readAllLogIds() {
  var sheet = ensureSheet('UsageHistory', HISTORY_HEADERS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  return sheet
    .getRange(2, 1, lastRow - 1, 1)
    .getValues()
    .map(function (row) {
      return String(row[0]);
    });
}

function listLogs(couponId) {
  var sheet = ensureSheet('UsageHistory', HISTORY_HEADERS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var values = sheet.getRange(2, 1, lastRow - 1, HISTORY_HEADERS.length).getValues();
  return values
    .filter(function (row) {
      return String(row[1]) === String(couponId);
    })
    .map(function (row) {
      var metadata = null;
      if (row[7]) {
        try {
          metadata = JSON.parse(String(row[7]));
        } catch (error) {
          metadata = { raw: String(row[7]) };
        }
      }
      return {
        logId: String(row[0]),
        couponId: String(row[1]),
        action: String(row[2]),
        fromStatus: row[3] ? String(row[3]) : undefined,
        toStatus: row[4] ? String(row[4]) : undefined,
        at: toIsoString(row[5]),
        actor: String(row[6] || 'owner'),
        metadata: metadata || undefined,
        requestId: row[8] ? String(row[8]) : undefined,
      };
    })
    .sort(function (a, b) {
      var byTime = String(b.at).localeCompare(String(a.at));
      if (byTime !== 0) return byTime;
      return String(b.logId).localeCompare(String(a.logId));
    });
}

/* ------------------------------------------------------------------ */
/* Errors                                                               */
/* ------------------------------------------------------------------ */

function logError(requestId, action, error) {
  var sheet = ensureSheet('ErrorLog', ERROR_HEADERS);
  var preview = '';
  try {
    preview = truncate(String(error && error.message ? error.message : error), 500);
  } catch (ignored) {
    preview = '';
  }

  sheet.appendRow([
    nowIso(),
    requestId || '',
    action || '',
    (error && error.code) || 'INTERNAL_ERROR',
    (error && error.message) || String(error),
    truncate(String((error && error.stack) || ''), 2000),
    preview,
  ]);
}

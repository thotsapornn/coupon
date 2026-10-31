/**
 * Coupon Wallet — Google Apps Script Web App
 *
 * ทุก request เป็น POST JSON:
 *   { action, payload, token }
 *
 * หมายเหตุ: Apps Script doPost ไม่สามารถอ่าน custom header ได้
 * จึงส่ง shared secret มาใน body (และรับทาง query string เผื่อ debug)
 */

var TZ = 'Asia/Bangkok';
var TOKEN_PROPERTY = 'SHARED_SECRET';
var MAX_IMAGE_BYTES = 2 * 1024 * 1024;

function doGet() {
  return jsonOut({
    ok: true,
    data: { service: 'coupon-wallet', version: '1.0.0', time: nowIso() },
  });
}

function doPost(e) {
  var requestId = 'req_' + Utilities.getUuid().slice(0, 8);
  var action = '';

  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var body = JSON.parse(raw);
    action = String(body.action || '');
    var payload = body.payload || {};

    var expected = PropertiesService.getScriptProperties().getProperty(TOKEN_PROPERTY);
    var token = String(body.token || (e && e.parameter ? e.parameter.token : '') || '');
    if (!expected || token !== expected) {
      return respondError('UNAUTHORIZED', 'token ไม่ถูกต้อง', requestId);
    }

    var actions = {
      ping: handlePing,
      createCoupon: handleCreateCoupon,
      listCoupons: handleListCoupons,
      getCoupon: handleGetCoupon,
      getSharedCoupon: handleGetSharedCoupon,
      updateCoupon: handleUpdateCoupon,
      markUsed: handleMarkUsed,
      undoUsed: handleUndoUsed,
      deleteCoupon: handleDeleteCoupon,
      purgeCoupon: handlePurgeCoupon,
      listHistory: handleListHistory,
      getStats: handleGetStats,
    };

    var handler = actions[action];
    if (!handler) {
      return respondError('VALIDATION_ERROR', 'ไม่รู้จัก action: ' + action, requestId);
    }

    ensureAllSheets();
    var data = handler(payload, requestId);
    return respondOk(data, requestId);
  } catch (error) {
    try {
      logError(requestId, action, error);
    } catch (ignored) {
      // ไม่ให้ logging ทำให้ request ล้มเหลวซ้ำ
    }
    return respondError(error.code || 'INTERNAL_ERROR', error.message || 'เกิดข้อผิดพลาด', requestId);
  }
}

/* ------------------------------------------------------------------ */
/* Handlers                                                            */
/* ------------------------------------------------------------------ */

function handlePing() {
  return { status: 'ok', schemaVersion: 1, serverTime: nowIso() };
}

function handleCreateCoupon(payload) {
  var userId = requireUserId(payload.userId);
  return withLock(function () {
    var input = validateCouponInput(payload, false);
    var all = readAllCoupons();
    var couponId = nextId(
      all.map(function (coupon) {
        return coupon.couponId;
      }),
      'CPN-' + yyMMdd() + '-',
      3
    );
    var timestamp = nowIso();
    var duplicate = findDuplicate(all, input, userId);
    var image = null;

    var coupon = {
      couponId: couponId,
      userId: userId,
      title: sanitizeForSheet(input.title),
      merchant: sanitizeForSheet(input.merchant || ''),
      discountText: sanitizeForSheet(input.discountText || ''),
      description: sanitizeForSheet(input.description || ''),
      couponCode: sanitizeForSheet(input.couponCode || ''),
      qrRawValue: sanitizeForSheet(input.qrRawValue || ''),
      qrType: input.qrType || 'unknown',
      expiryDate: input.expiryDate || '',
      status: 'unused',
      imageFileId: '',
      imageUrl: '',
      imageStatus: 'missing',
      ocrTextRaw: truncate(sanitizeForSheet(input.ocrTextRaw || ''), 5000),
      ocrConfidence: typeof input.ocrConfidence === 'number' ? input.ocrConfidence : '',
      note: sanitizeForSheet(input.note || ''),
      source: input.source || 'upload',
      duplicateOf: input.duplicateOf || (duplicate ? duplicate.couponId : ''),
      createdAt: timestamp,
      updatedAt: timestamp,
      usedAt: '',
      deletedAt: '',
      notifiedAt: '',
    };

    if (payload.imageBase64) {
      image = uploadImage(couponId, payload.imageBase64, payload.imageMimeType);
      coupon.imageFileId = image.fileId;
      coupon.imageUrl = image.url;
      coupon.imageStatus = 'ok';
    }

    try {
      appendCouponRow(coupon);
    } catch (writeError) {
      if (image) trashFile(image.fileId);
      throw writeError;
    }

    appendLog({
      couponId: couponId,
      action: 'created',
      fromStatus: '',
      toStatus: 'unused',
      metadata: { source: coupon.source, userId: userId, duplicateOf: coupon.duplicateOf },
    });

    return { coupon: unsanitizeCoupon(coupon) };
  });
}

function handleListCoupons(payload) {
  var userId = requireUserId(payload.userId);
  var all = readAllCoupons();
  var status = payload.status || 'all';
  var query = String(payload.q || '').trim().toLowerCase();
  var limit = Math.min(Math.max(Number(payload.limit) || 500, 1), 1000);
  var today = todayBangkok();

  var filtered = all.filter(function (coupon) {
    if (coupon.deletedAt) return false;
    if (String(coupon.userId) !== String(userId)) return false;
    return matchesStatus(coupon, status, today);
  });

  if (query) {
    filtered = filtered.filter(function (coupon) {
      var haystack = [
        coupon.title,
        coupon.merchant,
        coupon.couponCode,
        coupon.discountText,
        coupon.description,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.indexOf(query) !== -1;
    });
  }

  var sorted = sortCoupons(filtered, today).slice(0, limit);
  return {
    items: sorted.map(unsanitizeCoupon),
    total: filtered.length,
  };
}

function handleGetSharedCoupon(payload) {
  var couponId = requireString(payload.couponId, 'couponId');
  var found = locateCoupon(readAllCoupons(), couponId);
  if (!found) throw appError('NOT_FOUND', 'ไม่พบคูปองนี้');
  return { coupon: unsanitizeCoupon(found.coupon) };
}

function handleGetCoupon(payload) {
  var userId = requireUserId(payload.userId);
  var coupon = requireCoupon(payload.couponId, userId);
  return { coupon: unsanitizeCoupon(coupon) };
}

function handleUpdateCoupon(payload) {
  return withLock(function () {
    var userId = requireUserId(payload.userId);
    var couponId = requireString(payload.couponId, 'couponId');
    var patch = validateCouponInput(payload.patch || {}, true);
    var all = readAllCoupons();
    var found = locateAccessible(all, couponId, userId);
    var coupon = found.coupon;
    var changed = [];
    var before = {};
    var after = {};

    var editable = [
      'title',
      'merchant',
      'discountText',
      'description',
      'couponCode',
      'qrRawValue',
      'qrType',
      'expiryDate',
      'note',
      'duplicateOf',
    ];

    editable.forEach(function (field) {
      if (!Object.prototype.hasOwnProperty.call(patch, field)) return;
      var next = patch[field];
      if (typeof next === 'string') next = sanitizeForSheet(next);
      var current = coupon[field] || '';
      if (String(current) === String(next)) return;
      before[field] = current;
      after[field] = next;
      coupon[field] = next;
      changed.push(field);
    });

    if (changed.length === 0) {
      return { coupon: unsanitizeCoupon(coupon) };
    }

    coupon.updatedAt = nowIso();
    writeCouponRow(found.rowIndex, coupon);

    appendLog({
      couponId: couponId,
      action: 'updated',
      fromStatus: coupon.status,
      toStatus: coupon.status,
      metadata: { changed: changed, from: before, to: after },
    });

    return { coupon: unsanitizeCoupon(coupon) };
  });
}

function handleMarkUsed(payload) {
  return withLock(function () {
    var userId = requireUserId(payload.userId);
    var couponId = requireString(payload.couponId, 'couponId');
    var all = readAllCoupons();
    var found = locateAccessible(all, couponId, userId);
    if (found.coupon.status === 'used') {
      throw appError('INVALID_STATE', 'คูปองนี้ถูกทำเครื่องหมายว่าใช้แล้ว');
    }

    var at = nowIso();
    found.coupon.status = 'used';
    found.coupon.usedAt = at;
    found.coupon.updatedAt = at;
    writeCouponRow(found.rowIndex, found.coupon);

    appendLog({
      couponId: couponId,
      action: 'marked_used',
      fromStatus: 'unused',
      toStatus: 'used',
      metadata: { usedAt: at },
    });

    return { coupon: unsanitizeCoupon(found.coupon) };
  });
}

function handleUndoUsed(payload) {
  return withLock(function () {
    var userId = requireUserId(payload.userId);
    var couponId = requireString(payload.couponId, 'couponId');
    var all = readAllCoupons();
    var found = locateAccessible(all, couponId, userId);
    if (found.coupon.status !== 'used') {
      throw appError('INVALID_STATE', 'คูปองนี้ยังไม่ได้ถูกใช้');
    }

    var previousUsedAt = found.coupon.usedAt;
    found.coupon.status = 'unused';
    found.coupon.usedAt = '';
    found.coupon.updatedAt = nowIso();
    writeCouponRow(found.rowIndex, found.coupon);

    appendLog({
      couponId: couponId,
      action: 'undo_used',
      fromStatus: 'used',
      toStatus: 'unused',
      metadata: { previousUsedAt: previousUsedAt },
    });

    return { coupon: unsanitizeCoupon(found.coupon) };
  });
}

function handleDeleteCoupon(payload) {
  return withLock(function () {
    var userId = requireUserId(payload.userId);
    var couponId = requireString(payload.couponId, 'couponId');
    var all = readAllCoupons();
    var found = locateAccessible(all, couponId, userId);

    var at = nowIso();
    found.coupon.deletedAt = at;
    found.coupon.updatedAt = at;
    writeCouponRow(found.rowIndex, found.coupon);

    appendLog({
      couponId: couponId,
      action: 'deleted',
      fromStatus: found.coupon.status,
      toStatus: found.coupon.status,
      metadata: {},
    });

    return { coupon: unsanitizeCoupon(found.coupon) };
  });
}

/**
 * ลบถาวร (admin): ลบแถวในชีต + ทิ้งไฟล์รูปใน Drive — กู้คืนไม่ได้
 * ต่างจาก deleteCoupon ที่เป็น soft delete และไม่แตะไฟล์
 */
function handlePurgeCoupon(payload) {
  return withLock(function () {
    var userId = requireUserId(payload.userId);
    var couponId = requireString(payload.couponId, 'couponId');
    var all = readAllCoupons();
    var found = null;

    // ค้นหาทุกสถานะ รวมถึงใบที่ soft delete ไปแล้ว
    for (var i = 0; i < all.length; i += 1) {
      if (all[i].couponId === couponId && String(all[i].userId) === String(userId)) {
        found = { coupon: all[i], rowIndex: i + 2 };
        break;
      }
    }
    if (!found) throw appError('NOT_FOUND', 'ไม่พบคูปองนี้');

    deleteCouponRow(found.rowIndex);

    if (found.coupon.imageFileId) trashFile(found.coupon.imageFileId);

    try {
      appendLog({
        couponId: couponId,
        action: 'admin_deleted',
        fromStatus: found.coupon.status,
        toStatus: '',
        metadata: {
          userId: userId,
          imageFileId: found.coupon.imageFileId || '',
          purge: true,
        },
      });
    } catch (logError) {
      // แถวถูกลบไปแล้ว — ไม่ให้การเขียน log ทำให้ request ล้มเหลว
    }

    return { couponId: couponId, deleted: true };
  });
}

function handleListHistory(payload) {
  var userId = requireUserId(payload.userId);
  var couponId = requireString(payload.couponId, 'couponId');
  var found = locateCoupon(readAllCoupons(), couponId);
  if (!found || !canAccessCoupon(found.coupon, userId)) {
    throw appError('NOT_FOUND', 'ไม่พบคูปองนี้');
  }
  return { logs: listLogs(couponId) };
}

function handleGetStats(payload) {
  var userId = requireUserId(payload.userId);
  var all = readAllCoupons();
  var today = todayBangkok();
  var active = all.filter(function (coupon) {
    if (coupon.deletedAt) return false;
    if (String(coupon.userId) !== String(userId)) return false;
    return true;
  });

  var used = 0;
  var unused = 0;
  var expiring = 0;
  var expired = 0;

  active.forEach(function (coupon) {
    if (coupon.status === 'used') used += 1;
    if (matchesStatus(coupon, 'unused', today)) unused += 1;
    if (matchesStatus(coupon, 'expiring', today)) expiring += 1;
    if (matchesStatus(coupon, 'expired', today)) expired += 1;
  });

  return {
    total: active.length,
    unused: unused,
    used: used,
    expiring: expiring,
    expired: expired,
  };
}

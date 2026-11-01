/**
 * Coupon Wallet — Google Drive layer
 * โครงสร้าง: CouponWallet/YYYY/MM/{couponId}.{ext}
 */

var MIME_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function getRootFolder() {
  var folderId = getConfig('driveRootFolderId');
  if (folderId) {
    try {
      return DriveApp.getFolderById(folderId);
    } catch (error) {
      // folder ถูกลบ — สร้างใหม่
    }
  }
  var folder = DriveApp.createFolder('CouponWallet');
  setConfig('driveRootFolderId', folder.getId());
  return folder;
}

function getOrCreateSubfolder(parent, name) {
  var folders = parent.getFoldersByName(name);
  if (folders.hasNext()) return folders.next();
  return parent.createFolder(name);
}

function getMonthFolder() {
  var root = getRootFolder();
  var yearFolder = getOrCreateSubfolder(root, Utilities.formatDate(new Date(), TZ, 'yyyy'));
  return getOrCreateSubfolder(yearFolder, Utilities.formatDate(new Date(), TZ, 'MM'));
}

/**
 * อัปโหลดรูปเข้า Drive และคืน fileId + URL สำหรับแสดงผล
 * หมายเหตุ: ตั้งสิทธิ์เป็น anyone-with-link เพื่อให้ <img> ในเว็บเปิดได้
 */
function uploadImage(couponId, base64, mimeType) {
  var ext = MIME_EXTENSIONS[mimeType];
  if (!ext) throw appError('VALIDATION_ERROR', 'ชนิดรูปภาพไม่รองรับ');
  if (!base64) throw appError('VALIDATION_ERROR', 'ไม่พบข้อมูลรูปภาพ');

  var bytes;
  try {
    bytes = Utilities.base64Decode(base64);
  } catch (error) {
    throw appError('VALIDATION_ERROR', 'ข้อมูลรูปภาพไม่ถูกต้อง');
  }

  if (bytes.length === 0) throw appError('VALIDATION_ERROR', 'รูปภาพว่างเปล่า');
  if (bytes.length > MAX_IMAGE_BYTES) throw appError('VALIDATION_ERROR', 'รูปภาพมีขนาดเกิน 2 MB');

  var blob = Utilities.newBlob(bytes, mimeType, couponId + '.' + ext);
  var folder = getMonthFolder();
  var file = folder.createFile(blob);

  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (error) {
    // องค์กรอาจไม่อนุญาตให้แชร์ลิงก์ — เก็บไฟล์ไว้และให้เจ้าของเปิดดูเอง
  }

  return {
    fileId: file.getId(),
    // ใช้ thumbnail เพราะ /view เป็นหน้า HTML ที่ <img> แสดงไม่ได้
    url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w1200',
  };
}

/* ------------------------------------------------------------------ */
/* Share links (JSON เก็บใน Drive, ลิงก์สั้นใช้ key)                    */
/* ------------------------------------------------------------------ */

var SHARE_FOLDER_NAME = 'Shares';
var SHARE_KEY_LENGTH = 12;
var SHARE_KEY_PATTERN = /^[a-f0-9]{12}$/;
var SHARE_FILE_SUFFIX = '.json';
var MAX_SHARE_CHARS = 120000;

function getShareFolder() {
  return getOrCreateSubfolder(getRootFolder(), SHARE_FOLDER_NAME);
}

/** สุ่ม key จาก UUID และกันชนกับไฟล์ที่มีอยู่ */
function generateShareKey(folder) {
  for (var attempt = 0; attempt < 20; attempt += 1) {
    var source = String(Utilities.getUuid()).replace(/-/g, '').toLowerCase();
    var key = source.slice(0, SHARE_KEY_LENGTH);
    if (!SHARE_KEY_PATTERN.test(key)) continue;
    if (!folder.getFilesByName(key + SHARE_FILE_SUFFIX).hasNext()) return key;
  }
  throw appError('INTERNAL_ERROR', 'สร้างรหัสลิงก์ไม่สำเร็จ กรุณาลองใหม่');
}

function saveShareFile(kind, data) {
  if (kind !== 'full' && kind !== 'summary') {
    throw appError('VALIDATION_ERROR', 'ชนิดลิงก์แชร์ไม่ถูกต้อง');
  }
  var text = typeof data === 'string' ? data : '';
  if (!text) throw appError('VALIDATION_ERROR', 'ไม่พบข้อมูลที่ต้องการแชร์');
  if (text.length > MAX_SHARE_CHARS) {
    throw appError('VALIDATION_ERROR', 'ข้อมูลแชร์ยาวเกินไป (เกิน ' + MAX_SHARE_CHARS + ' ตัวอักษร)');
  }
  if (!/^[A-Za-z0-9+/_=-]+$/.test(text)) {
    throw appError('VALIDATION_ERROR', 'ข้อมูลแชร์ไม่ถูกต้อง');
  }

  var folder = getShareFolder();
  var key = generateShareKey(folder);
  var record = { kind: kind, data: text, createdAt: nowIso() };
  var blob = Utilities.newBlob(
    JSON.stringify(record),
    'application/json',
    key + SHARE_FILE_SUFFIX
  );
  folder.createFile(blob);

  return { key: key, kind: kind, createdAt: record.createdAt };
}

function readShareFile(key) {
  var normalized = typeof key === 'string' ? key.trim().toLowerCase() : '';
  if (!SHARE_KEY_PATTERN.test(normalized)) {
    throw appError('VALIDATION_ERROR', 'รหัสลิงก์ไม่ถูกต้อง');
  }

  var files = getShareFolder().getFilesByName(normalized + SHARE_FILE_SUFFIX);
  if (!files.hasNext()) throw appError('NOT_FOUND', 'ไม่พบลิงก์แชร์นี้');

  var text = files.next().getBlob().getDataAsString('UTF-8');
  var record = JSON.parse(text);
  return {
    key: normalized,
    kind: record.kind,
    data: record.data,
    createdAt: record.createdAt,
  };
}

function trashFile(fileId) {
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (error) {
    // ถ้าลบไม่ได้ ก็ปล่อยไว้เพื่อไม่ให้ transaction ล้มเหลวซ้ำ
  }
}

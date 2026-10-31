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
    url: 'https://drive.google.com/file/d/' + file.getId() + '/view',
  };
}

function trashFile(fileId) {
  try {
    DriveApp.getFileById(fileId).setTrashed(true);
  } catch (error) {
    // ถ้าลบไม่ได้ ก็ปล่อยไว้เพื่อไม่ให้ transaction ล้มเหลวซ้ำ
  }
}

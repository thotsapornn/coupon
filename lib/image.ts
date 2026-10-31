'use client';

const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 1600;
const STORAGE_EDGE = 1280;
const TARGET_BYTES = 600 * 1024;
const MIN_QUALITY = 0.6;

export type StoredImageMime = 'image/jpeg' | 'image/webp';

export interface PreparedImage {
  dataUrl: string;
  base64: string;
  mimeType: StoredImageMime;
  width: number;
  height: number;
  canvas: HTMLCanvasElement;
}

function isSupported(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(heic|heif)$/i.test(file.name);
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file);
    } catch {
      /* Safari/Chrome อาจ decode ไม่ได้ — ลองวิธีถัดไป */
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

function approximateBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return dataUrl.length;
  return Math.ceil(((dataUrl.length - comma - 1) * 3) / 4);
}

function downscale(canvas: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const next = document.createElement('canvas');
  next.width = Math.max(1, Math.round(canvas.width * factor));
  next.height = Math.max(1, Math.round(canvas.height * factor));
  const context = next.getContext('2d');
  if (!context) return canvas;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, next.width, next.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(canvas, 0, 0, next.width, next.height);
  return next;
}

function encodeStoredImage(source: HTMLCanvasElement): { dataUrl: string; mimeType: StoredImageMime } {
  let working = source;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const quality = Math.max(MIN_QUALITY, 0.82 - attempt * 0.1);
    const webp = working.toDataURL('image/webp', quality);
    if (webp.startsWith('data:image/webp')) {
      if (approximateBytes(webp) <= TARGET_BYTES) {
        return { dataUrl: webp, mimeType: 'image/webp' };
      }
    } else {
      const jpeg = working.toDataURL('image/jpeg', Math.max(MIN_QUALITY, 0.85 - attempt * 0.1));
      if (approximateBytes(jpeg) <= TARGET_BYTES) {
        return { dataUrl: jpeg, mimeType: 'image/jpeg' };
      }
    }

    if (attempt < 2) working = downscale(working, 0.84);
  }

  // ถ้ายังใหญ่กว่าเป้า ให้ใช้ผลลัพธ์คุณภาพต่ำสุดที่ได้
  const webp = working.toDataURL('image/webp', MIN_QUALITY);
  if (webp.startsWith('data:image/webp')) {
    return { dataUrl: webp, mimeType: 'image/webp' };
  }
  return { dataUrl: working.toDataURL('image/jpeg', MIN_QUALITY), mimeType: 'image/jpeg' };
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!isSupported(file)) {
    throw new Error('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WEBP (หรือ HEIC จาก iPhone)');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('รูปมีขนาดเกิน 10 MB กรุณา crop หรือย่อรูปก่อนอัปโหลด');
  }

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    throw new Error('เปิดรูปนี้ไม่ได้ หากเป็น HEIC จาก iPhone กรุณาตั้งค่า “โอนเป็นรูปแบบที่เข้ากันได้” หรือแคปเจอร์ใหม่เป็น JPG');
  }

  const sourceWidth = 'width' in source ? source.width : 0;
  const sourceHeight = 'height' in source ? source.height : 0;
  if (!sourceWidth || !sourceHeight) {
    throw new Error('รูปไม่มีขนาดที่อ่านได้');
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('เบราว์เซอร์ไม่รองรับการประมวลผลรูปภาพ');

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, width, height);

  if ('close' in source && typeof source.close === 'function') source.close();

  // รูปที่จัดเก็บเล็กกว่าที่ใช้ประมวลผล (OCR/QR ยังใช้ canvas 1600px)
  const storageScale = Math.min(1, STORAGE_EDGE / Math.max(width, height));
  let storageCanvas = canvas;
  if (storageScale < 1) {
    storageCanvas = document.createElement('canvas');
    storageCanvas.width = Math.max(1, Math.round(width * storageScale));
    storageCanvas.height = Math.max(1, Math.round(height * storageScale));
    const storageContext = storageCanvas.getContext('2d');
    if (!storageContext) throw new Error('เบราว์เซอร์ไม่รองรับการประมวลผลรูปภาพ');
    storageContext.fillStyle = '#ffffff';
    storageContext.fillRect(0, 0, storageCanvas.width, storageCanvas.height);
    storageContext.imageSmoothingEnabled = true;
    storageContext.imageSmoothingQuality = 'high';
    storageContext.drawImage(canvas, 0, 0, storageCanvas.width, storageCanvas.height);
  }

  const encoded = encodeStoredImage(storageCanvas);
  const base64 = encoded.dataUrl.split(',')[1] ?? '';
  if (!base64) throw new Error('แปลงรูปเป็นข้อมูลไม่สำเร็จ');

  return {
    dataUrl: encoded.dataUrl,
    base64,
    mimeType: encoded.mimeType,
    width: canvas.width,
    height: canvas.height,
    canvas,
  };
}

/**
 * ครอปรูปที่เตรียมไว้แล้ว (พิกัดเป็น pixel ของ image.canvas)
 * คืน PreparedImage ใหม่ที่เข้ารหัสตามขนาดเป้าหมายเดิม
 */
export function cropPreparedImage(
  source: PreparedImage,
  rect: { x: number; y: number; width: number; height: number },
): PreparedImage {
  const canvas = document.createElement('canvas');
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');
  if (!context) throw new Error('เบราว์เซอร์ไม่รองรับการประมวลผลรูปภาพ');

  context.drawImage(
    source.canvas,
    Math.max(0, Math.round(rect.x)),
    Math.max(0, Math.round(rect.y)),
    width,
    height,
    0,
    0,
    width,
    height,
  );

  const encoded = encodeStoredImage(canvas);
  const base64 = encoded.dataUrl.split(',')[1] ?? '';
  if (!base64) throw new Error('แปลงรูปเป็นข้อมูลไม่สำเร็จ');

  return {
    dataUrl: encoded.dataUrl,
    base64,
    mimeType: encoded.mimeType,
    width,
    height,
    canvas,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

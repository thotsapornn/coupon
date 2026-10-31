import jsQR from 'jsqr';
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';
import { detectQrType } from './parser';
import type { QrScanResult } from './types';

function rotate(canvas: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const rotated = document.createElement('canvas');
  const swap = degrees % 180 !== 0;
  rotated.width = swap ? canvas.height : canvas.width;
  rotated.height = swap ? canvas.width : canvas.height;
  const context = rotated.getContext('2d');
  if (!context) return canvas;
  context.translate(rotated.width / 2, rotated.height / 2);
  context.rotate((degrees * Math.PI) / 180);
  context.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
  return rotated;
}

function readPixels(canvas: HTMLCanvasElement): ImageData | null {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  try {
    return context.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }
}

/**
 * อ่าน QR/บาร์โค้ดจาก canvas:
 * 1) jsQR (เร็วและแม่นกับ QR ตรง ๆ)
 * 2) ZXing สำหรับ QR ที่เบลอ/เอียง/มีโลโก้ และบาร์โค้ดอื่น
 */
export async function scanQr(canvas: HTMLCanvasElement): Promise<QrScanResult | null> {
  const started = performance.now();

  const imageData = readPixels(canvas);
  if (imageData) {
    const result = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    if (result?.data) {
      return {
        rawValue: result.data,
        type: detectQrType(result.data),
        engine: 'jsqr',
        ms: Math.round(performance.now() - started),
      };
    }
  }

  const decodeWithZxing = (target: HTMLCanvasElement): string | null => {
    const pixels = readPixels(target);
    if (!pixels) return null;

    const { data, width, height } = pixels;
    const grayscale = new Uint8ClampedArray(width * height);
    for (let source = 0, targetIndex = 0; source < data.length; source += 4, targetIndex += 1) {
      grayscale[targetIndex] = Math.round(
        data[source] * 0.299 + data[source + 1] * 0.587 + data[source + 2] * 0.114,
      );
    }

    try {
      const source = new RGBLuminanceSource(grayscale, width, height);
      const bitmap = new BinaryBitmap(new HybridBinarizer(source));
      const hints = new Map<DecodeHintType, unknown>();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_128,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.DATA_MATRIX,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new MultiFormatReader();
      reader.setHints(hints);
      const result = reader.decodeWithState(bitmap);
      return result?.getText() ?? null;
    } catch {
      return null;
    }
  };

  let value = decodeWithZxing(canvas);
  if (!value) {
    const rotated = rotate(canvas, 90);
    value = decodeWithZxing(rotated);
  }

  if (value) {
    return {
      rawValue: value,
      type: detectQrType(value),
      engine: 'zxing',
      ms: Math.round(performance.now() - started),
    };
  }

  return null;
}

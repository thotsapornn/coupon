'use client';

import type { OcrResult } from './types';

export type OcrStage = 'loading-core' | 'loading-language' | 'recognizing' | 'done';

export interface OcrProgress {
  stage: OcrStage;
  progress: number;
  label: string;
}

const INIT_TIMEOUT_MS = 90_000;
const RECOGNIZE_TIMEOUT_MS = 20_000;

let workerPromise: Promise<import('tesseract.js').Worker> | null = null;
let activeProgress: ((progress: OcrProgress) => void) | null = null;

function describe(status: string): { stage: OcrStage; label: string } {
  const value = status.toLowerCase();
  if (value.includes('core')) return { stage: 'loading-core', label: 'กำลังโหลดตัวอ่านข้อความ…' };
  if (value.includes('language') || value.includes('traineddata') || value.includes('initializing')) {
    return { stage: 'loading-language', label: 'กำลังโหลดภาษาไทย/อังกฤษ…' };
  }
  if (value.includes('recognizing')) return { stage: 'recognizing', label: 'กำลังอ่านข้อความในรูป…' };
  return { stage: 'recognizing', label: 'กำลังประมวลผล…' };
}

async function getWorker(): Promise<import('tesseract.js').Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('tha+eng', 1, {
        logger: (message) => {
          if (!activeProgress || typeof message.progress !== 'number') return;
          const { stage, label } = describe(String(message.status ?? ''));
          activeProgress({
            stage,
            progress: Math.round(message.progress * 100),
            label,
          });
        },
      });
      await worker.setParameters({
        tessedit_pageseg_mode: '6' as never,
        preserve_interword_spaces: '1',
      });
      return worker;
    })();

    workerPromise.catch(() => {
      workerPromise = null;
    });
  }
  return workerPromise;
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('OCR_TIMEOUT')), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runOcr(
  canvas: HTMLCanvasElement,
  onProgress?: (progress: OcrProgress) => void,
): Promise<OcrResult> {
  activeProgress = onProgress ?? null;
  const worker = await withTimeout(getWorker(), INIT_TIMEOUT_MS);

  try {
    const { data } = await withTimeout(
      worker.recognize(canvas, {}, { text: true, blocks: false }),
      RECOGNIZE_TIMEOUT_MS,
    );

    onProgress?.({ stage: 'done', progress: 100, label: 'อ่านข้อความเสร็จแล้ว' });

    const text = String(data.text ?? '').trim();
    const confidence = Number(data.confidence ?? 0);
    return {
      text,
      confidence: Number.isFinite(confidence) ? confidence : 0,
      lines: text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => ({ text: line, confidence })),
    };
  } catch (error) {
    if ((error as Error).message === 'OCR_TIMEOUT') {
      // ยกเลิก worker ที่ค้างเพื่อให้เริ่มใหม่ได้
      const pending = workerPromise;
      workerPromise = null;
      pending?.then((w) => w.terminate()).catch(() => undefined);
      throw new Error('OCR ใช้เวลานานเกิน 20 วินาที กรุณากรอกข้อมูลเองหรือลองรูปที่ชัดขึ้น');
    }
    throw new Error('อ่านข้อความจากรูปไม่สำเร็จ กรุณากรอกข้อมูลเอง');
  } finally {
    activeProgress = null;
  }
}

export function terminateOcr(): void {
  const pending = workerPromise;
  workerPromise = null;
  pending?.then((worker) => worker.terminate()).catch(() => undefined);
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { cropPreparedImage, type PreparedImage } from '@/lib/image';
import { AlertIcon, CheckIcon, XIcon } from './Icons';

type Mode = 'move' | 'nw' | 'ne' | 'sw' | 'se';
type Rect = { x: number; y: number; w: number; h: number };

const MIN = 0.12;
const DEFAULT_RECT: Rect = { x: 0.06, y: 0.06, w: 0.88, h: 0.88 };
const MAX_STAGE_WIDTH = 528;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** ขนาดแสดงผลที่พอดีกับหน้าจอ โดยคงสัดส่วนรูป */
function fitStage(image: PreparedImage): { width: number; height: number } {
  const maxWidth = Math.min(
    (typeof window === 'undefined' ? 480 : window.innerWidth) - 64,
    MAX_STAGE_WIDTH,
  );
  const maxHeight = (typeof window === 'undefined' ? 480 : window.innerHeight) * 0.58;
  const scale = Math.min(maxWidth / image.canvas.width, maxHeight / image.canvas.height, 1);
  return {
    width: Math.max(1, Math.round(image.canvas.width * scale)),
    height: Math.max(1, Math.round(image.canvas.height * scale)),
  };
}

export function ImageCropper({
  image,
  onApply,
  onCancel,
  cancelLabel = 'ยกเลิก',
}: {
  image: PreparedImage;
  onApply: (next: PreparedImage) => void;
  onCancel: () => void;
  cancelLabel?: string;
}) {
  const [rect, setRect] = useState<Rect>(DEFAULT_RECT);
  const [stage, setStage] = useState(() => fitStage(image));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: Mode; startX: number; startY: number; origin: Rect } | null>(null);

  useEffect(() => {
    const update = () => setStage(fitStage(image));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [image]);

  // ล็อกไม่ให้หน้าหลัง modal เลื่อนขณะครอป (มือถือชอบเด้ง)
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function begin(event: React.PointerEvent, mode: Mode) {
    event.preventDefault();
    event.stopPropagation();
    stageRef.current?.setPointerCapture(event.pointerId);
    dragRef.current = { mode, startX: event.clientX, startY: event.clientY, origin: rect };
  }

  function move(event: React.PointerEvent) {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;

    const box = stage.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;

    const dx = (event.clientX - drag.startX) / box.width;
    const dy = (event.clientY - drag.startY) / box.height;
    const origin = drag.origin;

    if (drag.mode === 'move') {
      setRect({
        ...origin,
        x: clamp(origin.x + dx, 0, 1 - origin.w),
        y: clamp(origin.y + dy, 0, 1 - origin.h),
      });
      return;
    }

    let left = origin.x;
    let top = origin.y;
    let right = origin.x + origin.w;
    let bottom = origin.y + origin.h;

    if (drag.mode.includes('w')) left = clamp(origin.x + dx, 0, right - MIN);
    if (drag.mode.includes('e')) right = clamp(right + dx, left + MIN, 1);
    if (drag.mode.includes('n')) top = clamp(origin.y + dy, 0, bottom - MIN);
    if (drag.mode.includes('s')) bottom = clamp(bottom + dy, top + MIN, 1);

    setRect({ x: left, y: top, w: right - left, h: bottom - top });
  }

  function end(event: React.PointerEvent) {
    dragRef.current = null;
    stageRef.current?.releasePointerCapture?.(event.pointerId);
  }

  function apply() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const next = cropPreparedImage(image, {
        x: rect.x * image.canvas.width,
        y: rect.y * image.canvas.height,
        width: rect.w * image.canvas.width,
        height: rect.h * image.canvas.height,
      });
      onApply(next);
    } catch (cause) {
      setError((cause as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div className="crop-modal" role="dialog" aria-modal="true" aria-labelledby="crop-title">
        <div className="crop-head">
          <div>
            <h2 className="modal-title" id="crop-title">
              ครอปรูป
            </h2>
            <p className="modal-text">ลากกรอบหรือมุมทั้งสี่เพื่อเลือกพื้นที่ที่ต้องการ</p>
          </div>
          <button type="button" className="crop-close" onClick={onCancel} disabled={busy} aria-label="ปิด">
            <XIcon size={18} />
          </button>
        </div>

        <div
          ref={stageRef}
          className="crop-stage"
          style={{ width: stage.width, height: stage.height }}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image.dataUrl} alt="รูปที่จะครอป" draggable={false} />
          <div
            className="crop-rect"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
            }}
            onPointerDown={(event) => begin(event, 'move')}
          >
            <span className="crop-handle nw" onPointerDown={(event) => begin(event, 'nw')} />
            <span className="crop-handle ne" onPointerDown={(event) => begin(event, 'ne')} />
            <span className="crop-handle sw" onPointerDown={(event) => begin(event, 'sw')} />
            <span className="crop-handle se" onPointerDown={(event) => begin(event, 'se')} />
          </div>
        </div>

        {error ? (
          <p className="notice notice-error" role="alert">
            <AlertIcon size={16} />
            {error}
          </p>
        ) : null}

        <p className="crop-hint small muted">
          {Math.round(rect.w * image.canvas.width)} × {Math.round(rect.h * image.canvas.height)} px
        </p>

        <div className="crop-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setRect(DEFAULT_RECT)}
            disabled={busy}
          >
            รีเซ็ต
          </button>
          <button type="button" className="btn btn-primary" onClick={apply} disabled={busy}>
            <CheckIcon size={16} />
            {busy ? 'กำลังครอป…' : 'ใช้รูปนี้'}
          </button>
        </div>
      </div>
    </div>
  );
}

import { NextResponse } from 'next/server';
import { readImage } from '@/lib/store';

export const runtime = 'nodejs';

type Context = { params: Promise<{ file: string }> };

export async function GET(_request: Request, context: Context) {
  const { file } = await context.params;
  const image = await readImage(file);
  if (!image) {
    return NextResponse.json({ ok: false, error: { code: 'NOT_FOUND', message: 'ไม่พบรูปภาพ' } }, { status: 404 });
  }
  return new NextResponse(new Uint8Array(image.buffer), {
    status: 200,
    headers: {
      'Content-Type': image.mime,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

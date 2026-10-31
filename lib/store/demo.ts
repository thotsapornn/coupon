import { promises as fs } from 'node:fs';
import path from 'node:path';
import { notFound, invalidState, validationError } from '../errors';
import { normalizeUserId } from '../user';
import { nowIso, todayBangkok } from '../format';
import { filterCoupons, matchesStatus, sortCoupons } from '../filter';
import { normalizeForCompare, sanitizeForSheet } from '../parser';
import type {
  Coupon,
  CouponImageInput,
  CouponInput,
  ListCouponsOptions,
  ListResult,
  UsageAction,
  UsageLog,
} from '../types';

interface Db {
  version: number;
  coupons: Coupon[];
  logs: UsageLog[];
}

const DATA_DIR = process.env.CW_DATA_DIR
  ? path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.CW_DATA_DIR)
  : path.join(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const TEXT_FIELDS = [
  'title',
  'merchant',
  'discountText',
  'description',
  'couponCode',
  'note',
  'qrRawValue',
] as const;

/* ------------------------------------------------------------------ */
/* Locking + persistence                                                */
/* ------------------------------------------------------------------ */

let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

let initPromise: Promise<void> | undefined;

function ensureDataDir() {
  initPromise ??= fs.mkdir(UPLOAD_DIR, { recursive: true }).then(() => undefined);
  return initPromise;
}

async function writeDb(db: Db): Promise<void> {
  await ensureDataDir();
  const tmp = `${DB_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, DB_PATH);
}

let seedPromise: Promise<Db> | null = null;

async function readDb(): Promise<Db> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Db;
    if (!Array.isArray(parsed.coupons) || !Array.isArray(parsed.logs)) {
      throw new Error('invalid db shape');
    }
    // ข้อมูลรุ่นก่อนยังไม่มี userId — ย้ายเข้ากลุ่ม legacy
    for (const coupon of parsed.coupons) {
      if (!coupon.userId) coupon.userId = 'legacy';
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;

    // คำขอแรกอาจเข้ามาพร้อมกัน (list + stats) — seed ครั้งเดียวแล้วแชร์ผล
    if (!seedPromise) {
      seedPromise = (async () => {
        const seeded = await seedDb();
        await writeDb(seeded);
        return seeded;
      })();
    }
    try {
      return await seedPromise;
    } finally {
      seedPromise = null;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

/** ค่าที่เขียนลงชีตอาจถูกเติม ' เพื่อกันสูตร — ตัดออกตอนอ่าน */
function unsanitize(value: string | undefined): string | undefined {
  if (!value) return value;
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value;
}

function sanitizeCoupon(coupon: Coupon): Coupon {
  return {
    ...coupon,
    title: unsanitize(coupon.title) ?? coupon.title,
    merchant: unsanitize(coupon.merchant),
    discountText: unsanitize(coupon.discountText),
    description: unsanitize(coupon.description),
    couponCode: unsanitize(coupon.couponCode),
    note: unsanitize(coupon.note),
    qrRawValue: unsanitize(coupon.qrRawValue),
  };
}

function cleanInput(input: CouponInput): CouponInput {
  const out: CouponInput = { ...input };
  for (const field of TEXT_FIELDS) {
    const value = out[field];
    if (typeof value === 'string') {
      (out as unknown as Record<string, unknown>)[field] = sanitizeForSheet(value);
    }
  }
  return out;
}

function nextSequence(values: string[], prefix: string, width = 3): number {
  let max = 0;
  for (const value of values) {
    if (!value.startsWith(prefix)) continue;
    const n = Number(value.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max + 1;
}

function makeCouponId(coupons: Coupon[]): string {
  const day = todayBangkok().replaceAll('-', '').slice(2); // YYMMDD
  const prefix = `CPN-${day}-`;
  const seq = nextSequence(coupons.map((c) => c.couponId), prefix, 3);
  return `${prefix}${String(seq).padStart(3, '0')}`;
}

function makeLogId(logs: UsageLog[]): string {
  const day = todayBangkok().replaceAll('-', '').slice(2);
  const prefix = `LOG-${day}-`;
  const seq = nextSequence(logs.map((l) => l.logId), prefix, 4);
  return `${prefix}${String(seq).padStart(4, '0')}`;
}

function pushLog(
  db: Db,
  couponId: string,
  action: UsageAction,
  fromStatus: Coupon['status'] | undefined,
  toStatus: Coupon['status'] | undefined,
  metadata?: Record<string, unknown>,
): void {
  db.logs.push({
    logId: makeLogId(db.logs),
    couponId,
    action,
    fromStatus,
    toStatus,
    at: nowIso(),
    actor: 'owner',
    metadata,
  });
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/* ------------------------------------------------------------------ */
/* Seed data                                                            */
/* ------------------------------------------------------------------ */

function addDays(dateStr: string, amount: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function shiftIso(iso: string, minutes: number): string {
  return nowIso(new Date(Date.parse(iso) + minutes * 60_000));
}

function seedSvg(brand: string, headline: string, from: string, to: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="420" viewBox="0 0 720 420">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="720" height="420" fill="url(#g)"/>
  <circle cx="640" cy="70" r="120" fill="#ffffff" opacity="0.08"/>
  <circle cx="90" cy="380" r="150" fill="#000000" opacity="0.06"/>
  <text x="56" y="120" font-family="Helvetica, Arial, sans-serif" font-size="34" fill="#ffffff" opacity="0.9">${brand}</text>
  <text x="56" y="230" font-family="Helvetica, Arial, sans-serif" font-size="64" font-weight="700" fill="#ffffff">${headline}</text>
  <text x="56" y="300" font-family="Helvetica, Arial, sans-serif" font-size="26" fill="#ffffff" opacity="0.8">COUPON WALLET · DEMO</text>
</svg>`;
}

async function seedDb(): Promise<Db> {
  await ensureDataDir();
  const now = nowIso();
  const today = todayBangkok();
  const coupons: Coupon[] = [];
  const logs: UsageLog[] = [];

  const seeds: Array<{
    userId: string;
    title: string;
    merchant: string;
    discountText: string;
    description: string;
    couponCode?: string;
    qrRawValue?: string;
    qrType?: Coupon['qrType'];
    expiryDate?: string;
    status: Coupon['status'];
    usedAt?: string;
    source: Coupon['source'];
    color: [string, string];
  }> = [
    {
      userId: 'tar',
      title: 'Shopee — ลด 50 บาท',
      merchant: 'Shopee',
      discountText: 'ลด 50 บาท ขั้นต่ำ 300',
      description: 'ใช้ได้กับสินค้าทุกหมวด · ไม่รวมสินค้าในหมวดสุขภาพ',
      couponCode: 'SAVE50',
      qrRawValue: 'https://s.shopee.co.th/demo-save50',
      qrType: 'url',
      expiryDate: addDays(today, 2),
      status: 'unused',
      source: 'upload',
      color: ['#ee4d2d', '#ff8a3d'],
    },
    {
      userId: 'tar',
      title: 'GrabFood — 1 แถม 1',
      merchant: 'GrabFood',
      discountText: '1 แถม 1',
      description: 'ซื้อเมนูที่ร่วมรายการ 1 รับฟรี 1 เฉพาะร้านที่กำหนด',
      couponCode: 'GRAB1FREE',
      qrRawValue: 'GRAB1FREE',
      qrType: 'plain_code',
      expiryDate: addDays(today, 20),
      status: 'used',
      usedAt: shiftIso(now, -1440),
      source: 'upload',
      color: ['#00b14f', '#0f9d58'],
    },
    {
      userId: 'tar',
      title: 'Starbucks — ฟรีอัปไซซ์',
      merchant: 'Starbucks',
      discountText: 'ฟรีอัปไซซ์',
      description: 'อัปไซซ์เครื่องดื่มร้อนหรือเย็น 1 ระดับ เมื่อซื้อเครื่องดื่มใดก็ได้',
      couponCode: 'SBUXUP',
      expiryDate: addDays(today, 45),
      status: 'unused',
      source: 'paste',
      color: ['#00754a', '#1e3932'],
    },
    {
      userId: 'demo',
      title: 'Lazada — ลด 20%',
      merchant: 'Lazada',
      discountText: 'ลด 20% ขั้นต่ำ 500 บาท',
      description: 'สูงสุด 200 บาท เฉพาะแอป Lazada',
      couponCode: 'LAZ20',
      qrRawValue: 'https://www.lazada.co.th/demo-laz20',
      qrType: 'url',
      expiryDate: addDays(today, -3),
      status: 'unused',
      source: 'upload',
      color: ['#0f146d', '#f72b7f'],
    },
    {
      userId: 'demo',
      title: 'Tops — ลด 15%',
      merchant: 'Tops',
      discountText: 'ลด 15%',
      description: 'เฉพาะสินค้าที่ร่วมรายการ',
      couponCode: 'TOPS15',
      qrRawValue: 'TOPS15',
      qrType: 'plain_code',
      expiryDate: addDays(today, 12),
      status: 'unused',
      source: 'paste',
      color: ['#1d6b4e', '#2f8f68'],
    },
  ];

  for (const [index, seed] of seeds.entries()) {
    const id = `CPN-${today.replaceAll('-', '').slice(2)}-${String(index + 1).padStart(3, '0')}`;
    const filename = `${id}.svg`;
    await fs.writeFile(
      path.join(UPLOAD_DIR, filename),
      seedSvg(seed.merchant, seed.discountText, seed.color[0], seed.color[1]),
      'utf8',
    );

    coupons.push({
      couponId: id,
      userId: seed.userId,
      title: seed.title,
      merchant: seed.merchant,
      discountText: seed.discountText,
      description: seed.description,
      couponCode: seed.couponCode,
      qrRawValue: seed.qrRawValue,
      qrType: seed.qrType,
      expiryDate: seed.expiryDate,
      status: seed.status,
      imageFileId: filename,
      imageUrl: `/api/images/${filename}`,
      imageStatus: 'ok',
      ocrTextRaw: `${seed.merchant}\n${seed.discountText}\n${seed.description}`,
      ocrConfidence: 82,
      source: seed.source,
      createdAt: shiftIso(now, -120 - index * 30),
      updatedAt: seed.usedAt ?? shiftIso(now, -120 - index * 30),
      usedAt: seed.usedAt,
    });

    logs.push({
      logId: `LOG-${today.replaceAll('-', '').slice(2)}-${String(index * 2 + 1).padStart(4, '0')}`,
      couponId: id,
      action: 'created',
      toStatus: 'unused',
      at: shiftIso(now, -120 - index * 30),
      actor: 'owner',
      metadata: { source: seed.source, userId: seed.userId, seed: true },
    });
    if (seed.status === 'used') {
      logs.push({
        logId: `LOG-${today.replaceAll('-', '').slice(2)}-${String(index * 2 + 2).padStart(4, '0')}`,
        couponId: id,
        action: 'marked_used',
        fromStatus: 'unused',
        toStatus: 'used',
        at: seed.usedAt!,
        actor: 'owner',
        metadata: { seed: true },
      });
    }
  }

  return { version: 1, coupons, logs };
}

/* ------------------------------------------------------------------ */
/* Public operations                                                    */
/* ------------------------------------------------------------------ */

function stripDeleted(coupons: Coupon[]): Coupon[] {
  return coupons.filter((coupon) => !coupon.deletedAt);
}

function requireActor(raw: string): string {
  const id = normalizeUserId(raw);
  if (!id) throw validationError('ต้องระบุ userId');
  return id;
}

function canAccess(coupon: Coupon, actorId: string): boolean {
  return coupon.userId === actorId;
}

function findAccessible(
  db: Db,
  couponId: string,
  actorId: string,
  includeDeleted = false,
): Coupon {
  const coupon = db.coupons.find(
    (item) => item.couponId === couponId && (includeDeleted || !item.deletedAt),
  );
  if (!coupon || !canAccess(coupon, actorId)) throw notFound();
  return coupon;
}

export async function listCoupons(options: ListCouponsOptions): Promise<ListResult> {
  const db = await readDb();
  const actorId = requireActor(options.userId);
  const limit = Math.min(Math.max(options.limit ?? 500, 1), 1000);
  const q = options.q?.trim() ?? '';
  const scoped = stripDeleted(db.coupons).filter((coupon) => coupon.userId === actorId);
  const filtered = filterCoupons(scoped, { status: options.status, q });
  const sorted = sortCoupons(filtered).slice(0, limit);
  return { items: sorted.map(sanitizeCoupon), total: filtered.length };
}

export async function getSharedCoupon(couponId: string): Promise<Coupon> {
  const db = await readDb();
  const coupon = db.coupons.find((item) => item.couponId === couponId && !item.deletedAt);
  if (!coupon) throw notFound();
  return sanitizeCoupon(coupon);
}

export async function getCoupon(couponId: string, userId: string): Promise<Coupon> {
  const db = await readDb();
  return sanitizeCoupon(findAccessible(db, couponId, requireActor(userId)));
}

export async function createCoupon(
  userId: string,
  input: CouponInput,
  image?: CouponImageInput,
): Promise<Coupon> {
  return withLock(async () => {
    const actorId = requireActor(userId);
    const db = await readDb();
    const clean = cleanInput(input);
    const couponId = makeCouponId(db.coupons);
    const timestamp = nowIso();

    let imageFileId: string | undefined;
    let imageUrl: string | undefined;
    let imageStatus: Coupon['imageStatus'] = 'missing';

    if (image?.base64) {
      const ext = MIME_EXT[image.mimeType];
      if (!ext) throw invalidState('ชนิดรูปภาพไม่รองรับ');
      const buffer = Buffer.from(image.base64, 'base64');
      if (buffer.byteLength === 0) throw invalidState('รูปภาพว่างเปล่า');
      if (buffer.byteLength > 2 * 1024 * 1024) throw invalidState('รูปภาพมีขนาดเกิน 2 MB');
      await ensureDataDir();
      const filename = `${couponId}.${ext}`;
      await fs.writeFile(path.join(UPLOAD_DIR, filename), buffer);
      imageFileId = filename;
      imageUrl = `/api/images/${filename}`;
      imageStatus = 'ok';
    }

    const duplicate = stripDeleted(db.coupons)
      .filter((coupon) => coupon.userId === actorId)
      .find((coupon) => {
        const sameQr =
          clean.qrRawValue &&
          coupon.qrRawValue &&
          normalizeForCompare(coupon.qrRawValue) === normalizeForCompare(clean.qrRawValue);
        const sameCode =
          clean.couponCode &&
          coupon.couponCode &&
          normalizeForCompare(coupon.couponCode) === normalizeForCompare(clean.couponCode);
        return Boolean(sameQr || sameCode);
      });

    const coupon: Coupon = {
      couponId,
      userId: actorId,
      title: clean.title,
      merchant: clean.merchant,
      discountText: clean.discountText,
      description: clean.description,
      couponCode: clean.couponCode,
      qrRawValue: clean.qrRawValue,
      qrType: clean.qrType,
      expiryDate: clean.expiryDate,
      status: 'unused',
      imageFileId,
      imageUrl,
      imageStatus,
      ocrTextRaw: clean.ocrTextRaw,
      ocrConfidence: clean.ocrConfidence,
      note: clean.note,
      source: clean.source ?? 'upload',
      duplicateOf: clean.duplicateOf ?? duplicate?.couponId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    db.coupons.push(coupon);
    pushLog(db, couponId, 'created', undefined, 'unused', {
      source: coupon.source,
      userId: actorId,
      duplicateOf: coupon.duplicateOf,
    });
    await writeDb(db);
    return sanitizeCoupon(coupon);
  });
}

export async function updateCoupon(
  couponId: string,
  userId: string,
  patch: Partial<CouponInput>,
): Promise<Coupon> {
  return withLock(async () => {
    const actorId = requireActor(userId);
    const db = await readDb();
    const coupon = findAccessible(db, couponId, actorId);

    const editable: Array<keyof CouponInput> = [
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

    const changed: string[] = [];
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    for (const field of editable) {
      if (!(field in patch)) continue;
      const nextValue = patch[field];
      if (typeof nextValue === 'string' && TEXT_FIELDS.includes(field as (typeof TEXT_FIELDS)[number])) {
        (patch as Record<string, unknown>)[field] = sanitizeForSheet(nextValue);
      }
      const currentValue = coupon[field as keyof Coupon];
      if (nextValue === undefined || nextValue === '') {
        if (currentValue === undefined) continue;
        before[field] = currentValue;
        after[field] = undefined;
        (coupon as unknown as Record<string, unknown>)[field] = undefined;
        changed.push(field);
        continue;
      }
      if (currentValue === nextValue) continue;
      before[field] = currentValue;
      after[field] = nextValue;
      (coupon as unknown as Record<string, unknown>)[field] = nextValue;
      changed.push(field);
    }

    if (changed.length === 0) return sanitizeCoupon(coupon);

    coupon.updatedAt = nowIso();
    pushLog(db, couponId, 'updated', coupon.status, coupon.status, {
      changed,
      from: before,
      to: after,
      userId: actorId,
    });
    await writeDb(db);
    return sanitizeCoupon(coupon);
  });
}

export async function markUsed(couponId: string, userId: string): Promise<Coupon> {
  return withLock(async () => {
    const actorId = requireActor(userId);
    const db = await readDb();
    const coupon = findAccessible(db, couponId, actorId);
    if (coupon.status === 'used') throw invalidState('คูปองนี้ถูกทำเครื่องหมายว่าใช้แล้ว');

    const at = nowIso();
    coupon.status = 'used';
    coupon.usedAt = at;
    coupon.updatedAt = at;
    pushLog(db, couponId, 'marked_used', 'unused', 'used', { usedAt: at, userId: actorId });
    await writeDb(db);
    return sanitizeCoupon(coupon);
  });
}

export async function undoUsed(couponId: string, userId: string): Promise<Coupon> {
  return withLock(async () => {
    const actorId = requireActor(userId);
    const db = await readDb();
    const coupon = findAccessible(db, couponId, actorId);
    if (coupon.status !== 'used') throw invalidState('คูปองนี้ยังไม่ได้ถูกใช้');

    const previousUsedAt = coupon.usedAt;
    coupon.status = 'unused';
    delete coupon.usedAt;
    coupon.updatedAt = nowIso();
    pushLog(db, couponId, 'undo_used', 'used', 'unused', { previousUsedAt, userId: actorId });
    await writeDb(db);
    return sanitizeCoupon(coupon);
  });
}

export async function deleteCoupon(couponId: string, userId: string): Promise<Coupon> {
  return withLock(async () => {
    const actorId = requireActor(userId);
    const db = await readDb();
    const coupon = findAccessible(db, couponId, actorId);

    const at = nowIso();
    coupon.deletedAt = at;
    coupon.updatedAt = at;
    pushLog(db, couponId, 'deleted', coupon.status, coupon.status, { userId: actorId });
    await writeDb(db);
    return sanitizeCoupon(coupon);
  });
}

/** ลบถาวร (admin) — เอาไฟล์รูปออกด้วย */
export async function purgeCoupon(couponId: string, userId: string): Promise<void> {
  return withLock(async () => {
    const actorId = requireActor(userId);
    const db = await readDb();
    const index = db.coupons.findIndex(
      (coupon) => coupon.couponId === couponId && coupon.userId === actorId,
    );
    if (index < 0) throw notFound();

    const [removed] = db.coupons.splice(index, 1);
    if (removed.imageFileId) {
      try {
        await fs.unlink(path.join(UPLOAD_DIR, removed.imageFileId));
      } catch {
        // ไฟล์อาจหายไปแล้ว — ไม่ให้การลบแถวข้อมูลล้มเหลว
      }
    }

    pushLog(db, couponId, 'deleted', removed.status, removed.status, {
      userId: actorId,
      purge: true,
    });
    await writeDb(db);
  });
}

export async function listHistory(couponId: string, userId: string): Promise<UsageLog[]> {
  const db = await readDb();
  const actorId = requireActor(userId);
  findAccessible(db, couponId, actorId, true);

  return db.logs
    .filter((log) => log.couponId === couponId)
    .sort((a, b) => {
      const byTime = b.at.localeCompare(a.at);
      return byTime !== 0 ? byTime : b.logId.localeCompare(a.logId);
    });
}

export async function getStats(userId: string): Promise<{
  total: number;
  unused: number;
  used: number;
  expiring: number;
  expired: number;
}> {
  const db = await readDb();
  const actorId = requireActor(userId);
  const active = stripDeleted(db.coupons).filter((coupon) => coupon.userId === actorId);
  const expiring = active.filter((coupon) => matchesStatus(coupon, 'expiring')).length;
  const expired = active.filter((coupon) => matchesStatus(coupon, 'expired')).length;
  const used = active.filter((coupon) => coupon.status === 'used').length;
  const unused = active.filter((coupon) => matchesStatus(coupon, 'unused')).length;
  return { total: active.length, unused, used, expiring, expired };
}

export async function readDemoImage(filename: string): Promise<{ buffer: Buffer; mime: string } | null> {
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) return null;
  try {
    const buffer = await fs.readFile(path.join(UPLOAD_DIR, filename));
    const ext = filename.split('.').pop()?.toLowerCase() ?? '';
    const mime =
      ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg';
    return { buffer, mime };
  } catch {
    return null;
  }
}

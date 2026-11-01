import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { beforeEach, describe, expect, it } from 'vitest';

/* ------------------------------------------------------------------ */
/* Minimal Google Apps Script mocks                                     */
/* ------------------------------------------------------------------ */

class MockRange {
  constructor(
    private sheet: MockSheet,
    private row: number,
    private col: number,
    private numRows: number,
    private numCols: number,
  ) {}

  getValues(): unknown[][] {
    const out: unknown[][] = [];
    for (let r = 0; r < this.numRows; r += 1) {
      const line = this.sheet.data[this.row - 1 + r] ?? [];
      const rowOut: unknown[] = [];
      for (let c = 0; c < this.numCols; c += 1) {
        rowOut.push(line[this.col - 1 + c] ?? '');
      }
      out.push(rowOut);
    }
    return out;
  }

  setValues(values: unknown[][]): this {
    for (let r = 0; r < values.length; r += 1) {
      const target = this.row - 1 + r;
      while (this.sheet.data.length <= target) this.sheet.data.push([]);
      const row = this.sheet.data[target];
      for (let c = 0; c < values[r].length; c += 1) {
        row[this.col - 1 + c] = values[r][c] as string;
      }
    }
    return this;
  }

  setNumberFormat(): this {
    return this;
  }

  setFontWeight(): this {
    return this;
  }
}

class MockSheet {
  data: unknown[][] = [];

  getLastRow(): number {
    for (let i = this.data.length - 1; i >= 0; i -= 1) {
      const row = this.data[i] ?? [];
      if (row.some((value) => value !== '' && value !== null && value !== undefined)) {
        return i + 1;
      }
    }
    return 0;
  }

  getMaxRows(): number {
    return Math.max(1000, this.data.length);
  }

  getRange(row: number, col: number, numRows = 1, numCols = 1): MockRange {
    return new MockRange(this, row, col, numRows, numCols);
  }

  appendRow(values: unknown[]): void {
    this.data.push([...values]);
  }

  setFrozenRows(): void {}

  insertRowAfter(): void {}

  deleteRow(rowPosition: number): void {
    this.data.splice(rowPosition - 1, 1);
  }
}

class MockSpreadsheet {
  sheets = new Map<string, MockSheet>();

  getSheetByName(name: string): MockSheet | null {
    return this.sheets.get(name) ?? null;
  }

  insertSheet(name: string): MockSheet {
    const sheet = new MockSheet();
    this.sheets.set(name, sheet);
    return sheet;
  }

  getId(): string {
    return 'spreadsheet-1';
  }
}

class MockFile {
  trashed = false;
  content: string;

  constructor(
    public id: string,
    public name: string,
    public mimeType: string,
    bytes?: Uint8Array | string,
  ) {
    this.content = bytes === undefined ? '' : Buffer.from(bytes as string).toString('utf8');
  }

  setSharing(): void {}

  setTrashed(value: boolean): void {
    this.trashed = value;
  }

  getId(): string {
    return this.id;
  }

  getBlob(): { getDataAsString: () => string } {
    const content = this.content;
    return { getDataAsString: () => content };
  }
}

class MockFolder {
  files: MockFile[] = [];
  folders: MockFolder[] = [];

  constructor(
    public id: string,
    public name: string,
  ) {}

  createFile(blob: { bytes: Uint8Array | string; mimeType: string; name: string }): MockFile {
    const file = new MockFile(
      `file-${this.files.length + 1}-${this.id}`,
      blob.name,
      blob.mimeType,
      blob.bytes,
    );
    this.files.push(file);
    return file;
  }

  getFoldersByName(name: string): { hasNext: () => boolean; next: () => MockFolder } {
    const matches = this.folders.filter((folder) => folder.name === name);
    let index = 0;
    return {
      hasNext: () => index < matches.length,
      next: () => matches[index++],
    };
  }

  getFilesByName(name: string): { hasNext: () => boolean; next: () => MockFile } {
    const matches = this.files.filter((file) => file.name === name && !file.trashed);
    let index = 0;
    return {
      hasNext: () => index < matches.length,
      next: () => matches[index++],
    };
  }

  createFolder(name: string): MockFolder {
    const folder = new MockFolder(`folder-${this.folders.length + 1}-${this.id}`, name);
    this.folders.push(folder);
    return folder;
  }
}

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0');
}

function formatDate(date: Date, _timeZone: string, pattern: string): string {
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  const tokens: Record<string, string> = {
    yyyy: String(shifted.getUTCFullYear()),
    yy: pad(shifted.getUTCFullYear() % 100),
    MM: pad(shifted.getUTCMonth() + 1),
    dd: pad(shifted.getUTCDate()),
    HH: pad(shifted.getUTCHours()),
    mm: pad(shifted.getUTCMinutes()),
    ss: pad(shifted.getUTCSeconds()),
    SSS: pad(shifted.getUTCMilliseconds(), 3),
  };
  return pattern
    .replace(/'([^']*)'/g, '$1')
    .replace(/yyyy|yy|MM|dd|HH|mm|ss|SSS/g, (token) => tokens[token]);
}

function buildGas() {
  const spreadsheet = new MockSpreadsheet();
  const properties = new Map<string, string>();
  const rootFolders: MockFolder[] = [];
  const filesById = new Map<string, MockFile>();

  const folderById = new Map<string, MockFolder>();
  const registerFile = (file: MockFile): MockFile => {
    filesById.set(file.id, file);
    return file;
  };
  const registerFolder = (folder: MockFolder): MockFolder => {
    folderById.set(folder.id, folder);
    return folder;
  };

  const folderApi = (folder: MockFolder) => ({
    getId: () => folder.id,
    getFoldersByName: (folderName: string) => folder.getFoldersByName(folderName),
    getFilesByName: (fileName: string) => folder.getFilesByName(fileName),
    createFolder: (folderName: string) =>
      folderApi(registerFolder(folder.createFolder(folderName))),
    createFile: (blob: { bytes: Uint8Array | string; mimeType: string; name: string }) =>
      registerFile(folder.createFile(blob)),
  });

  const driveApp = {
    Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK' },
    Permission: { VIEW: 'VIEW' },
    createFolder(name: string) {
      const folder = registerFolder(new MockFolder(`root-${rootFolders.length + 1}`, name));
      rootFolders.push(folder);
      return folderApi(folder);
    },
    getFolderById(id: string) {
      const folder = folderById.get(id);
      if (!folder) throw new Error('folder not found');
      return folderApi(folder);
    },
    getFileById(id: string) {
      const file = filesById.get(id);
      if (!file) throw new Error('file not found');
      return file;
    },
  };

  let uuidSequence = 0;

  const utilities = {
    formatDate,
    base64Decode: (value: string) => new Uint8Array(Buffer.from(value, 'base64')),
    newBlob: (bytes: Uint8Array | string, mimeType: string, name: string) => ({
      bytes,
      mimeType,
      name,
    }),
    getUuid: () =>
      `${(uuidSequence++).toString(16).padStart(8, '0')}-0000-4000-8000-000000000000`,
  };

  const contentService = {
    MimeType: { JSON: 'application/json' },
    createTextOutput: (content: string) => ({
      content,
      mimeType: '',
      setMimeType(mime: string) {
        this.mimeType = mime;
        return this;
      },
    }),
  };

  const context: Record<string, unknown> = {
    SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet, openById: () => spreadsheet },
    DriveApp: driveApp,
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key: string) => properties.get(key) ?? null,
        setProperty: (key: string, value: string) => properties.set(key, value),
      }),
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock: () => undefined }),
    },
    ContentService: contentService,
    Utilities: utilities,
    console,
    Date,
    JSON,
    Math,
    Number,
    String,
    Object,
    Array,
    RegExp,
    Error,
    isNaN,
    parseInt,
    parseFloat,
  };

  const files = ['Code.gs', 'Sheets.gs', 'Drive.gs', 'Utils.gs'];
  const source = files
    .map((file) => readFileSync(path.join(process.cwd(), 'scripts/gas', file), 'utf8'))
    .join('\n\n');

  vm.createContext(context);
  vm.runInContext(source, context);

  const doPost = context.doPost as (event: {
    postData: { contents: string };
    parameter: Record<string, string>;
  }) => { content: string };

  properties.set('SHARED_SECRET', 'test-secret');

  return {
    context,
    spreadsheet,
    properties,
    filesById,
    call(action: string, payload: Record<string, unknown>, token = 'test-secret') {
      const withUser =
        action === 'ping' || payload.userId !== undefined ? payload : { ...payload, userId: 'tar' };
      const output = doPost({
        postData: { contents: JSON.stringify({ action, payload: withUser, token }) },
        parameter: {},
      });
      return JSON.parse(output.content) as {
        ok: boolean;
        data?: Record<string, unknown>;
        error?: { code: string; message: string };
      };
    },
  };
}

/* ------------------------------------------------------------------ */
/* Tests                                                                */
/* ------------------------------------------------------------------ */

type Gas = ReturnType<typeof buildGas>;

function today(): string {
  return formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd');
}

function addDays(dateStr: string, amount: number): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

let gas: Gas;

beforeEach(() => {
  gas = buildGas();
});

function createCoupon(overrides: Record<string, unknown> = {}) {
  const result = gas.call('createCoupon', {
    title: 'Shopee — ลด 50 บาท',
    merchant: 'Shopee',
    discountText: 'ลด 50 บาท',
    couponCode: 'SAVE50',
    qrRawValue: 'https://s.shopee.co.th/abc',
    qrType: 'url',
    expiryDate: addDays(today(), 5),
    imageBase64: Buffer.from('image-bytes').toString('base64'),
    imageMimeType: 'image/png',
    ...overrides,
  });
  expect(result.ok).toBe(true);
  return result.data!.coupon as Record<string, unknown>;
}

describe('Apps Script web app', () => {
  it('rejects requests without the shared secret', () => {
    const result = gas.call('ping', {}, 'wrong');
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('UNAUTHORIZED');
  });

  it('responds to ping', () => {
    const result = gas.call('ping', {});
    expect(result.ok).toBe(true);
    expect((result.data as { status: string }).status).toBe('ok');
  });

  it('creates a coupon, stores the image and logs the creation', () => {
    const coupon = createCoupon();

    expect(coupon.couponId).toMatch(/^CPN-\d{6}-001$/);
    expect(coupon.userId).toBe('tar');
    expect(coupon.status).toBe('unused');
    expect(coupon.usedAt).toBe('');
    expect(coupon.createdAt).toMatch(/\d{2}:\d{2}:\d{2}\.\d{3}\+07:00$/);
    expect(String(coupon.imageUrl)).toContain('drive.google.com');

    const couponsSheet = gas.spreadsheet.getSheetByName('Coupons')!;
    expect(couponsSheet.getLastRow()).toBe(2);

    const history = gas.spreadsheet.getSheetByName('UsageHistory')!;
    expect(history.getLastRow()).toBe(2);
    expect(history.data[1][2]).toBe('created');
  });

  it('auto-links duplicates by QR value', () => {
    const first = createCoupon();
    const second = createCoupon({
      title: 'Shopee — ลด 50 บาท (2)',
      couponCode: 'OTHER',
      qrRawValue: '  HTTPS://S.SHOPEE.CO.TH/ABC/  ',
    });

    expect(second.couponId).not.toBe(first.couponId);
    expect(second.duplicateOf).toBe(first.couponId);
  });

  it('rejects invalid payloads', () => {
    const emptyTitle = gas.call('createCoupon', {
      title: '   ',
      imageBase64: 'aGVsbG8=',
      imageMimeType: 'image/png',
    });
    expect(emptyTitle.error?.code).toBe('VALIDATION_ERROR');

    const badDate = gas.call('createCoupon', {
      title: 'ok',
      expiryDate: '31/12/2026',
      imageBase64: 'aGVsbG8=',
      imageMimeType: 'image/png',
    });
    expect(badDate.error?.code).toBe('VALIDATION_ERROR');
  });

  it('lists coupons with filters and expiry rules', () => {
    const expiring = createCoupon({ title: 'Expiring', couponCode: 'A1', qrRawValue: 'A1', expiryDate: addDays(today(), 2) });
    createCoupon({ title: 'Later', couponCode: 'B2', qrRawValue: 'B2', expiryDate: addDays(today(), 20) });
    const expired = createCoupon({ title: 'Old', couponCode: 'C3', qrRawValue: 'C3', expiryDate: addDays(today(), -2) });

    const all = gas.call('listCoupons', { status: 'all' });
    expect((all.data!.items as unknown[]).length).toBe(3);

    const unused = gas.call('listCoupons', { status: 'unused' });
    expect((unused.data!.items as Array<Record<string, unknown>>).map((c) => c.title)).toEqual(['Expiring', 'Later']);

    const near = gas.call('listCoupons', { status: 'expiring' });
    expect((near.data!.items as Array<Record<string, unknown>>)[0].couponId).toBe(expiring.couponId);

    const old = gas.call('listCoupons', { status: 'expired' });
    expect((old.data!.items as Array<Record<string, unknown>>)[0].couponId).toBe(expired.couponId);

    const search = gas.call('listCoupons', { q: 'later' });
    expect((search.data!.items as Array<Record<string, unknown>>).length).toBe(1);
  });

  it('marks a coupon as used and prevents double use', () => {
    const coupon = createCoupon();
    const used = gas.call('markUsed', { couponId: coupon.couponId });
    expect(used.ok).toBe(true);
    expect((used.data!.coupon as Record<string, unknown>).status).toBe('used');
    expect((used.data!.coupon as Record<string, unknown>).usedAt).toMatch(/\+07:00$/);

    const again = gas.call('markUsed', { couponId: coupon.couponId });
    expect(again.error?.code).toBe('INVALID_STATE');
  });

  it('undoes used, clears usedAt and keeps the previous timestamp in history', () => {
    const coupon = createCoupon();
    const used = gas.call('markUsed', { couponId: coupon.couponId });
    const usedAt = (used.data!.coupon as Record<string, unknown>).usedAt;

    const undo = gas.call('undoUsed', { couponId: coupon.couponId });
    expect(undo.ok).toBe(true);
    expect((undo.data!.coupon as Record<string, unknown>).status).toBe('unused');
    expect((undo.data!.coupon as Record<string, unknown>).usedAt).toBe('');

    const logs = gas.call('listHistory', { couponId: coupon.couponId });
    const actions = (logs.data!.logs as Array<Record<string, unknown>>).map((log) => log.action);
    expect(actions).toEqual(['undo_used', 'marked_used', 'created']);
    const undoLog = (logs.data!.logs as Array<Record<string, unknown>>)[0];
    expect((undoLog.metadata as Record<string, unknown>).previousUsedAt).toBe(usedAt);
  });

  it('updates fields and can clear optional ones', () => {
    const coupon = createCoupon({ note: 'ใช้กับบิลนี้' });

    const updated = gas.call('updateCoupon', {
      couponId: coupon.couponId,
      patch: { title: 'ชื่อใหม่', note: '', merchant: 'Shopee TH' },
    });

    expect(updated.ok).toBe(true);
    expect((updated.data!.coupon as Record<string, unknown>).title).toBe('ชื่อใหม่');
    expect((updated.data!.coupon as Record<string, unknown>).note).toBe('');
    expect((updated.data!.coupon as Record<string, unknown>).merchant).toBe('Shopee TH');

    const logs = gas.call('listHistory', { couponId: coupon.couponId });
    const updateLog = (logs.data!.logs as Array<Record<string, unknown>>)[0];
    expect(updateLog.action).toBe('updated');
    expect((updateLog.metadata as Record<string, unknown>).changed).toEqual(
      expect.arrayContaining(['title', 'note', 'merchant']),
    );
  });

  it('escapes formula injection but returns the original text to the app', () => {
    const coupon = createCoupon({ title: '=SUM(1+1)', merchant: '@evil', couponCode: '+CODE' });
    expect(coupon.title).toBe('=SUM(1+1)');

    const sheet = gas.spreadsheet.getSheetByName('Coupons')!;
    expect(sheet.data[1][1]).toBe("'=SUM(1+1)");
    expect(sheet.data[1][2]).toBe("'@evil");
  });

  it('soft deletes and hides coupons from lists', () => {
    const coupon = createCoupon();
    const deleted = gas.call('deleteCoupon', { couponId: coupon.couponId });
    expect(deleted.ok).toBe(true);
    expect((deleted.data!.coupon as Record<string, unknown>).deletedAt).toBeTruthy();

    const list = gas.call('listCoupons', { status: 'all' });
    expect((list.data!.items as unknown[]).length).toBe(0);

    const detail = gas.call('getCoupon', { couponId: coupon.couponId });
    expect(detail.error?.code).toBe('NOT_FOUND');
  });

  it('purges a coupon permanently: row, Drive file and audit log', () => {
    const coupon = createCoupon();
    const sheet = gas.spreadsheet.getSheetByName('Coupons')!;
    const rowsBefore = sheet.data.length;
    const fileId = String(coupon.imageFileId);
    expect(fileId).toBeTruthy();
    expect(gas.filesById.get(fileId)?.trashed).toBe(false);

    const result = gas.call('purgeCoupon', { couponId: coupon.couponId });
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ couponId: coupon.couponId, deleted: true });

    expect(sheet.data.length).toBe(rowsBefore - 1);
    expect(gas.filesById.get(fileId)?.trashed).toBe(true);

    const history = gas.spreadsheet.getSheetByName('UsageHistory')!;
    const last = history.data[history.data.length - 1];
    expect(String(last[1])).toBe(coupon.couponId);
    expect(String(last[2])).toBe('admin_deleted');

    const list = gas.call('listCoupons', { status: 'all' });
    expect(list.data!.items).toEqual([]);
  });

  it('refuses to purge a coupon that belongs to another user', () => {
    const coupon = createCoupon({ userId: 'other' });
    const sheet = gas.spreadsheet.getSheetByName('Coupons')!;
    const rowsBefore = sheet.data.length;

    const result = gas.call('purgeCoupon', { couponId: coupon.couponId });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('NOT_FOUND');
    expect(sheet.data.length).toBe(rowsBefore);
  });

  it('admin lists coupons across all users', () => {
    createCoupon({ title: 'ของ tar', couponCode: 'M1', qrRawValue: 'M1' });
    createCoupon({ userId: 'other', title: 'ของ other', couponCode: 'O1', qrRawValue: 'O1' });

    const result = gas.call('adminListCoupons', { status: 'all' });
    expect(result.ok).toBe(true);
    const items = result.data!.items as Array<Record<string, unknown>>;
    expect(items.map((item) => item.userId).sort()).toEqual(['other', 'tar']);

    const filtered = gas.call('adminListCoupons', { q: 'other' });
    expect((filtered.data!.items as Array<Record<string, unknown>>).length).toBe(1);
  });

  it('admin purges a coupon that belongs to another user', () => {
    const coupon = createCoupon({ userId: 'other' });
    const fileId = String(coupon.imageFileId);

    const result = gas.call('adminPurgeCoupon', { couponId: coupon.couponId });
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ couponId: coupon.couponId, deleted: true });
    expect(gas.filesById.get(fileId)?.trashed).toBe(true);

    const list = gas.call('adminListCoupons', { status: 'all' });
    expect(list.data!.items).toEqual([]);
  });

  it('computes stats', () => {
    createCoupon({ title: 'A', couponCode: 'A1', qrRawValue: 'A1', expiryDate: addDays(today(), 2) });
    const used = createCoupon({ title: 'B', couponCode: 'B2', qrRawValue: 'B2', expiryDate: addDays(today(), 10) });
    gas.call('markUsed', { couponId: used.couponId });
    createCoupon({ title: 'C', couponCode: 'C3', qrRawValue: 'C3', expiryDate: addDays(today(), -1) });

    const stats = gas.call('getStats', {});
    expect(stats.data).toMatchObject({ total: 3, used: 1, unused: 1, expiring: 1, expired: 1 });
  });

  it('separates coupons per user — every id sees only its own', () => {
    const tarCoupon = createCoupon();
    const demo = gas.call('createCoupon', {
      userId: 'demo',
      title: 'Demo — ลด 10%',
      couponCode: 'DEMO10',
      qrRawValue: 'DEMO10',
      qrType: 'plain_code',
      imageBase64: Buffer.from('demo-image').toString('base64'),
      imageMimeType: 'image/png',
    });
    expect(demo.ok).toBe(true);

    const tarList = gas.call('listCoupons', { userId: 'tar', status: 'all' });
    expect((tarList.data!.items as Array<Record<string, unknown>>).length).toBe(1);
    expect((tarList.data!.items as Array<Record<string, unknown>>)[0].couponId).toBe(tarCoupon.couponId);

    const demoList = gas.call('listCoupons', { userId: 'demo', status: 'all' });
    expect((demoList.data!.items as Array<Record<string, unknown>>).length).toBe(1);
    expect((demoList.data!.items as Array<Record<string, unknown>>)[0].userId).toBe('demo');

    const other = gas.call('listCoupons', { userId: 'other', status: 'all' });
    expect((other.data!.items as unknown[]).length).toBe(0);

    expect(gas.call('getCoupon', { couponId: tarCoupon.couponId, userId: 'demo' }).error?.code).toBe(
      'NOT_FOUND',
    );
    expect(
      gas.call('getCoupon', { couponId: tarCoupon.couponId, userId: 'other' }).error?.code,
    ).toBe('NOT_FOUND');
  });

  it('returns a coupon without a user for public sharing', () => {
    const coupon = createCoupon();
    const shared = gas.call('getSharedCoupon', { couponId: coupon.couponId });
    expect(shared.ok).toBe(true);
    expect((shared.data!.coupon as Record<string, unknown>).couponId).toBe(coupon.couponId);

    gas.call('deleteCoupon', { couponId: coupon.couponId });
    expect(gas.call('getSharedCoupon', { couponId: coupon.couponId }).error?.code).toBe('NOT_FOUND');
  });

  it('rejects invalid user ids', () => {
    const result = gas.call('listCoupons', { userId: 'BAD ID', status: 'all' });
    expect(result.error?.code).toBe('VALIDATION_ERROR');
  });

  it('returns NOT_FOUND for unknown coupons', () => {
    expect(gas.call('getCoupon', { couponId: 'CPN-NOPE' }).error?.code).toBe('NOT_FOUND');
    expect(gas.call('markUsed', { couponId: 'CPN-NOPE' }).error?.code).toBe('NOT_FOUND');
  });

  it('stores a shared payload in Drive and returns a short key', () => {
    const data = Buffer.from(JSON.stringify({ hello: 'world' })).toString('base64');

    const created = gas.call('createShare', { kind: 'full', data });
    expect(created.ok).toBe(true);

    const key = created.data!.key as string;
    expect(key).toMatch(/^[a-f0-9]{12}$/);

    const read = gas.call('getShare', { key });
    expect(read.ok).toBe(true);
    expect(read.data).toMatchObject({ key, kind: 'full', data });

    // เก็บเป็นไฟล์ JSON ในโฟลเดอร์ Shares ของ Drive
    expect(gas.filesById.size).toBe(1);
    const file = [...gas.filesById.values()][0];
    expect(file.name).toBe(`${key}.json`);
    expect(JSON.parse(file.content)).toMatchObject({ kind: 'full', data });
  });

  it('keeps full and summary shares separate and rejects bad keys', () => {
    const full = gas.call('createShare', {
      kind: 'full',
      data: Buffer.from('full-payload').toString('base64'),
    });
    const summary = gas.call('createShare', {
      kind: 'summary',
      data: Buffer.from('summary-payload').toString('base64'),
    });

    expect(full.ok).toBe(true);
    expect(summary.ok).toBe(true);
    expect(full.data!.key).not.toBe(summary.data!.key);
    expect(gas.call('getShare', { key: summary.data!.key as string }).data!.kind).toBe('summary');

    expect(gas.call('createShare', { kind: 'other', data: 'abc' }).error?.code).toBe(
      'VALIDATION_ERROR',
    );
    expect(gas.call('createShare', { kind: 'full', data: '' }).error?.code).toBe(
      'VALIDATION_ERROR',
    );
    expect(gas.call('getShare', { key: '../bad' }).error?.code).toBe('VALIDATION_ERROR');
    expect(gas.call('getShare', { key: 'aaaaaaaaaaaa' }).error?.code).toBe('NOT_FOUND');
  });
});

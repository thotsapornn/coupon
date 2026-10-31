# Data Model & API Contract — Coupon Wallet

| รายการ | รายละเอียด |
|---|---|
| เวอร์ชัน | 0.1 (Draft) |
| วันที่ | 31 ตุลาคม 2026 |
| อ้างอิง | `01-BRD.md`, `02-business-flow.md` |

---

## 1. หลักการออกแบบข้อมูล

1. **Google Sheets = single source of truth** (RULE-04) — ไม่มีฐานข้อมูลอื่น
2. เก็บวันที่เป็น **string ISO 8601** (`2026-10-31T14:05:00+07:00`) ไม่เก็บเป็น Date object เพื่อกันปัญหา locale/timezone ของ Sheets
3. ฟิลด์ที่ระบบสร้าง (`couponId`, `userId`, `createdAt`) แก้ไม่ได้
   - `userId` มาจาก path `/user/{id}` ตอนสร้าง และใช้แยกข้อมูลทุกการอ่าน/เขียน
4. `status` มีเพียง `unused` / `used` — "หมดอายุ" คำนวณจาก `expiryDate`
5. ทุกการเปลี่ยนสถานะ/แก้ไข ต้องมีแถวใน `UsageHistory`
6. ข้อความที่ผู้ใช้กรอกต้องผ่าน sanitize ก่อนเขียน (กัน formula injection)

---

## 2. โครงสร้าง Google Sheets

Spreadsheet เดียวชื่อ **`CouponWallet`** มี 4 ชีต:

| ชีต | หน้าที่ | ประมาณการแถว |
|---|---|---|
| `Coupons` | ข้อมูลคูปอง 1 แถว = 1 ใบ | หลักพัน |
| `UsageHistory` | log ทุก action | หลักหมื่น (ตัด archive ได้) |
| `Config` | ค่าคงที่ เช่น schema version, โฟลเดอร์ Drive | < 20 |
| `ErrorLog` | error จาก Apps Script | หมุนเวียน |

### 2.1 ชีต `Coupons`

| คอลัมน์ | Field | ชนิด | บังคับ | ตัวอย่าง | กติกา |
|---|---|---|---|---|---|
| A | `couponId` | string | ✓ | `CPN-261031-001` | `CPN-{YYMMDD}-{seq 3 หลัก}` สร้างโดย server, unique |
| B | `title` | string | ✓ | `Shopee — ลด 50 บาท` | 1–100 ตัวอักษร |
| C | `merchant` | string | – | `Shopee` | ≤ 50 |
| D | `discountText` | string | – | `ลด 50 บาท ขั้นต่ำ 300` | ≤ 80 |
| E | `description` | string | – | `ใช้ได้กับสินค้าทุกหมวด…` | ≤ 100 |
| F | `couponCode` | string | – | `SAVE50` | ≤ 100, ตัวพิมพ์ใหญ่ตามที่ปรากฏ |
| G | `qrRawValue` | string | – | `https://s.shopee.co.th/abc123` | ค่าดิบ ห้าม normalize (RULE-05) |
| H | `qrType` | enum | – | `url` | `url` / `plain_code` / `json` / `unknown` |
| I | `expiryDate` | date | – | `2026-12-31` | `YYYY-MM-DD` (ค.ศ.) |
| J | `status` | enum | ✓ | `unused` | `unused` / `used` |
| K | `imageFileId` | string | – | `1AbC…` | Drive file ID |
| L | `imageUrl` | string | – | `https://drive.google.com/…` | ลิงก์ดูรูป |
| M | `imageStatus` | enum | ✓ | `ok` | `ok` / `pending` / `missing` |
| N | `ocrTextRaw` | string | – | ข้อความเต็มจาก OCR | read-only, ≤ 5,000 |
| O | `ocrConfidence` | number | – | `78.5` | 0–100 |
| P | `note` | string | – | `ใช้กับบิลนี้เท่านั้น` | ≤ 300 |
| Q | `source` | enum | ✓ | `upload` | `upload` / `paste` / `share` / `manual` |
| R | `duplicateOf` | string | – | `CPN-261030-004` | อ้างอิงคูปองที่คล้ายกัน |
| S | `createdAt` | datetime | ✓ | `2026-10-31T14:05:00+07:00` | server เท่านั้น |
| T | `updatedAt` | datetime | ✓ | `2026-10-31T14:20:00+07:00` | ทุกครั้งที่แก้ |
| U | `usedAt` | datetime | – | `2026-11-02T19:30:00+07:00` | ว่างเมื่อ unused |
| V | `deletedAt` | datetime | – | – | soft delete |
| W | `notifiedAt` | datetime | – | – | เตรียมไว้ให้ Phase 2 |
| X | `userId` | string | ✓ | `tar` | เจ้าของคูปอง — `a-z 0-9 - _` ยาว 2–30 (เพิ่มทีหลังได้; แถวเก่าจะว่าง) |

**แถวที่ 1** เก็บชื่อ field ภาษาอังกฤษตามตาราง (เพื่อให้อ่านและ map ง่าย)
**แถวที่ 2 เป็นต้นไป** เป็นข้อมูลคูปอง (implementation ใช้ header แถวเดียว ไม่มีแถวคำอธิบาย เพื่อให้ append/อ่านง่าย)

> Apps Script ต้องอ่าน header แบบ dynamic และ map ชื่อ→index ไม่ hardcode คอลัมน์ เพื่อรองรับการเพิ่มฟิลด์ในอนาคต

### 2.2 ชีต `UsageHistory`

| คอลัมน์ | Field | ตัวอย่าง | กติกา |
|---|---|---|---|
| A | `logId` | `LOG-261031-0001` | unique |
| B | `couponId` | `CPN-261031-001` | FK → Coupons |
| C | `action` | `marked_used` | `created` / `updated` / `marked_used` / `undo_used` / `deleted` / `restored` |
| D | `fromStatus` | `unused` | |
| E | `toStatus` | `used` | |
| F | `at` | `2026-11-02T19:30:00+07:00` | server time |
| G | `actor` | `owner` | MVP มีค่าเดียว |
| H | `metadata` | `{"usedAt":"…","changed":["title"]}` | JSON string |
| I | `requestId` | `req_9f2c…` | ใช้ trace กับ ErrorLog |

### 2.3 ชีต `Config`

| key | value | หมายเหตุ |
|---|---|---|
| `schemaVersion` | `1` | ตรวจสอบตอน migrate |
| `driveRootFolderId` | `1XyZ…` | โฟลเดอร์ `CouponWallet` |
| `defaultTimezone` | `Asia/Bangkok` | |
| `nearExpiryDays` | `3` | ใช้กับ badge |

### 2.4 ชีต `ErrorLog`

`timestamp`, `requestId`, `action`, `code`, `message`, `stack`, `payloadPreview` (ตัด Base64 ออกเสมอ)

---

## 3. Google Drive

```
CouponWallet/                 ← สร้างครั้งเดียว, เก็บ folderId ใน Config
└── 2026/
    └── 10/
        ├── CPN-261031-001.jpg
        └── CPN-261031-002.png
```

| หัวข้อ | แนวปฏิบัติ |
|---|---|
| ชื่อไฟล์ | `{couponId}.{ext}` — กันชื่อชนและค้นหาง่าย |
| นามสกุล | เก็บตามต้นฉบับ (jpg/png/webp) หลังแปลง HEIC |
| สิทธิ์ | `ANYONE_WITH_LINK` + `VIEW` (ลิงก์สุ่มเดายาก) — ทางเลือกที่ปลอดภัยกว่าคือ proxy ผ่าน API แต่ช้ากว่า |
| ขนาด | ไฟล์ที่เก็บ ≤ 2 MB, ด้านยาวสุด ≤ 1,280 px (WebP q≈0.82 หรือ JPEG) |
| ลบ | ลบเฉพาะเมื่อผู้ใช้ยืนยัน "ลบถาวร" (นอก scope MVP) |
| naming collision | ตรวจก่อนสร้าง ถ้ามีอยู่แล้วให้เติม `-2` |

---

## 4. TypeScript Types (ใช้ร่วม client/API)

```ts
export type CouponStatus = 'unused' | 'used';
export type QrType = 'url' | 'plain_code' | 'json' | 'unknown';
export type CouponSource = 'upload' | 'paste' | 'share' | 'manual';
export type ImageStatus = 'ok' | 'pending' | 'missing';

export interface Coupon {
  couponId: string;
  /** เจ้าของคูปอง — ใช้แยกข้อมูลตาม /user/{userId} */
  userId: string;
  title: string;
  merchant?: string;
  discountText?: string;
  description?: string;
  couponCode?: string;
  qrRawValue?: string;
  qrType?: QrType;
  expiryDate?: string;      // YYYY-MM-DD
  status: CouponStatus;
  imageFileId?: string;
  imageUrl?: string;
  imageStatus: ImageStatus;
  ocrTextRaw?: string;
  ocrConfidence?: number;
  note?: string;
  source: CouponSource;
  duplicateOf?: string;
  createdAt: string;        // ISO 8601 +07:00
  updatedAt: string;
  usedAt?: string;
  deletedAt?: string;
  notifiedAt?: string;
}

// ฟิลด์ที่ client ส่งได้ตอนสร้าง/แก้ไข
export type CouponWriteInput = Pick<Coupon,
  | 'title' | 'merchant' | 'discountText' | 'description' | 'couponCode'
  | 'qrRawValue' | 'qrType' | 'expiryDate' | 'note' | 'source'
> & { duplicateOf?: string };

export interface UsageLog {
  logId: string;
  couponId: string;
  action: 'created' | 'updated' | 'marked_used' | 'undo_used' | 'deleted' | 'restored';
  fromStatus?: CouponStatus;
  toStatus?: CouponStatus;
  at: string;
  metadata?: Record<string, unknown>;
}
```

---

## 5. API Contract

### 5.1 ชั้นการเรียก

```
Browser ──(same-origin, JSON)──> Next.js Route Handlers ──(POST + token)──> Apps Script Web App
```

- ทุก request ไป Apps Script เป็น `POST` + `Content-Type: application/json` (เลี่ยงปัญหา CORS/preflight ของ Apps Script)
- **Token:** Apps Script `doPost` ไม่สามารถอ่าน custom header ได้ จึงส่ง `token` ใน JSON body (และแนบ header `X-Coupon-Token` ไว้เผื่ออนาคต) — ค่า secret เก็บใน env ฝั่ง Next.js เท่านั้น
- Body: `{ "action": "...", "requestId": "...", "token": "<SHARED_SECRET>", "payload": { ... } }`
- Response envelope เดียวกันทุก action:

```json
{ "ok": true, "data": { }, "requestId": "req_9f2c" }
```

```json
{ "ok": false, "error": { "code": "VALIDATION_ERROR", "message": "ชื่อคูปองต้องไม่ว่าง", "fields": { "title": "required" } }, "requestId": "req_9f2c" }
```

### 5.2 Apps Script Actions

| Action | Payload | คืนค่า | หมายเหตุ |
|---|---|---|---|
| `ping` | – | `{status, schemaVersion, serverTime}` | health check |
| `createCoupon` | `userId` + `CouponWriteInput` + `imageBase64`, `imageMimeType` | `{coupon}` | atomic: Drive → Sheets; ล้มเหลว = ลบไฟล์ |
| `listCoupons` | `{userId, status?, q?, limit?}` | `{items, total}` | เห็นเฉพาะคูปองของ userId |
| `getCoupon` | `{couponId, userId}` | `{coupon}` | ไม่ใช่เจ้าของ → `NOT_FOUND` |
| `getSharedCoupon` | `{couponId}` | `{coupon}` | สำหรับหน้า `/share/{couponId}` — อ่านอย่างเดียว ไม่ต้องมี userId |
| `updateCoupon` | `{couponId, userId, patch}` | `{coupon}` | เฉพาะ field ที่อนุญาต; เปลี่ยนเจ้าของไม่ได้ |
| `markUsed` | `{couponId, userId}` | `{coupon}` | ต้องเป็นเจ้าของ; `status=unused` |
| `undoUsed` | `{couponId, userId}` | `{coupon}` | ต้องเป็นเจ้าของ; `status=used` |
| `deleteCoupon` | `{couponId, userId}` | `{coupon}` | soft delete |
| `listHistory` | `{couponId, userId}` | `{logs}` | เฉพาะเจ้าของ/แอดมิน |

### 5.3 Next.js Routes (BFF)

| Method | Path | ทำอะไร | Auth |
|---|---|---|---|
| `GET` | `/api/health` | ตรวจการเชื่อมต่อ Apps Script | – |
| `GET` | `/api/coupons?userId=&status=&q=&limit=` | รายการของ userId | `userId` |
| `POST` | `/api/coupons` | สร้าง (body ต้องมี `userId`) | `userId` |
| `GET` | `/api/coupons/:id?userId=` | รายละเอียด | `userId` |
| `PATCH` | `/api/coupons/:id?userId=` | แก้ไข | `userId` |
| `POST` | `/api/coupons/:id/use?userId=` | mark used | `userId` |
| `POST` | `/api/coupons/:id/undo-use?userId=` | undo | `userId` |
| `DELETE` | `/api/coupons/:id?userId=` | soft delete | `userId` |
| `GET` | `/api/coupons/:id/history?userId=` | log | `userId` |

**ตัวอย่าง — สร้างคูปอง**

```http
POST /api/coupons
Content-Type: application/json
Idempotency-Key: 5b1c2f4a-...

{
  "userId": "tar",
  "title": "Shopee — ลด 50 บาท",
  "merchant": "Shopee",
  "discountText": "ลด 50 บาท ขั้นต่ำ 300",
  "description": "ใช้ได้กับสินค้าทุกหมวด",
  "couponCode": "SAVE50",
  "qrRawValue": "https://s.shopee.co.th/abc123",
  "qrType": "url",
  "expiryDate": "2026-12-31",
  "source": "upload",
  "imageBase64": "/9j/4AAQSkZJRg...",
  "imageMimeType": "image/jpeg"
}
```

```json
HTTP/1.1 201 Created
{
  "ok": true,
  "data": {
    "coupon": {
      "couponId": "CPN-261031-001",
      "userId": "tar",
      "title": "Shopee — ลด 50 บาท",
      "status": "unused",
      "imageUrl": "https://drive.google.com/file/d/1AbC.../view",
      "imageStatus": "ok",
      "createdAt": "2026-10-31T14:05:00+07:00",
      "updatedAt": "2026-10-31T14:05:00+07:00"
    }
  },
  "requestId": "req_9f2c"
}
```

### 5.4 Error Codes

| code | HTTP (BFF) | ความหมาย | UI |
|---|---|---|---|
| `VALIDATION_ERROR` | 400 | ฟิลด์ไม่ผ่าน validation | ไฮไลต์ฟิลด์ |
| `UNAUTHORIZED` | 401 | token ผิด/หมดอายุ | ให้ตั้งค่าใหม่ |
| `NOT_FOUND` | 404 | ไม่พบ couponId | กลับรายการ |
| `INVALID_STATE` | 409 | เช่น markUsed คูปองที่ used แล้ว | รีเฟรชข้อมูล |
| `DRIVE_UPLOAD_FAILED` | 502 | อัปโหลดรูปไม่สำเร็จ | ลองใหม่ (ข้อมูลฟอร์มคงอยู่) |
| `SHEET_WRITE_FAILED` | 502 | เขียน Sheets ไม่สำเร็จ | ลองใหม่ |
| `DUPLICATE_IDEMPOTENCY` | 200 | request ซ้ำ คืนผลเดิม | ไม่ต้องแจ้ง |
| `RATE_LIMITED` | 429 | เกิน quota | แจ้งรอแล้วลองใหม่ |
| `UPSTREAM_TIMEOUT` | 504 | Apps Script ไม่ตอบ | ลองใหม่ + สำรองข้อมูลฟอร์ม |
| `INTERNAL_ERROR` | 500 | อื่น ๆ | แจ้ง + requestId |

### 5.5 กติกา Validation (ใช้ทั้ง client และ server)

| Field | กติกา |
|---|---|
| `title` | required, trim แล้ว 1–100 |
| `merchant` | ≤ 50 |
| `discountText` | ≤ 80 |
| `description` | ≤ 100 |
| `couponCode` | ≤ 100, trim |
| `qrRawValue` | ≤ 2,000 |
| `expiryDate` | `YYYY-MM-DD`, ปี 2000–2100 |
| `imageBase64` | ≤ 2 MB decoded, MIME ใน `image/jpeg,image/png,image/webp` |
| `note` | ≤ 300 |
| ข้อความทั้งหมด | ตัด control char, เติม `'` ถ้าขึ้นต้นด้วย `= + - @` |

---

## 6. Apps Script Implementation Notes

1. **Secret** — เก็บ `SHARED_SECRET` ใน Script Properties; เทียบแบบ constant-time
2. **Lock** — `LockService.getScriptLock()` + `tryLock(10000)` ครอบ create/update/mark/undo/delete
3. **couponId** — `CacheService` ไม่เหมาะกับการนับ; อ่านแถวสุดท้ายของวันแล้ว +1 ภายใต้ lock (หรือใช้ `PropertiesService` เก็บ seq ต่อวัน)
4. **Append row** — ใช้ `sheet.appendRow()`; เขียน `setValues` ทีละแถวเพื่อลด call
5. **Drive** — `Utilities.base64Decode`, `folder.createFile(blob)`; ตั้ง permission หลังสร้าง
6. **Rollback** — ถ้า `appendRow` throw ให้ `file.setTrashed(true)`
7. **Idempotency** — `CacheService.getScriptCache().get(key)` เก็บ response JSON 6 ชั่วโมง (ข้อจำกัดของ cache); ถ้าต้องการนานกว่านั้นให้เพิ่มชีต `Idempotency` (Phase 2)
8. **Timezone** — `Session.getScriptTimeZone()` ตั้งเป็น `Asia/Bangkok` ใน `appsscript.json`
9. **Logging** — `console.log` + เขียน `ErrorLog` เฉพาะ error (ประหยัด quota)
10. **Deploy** — Web App, execute as owner, access "Anyone" (ป้องกันด้วย token), ใช้ `/exec` URL

---

## 7. โครงสร้างโปรเจกต์จริง

```
coupon/
├── docs/                       ← เอกสารชุดนี้
├── app/                        ← Next.js App Router
│   ├── page.tsx                ← S-09 สร้าง QR/บาร์โค้ด (หน้าแรก)
│   ├── qr/page.tsx      ← ลิงก์แชร์ ?text=
│   ├── user/page.tsx           ← S-07 พิมพ์ id
│   ├── user/[id]/page.tsx      ← S-01 รายการ
│   ├── user/[id]/new/          ← S-02
│   ├── user/[id]/coupons/[id]/ ← S-03 / S-04 / S-05 / S-06
│   └── api/…                   ← BFF routes
├── components/                 ← UI + QrTabs + CouponCard + AdminGroups
├── lib/
│   ├── ocr.ts                  ← Tesseract worker wrapper
│   ├── qr.ts                   ← jsQR + ZXing fallback
│   ├── parser.ts               ← auto naming, date parsing, duplicate normalize
│   ├── validation.ts           ← shared zod schemas
│   ├── user.ts                 ← normalize userId
│   └── store/gas.ts            ← เรียก Apps Script + envelope handling
├── scripts/gas/                ← Code.gs, Sheets.gs, Drive.gs, appsscript.json
└── tests/                      ← unit test ของ parser/validation
```

### Environment Variables

| ตัวแปร | ใช้ที่ | ตัวอย่าง |
|---|---|---|
| `GAS_WEB_APP_URL` | server | `https://script.google.com/macros/s/AKfy…/exec` |
| `GAS_SHARED_SECRET` | server | สุ่ม 32+ ตัวอักษร |
| `APP_ACCESS_PIN` | server (optional) | PIN สำหรับ MVP |
| `NEXT_PUBLIC_NEAR_EXPIRY_DAYS` | client | `3` |

> ห้ามใช้ prefix `NEXT_PUBLIC_` กับ secret

---

## 8. ตัวอย่างข้อมูลจริงในชีต

| couponId | title | merchant | discountText | couponCode | qrRawValue | qrType | expiryDate | status | imageUrl | createdAt | usedAt |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CPN-261031-001 | Shopee — ลด 50 บาท | Shopee | ลด 50 บาท ขั้นต่ำ 300 | SAVE50 | https://s.shopee.co.th/abc123 | url | 2026-12-31 | unused | https://drive.google.com/… | 2026-10-31T14:05:00+07:00 | |
| CPN-261031-002 | GrabFood — 1 แถม 1 | GrabFood | 1 แถม 1 | | GRAB1FREE | plain_code | 2026-11-05 | used | https://drive.google.com/… | 2026-10-31T15:10:00+07:00 | 2026-11-01T12:00:00+07:00 |

---

## 9. Migration / Extensibility

- เพิ่มฟิลด์ใหม่ → เพิ่มคอลัมน์ท้ายชีต + bump `schemaVersion` + อัปเดต type (ไม่ต้องย้ายข้อมูล)
- ย้ายฐานข้อมูลในอนาคต (เกิน ~10,000 แถว) → คง API contract เดิม เปลี่ยนเฉพาะ adapter ใน Apps Script
- Phase 2 (Share Target) → ใช้ `createCoupon` เดิม ส่ง `source = "share"` ไม่ต้องแก้ schema
- Phase 2 (แจ้งเตือน) → เพิ่ม `notifiedAt` ที่มีอยู่แล้ว + scheduled trigger รายวัน

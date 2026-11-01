# Setup & Operations — Coupon Wallet

| รายการ | รายละเอียด |
|---|---|
| เวอร์ชัน | 1.0 |
| วันที่ | 31 ตุลาคม 2026 |
| ใช้กับ | MVP Phase 1 (โค้ดในโปรเจกต์นี้) |
| เอกสารอ้างอิง | `01-BRD.md`, `03-data-model-and-api.md` |

---

## 1. สิ่งที่ต้องมี

| รายการ | เวอร์ชัน/หมายเหตุ |
|---|---|
| Node.js | 22.12 ขึ้นไป (แนะนำ 24 LTS; พัฒนา/ทดสอบด้วย 25.x) |
| npm | 10 ขึ้นไป |
| บัญชี Google | สำหรับโหมด production (Sheets + Drive + Apps Script) |
| เบราว์เซอร์ | Chrome / Safari / Edge รุ่นล่าสุด (Safari 17+) |

---

## 2. เริ่มใช้งานโหมดทดลอง (ไม่ต้องมี Google)

```bash
cd /Users/tar/develop/coupon
npm install
npm run dev
# เปิด http://localhost:3000
```

- ไม่ต้องตั้งค่า env ใด ๆ — ระบบจะใช้ **demo mode**
- ข้อมูลเก็บที่ `.data/db.json`, รูปอยู่ที่ `.data/uploads/`
- มีคูปองตัวอย่าง 4 ใบ (Shopee / GrabFood / Starbucks / Lazada) ให้เห็นผลกรองและ badge
- รีเซ็ตข้อมูล: หยุดเซิร์ฟเวอร์ → `rm -rf .data` → เริ่มใหม่ (จะ seed ให้อัตโนมัติ)
- ถ้า `npm run dev` ล้มเหลวด้วย `unable to start FSEvent stream` (พบใน sandbox/macOS บางเครื่อง) ให้ใช้ `npm run dev:webpack`

**Production build:**

```bash
npm run build
npm start          # http://localhost:3000
```

> ⚠️ บน Vercel/Serverless ไฟล์ `.data` ไม่คงอยู่ถาวร — ถ้าจะใช้งานจริงต้องตั้งค่าโหมด Google ด้านล่าง

---

## 3. ตั้งค่าโหมด Google Sheets + Drive (production)

### 3.1 สร้าง Spreadsheet

1. เปิด [Google Sheets](https://sheets.new) สร้างไฟล์ใหม่ชื่อ `CouponWallet`
2. เปลี่ยนชื่อแท็บแรกเป็น `Coupons` (ชื่อต้องตรงเป๊ะ)
3. ไม่ต้องสร้างแท็บอื่น — สคริปต์จะสร้าง `UsageHistory`, `Config`, `ErrorLog` ให้เอง

> สคริปต์ต้องเป็น **bound script** (สร้างจากเมนู Extensions ของ spreadsheet นี้) เพื่อให้สร้างแท็บและอ่านไฟล์ได้อัตโนมัติ

### 3.2 ติดตั้ง Apps Script

1. ใน spreadsheet → **Extensions → Apps Script**
2. ตั้งชื่อโปรเจกต์ `Coupon Wallet API`
3. ลบโค้ดใน `Code.gs` แล้ววางไฟล์ทั้ง 4 จากโฟลเดอร์ `scripts/gas/`:
   - `Code.gs`
   - `Sheets.gs`
   - `Drive.gs`
   - `Utils.gs`
   (สร้างไฟล์ใหม่ด้วยปุ่ม `+ → Script` ตามชื่อ)
4. เปิด **Project Settings → Show `appsscript.json` manifest file** แล้วแทนที่ด้วยเนื้อหาจาก [`scripts/gas/appsscript.json`](../scripts/gas/appsscript.json)
5. ที่ **Project Settings → Script properties** เพิ่ม:
   - Key: `SHARED_SECRET`
   - Value: สตริงสุ่มยาว ๆ เช่นสร้างด้วย `openssl rand -hex 32`
6. กด Save (Ctrl/Cmd + S)

### 3.3 Deploy เป็น Web App

1. **Deploy → New deployment**
2. เลือก type: **Web app**
3. Description: `v1`
4. **Execute as:** `Me (your-email)`
5. **Who has access:** `Anyone`
6. กด **Deploy** → อนุญาตสิทธิ์ (ครั้งแรกจะมีหน้า consent ให้กด Advanced → Go to project)
7. คัดลอก **Web app URL** ที่ลงท้ายด้วย `/exec`

> **อัปเดตโค้ด Apps Script ภายหลัง:** วางไฟล์ใหม่ทั้ง 4 แล้วไปที่ **Deploy → Manage deployments → เลือก deployment → Edit → Version: New version → Deploy** (URL `/exec` เดิมไม่เปลี่ยน) — ถ้าไม่สร้าง version ใหม่ เว็บจะยังเรียกโค้ดเก่าและ action ใหม่อย่าง `createShare`/`getShare` จะตอบ `VALIDATION_ERROR`

**ทดสอบเร็ว ๆ ด้วย curl:**

```bash
curl -s -X POST 'https://script.google.com/macros/s/AKfy.../exec' \
  -H 'Content-Type: application/json' \
  -d '{"action":"ping","payload":{},"token":"YOUR_SHARED_SECRET"}'
```

ต้องได้ `{"ok":true,"data":{"status":"ok",...}}`

> Apps Script ไม่สามารถอ่าน custom header ได้ → token จึงส่งมาใน JSON body (ดู `03-data-model-and-api.md` §5)

### 3.4 ตั้งค่า env ฝั่งเว็บ

สร้าง `.env.local` (คัดลอกจาก `.env.example`):

```env
GAS_WEB_APP_URL=https://script.google.com/macros/s/AKfy.../exec
GAS_SHARED_SECRET=<ค่าเดียวกับ Script Property>
NEXT_PUBLIC_NEAR_EXPIRY_DAYS=3
```

รีสตาร์ทเซิร์ฟเวอร์ แล้วตรวจ:

```bash
curl -s http://localhost:3000/api/health
```

ต้องเห็น `"mode":"gas"` และ `"stats"` ไม่เป็น `null`

### 3.5 ตรวจว่าเขียนข้อมูลจริง

1. เปิดเว็บ → เพิ่มคูปอง 1 ใบ (ต้องมีรูป)
2. ตรวจแท็บ `Coupons` → มีแถวใหม่ ครบทุกคอลัมน์
3. ตรวจแท็บ `UsageHistory` → มี log `created`
4. เปิดโฟลเดอร์ Drive `CouponWallet/YYYY/MM/` → มีไฟล์ `CPN-....jpg`
5. กดใช้คูปอง → แถวเดิมเปลี่ยน `status = used`, `usedAt` มีค่า, มี log `marked_used`

### 3.6 การอัปเดตโค้ด Apps Script

หลังแก้ `.gs` ต้องสร้างเวอร์ชันใหม่:

**Deploy → Manage deployments → ไอคอนดินสอ → Version: New version → Deploy**

ถ้าไม่ทำ `/exec` จะยังรันโค้ดเก่า

---

## 4. Deploy ขึ้น Vercel (หรือเซิร์ฟเวอร์อื่น)

1. Push โปรเจกต์ขึ้น Git แล้ว import เข้า Vercel
2. ตั้ง Environment Variables:
   - `GAS_WEB_APP_URL`
   - `GAS_SHARED_SECRET`
   - `NEXT_PUBLIC_NEAR_EXPIRY_DAYS` (optional)
3. Deploy
4. ตรวจ `/api/health` ว่า `mode = gas`

**ข้อควรระวังบน Vercel**

| เรื่อง | รายละเอียด |
|---|---|
| Request body limit | ราว 4.5 MB — รูปถูกย่อฝั่ง client เหลือ ~0.15–0.6 MB จึงปกติ |
| ไฟล์ `.data` | ไม่ถาวร — ห้ามใช้ demo mode บน production |
| Idempotency | เก็บใน memory ของ instance (10 นาที) — เพียงพอสำหรับ MVP แต่ไม่ข้าม instance |
| Timeout | Apps Script cold start อาจ 2–5 วินาที — ตั้ง timeout ฝั่ง Vercel อย่างน้อย 60 วินาที |

---

## 4.1 หลายผู้ใช้ (userId)

- กระเป๋าคูปองอยู่ที่ `/user/{id}` — id ตั้งเอง (`a-z 0-9 - _`, 2–30 ตัว)
- ข้อมูลแยกตาม `userId`; API ทุกตัวต้องมี `userId`
- ชีต `Coupons` มีคอลัมน์ `userId` (X) ต่อท้าย — สคริปต์จะเติมหัวตารางให้ชีตเก่าอัตโนมัติ
- ข้อมูลเก่าที่ไม่มี `userId` จะถูกมองเป็น id `legacy` (เข้าที่ `/user/legacy`)

---

## 5. ความปลอดภัยที่ต้องรู้

1. **ยังไม่มีระบบ login** (Open item O-01) — ใครรู้ `userId` ก็เข้าถึงกระเป๋าของ id นั้นได้
   - ก่อนใช้งานจริงบนอินเทอร์เน็ต ควรมี PIN/Google Login
   - ระหว่างนี้แนะนำ: deploy บนเครื่องตัวเอง/เครือข่ายส่วนตัว หรือใช้ Vercel Protection
2. `GAS_SHARED_SECRET` อยู่ฝั่ง server เท่านั้น (ไม่ขึ้นต้นด้วย `NEXT_PUBLIC_`)
3. Spreadsheet ไม่ต้องแชร์แบบสาธารณะ — Apps Script รันในนามเจ้าของ
4. รูปใน Drive ถูกตั้งเป็น “ใครมีลิงก์ดูได้” เพื่อให้ `<img>` แสดงผลได้ — ถ้าองค์กรบล็อก ลิงก์จะเปิดได้เฉพาะเจ้าของ/ผู้มีสิทธิ์
5. ระบบกัน formula injection โดยเติม `'` ก่อนอักขระ `= + - @` และตัดออกตอนอ่านกลับ
6. รูป/ข้อความประมวลผลในเบราว์เซอร์ (Tesseract/jsQR) ไม่ส่งออก third-party; ส่งขึ้นระบบเมื่อกดบันทึกเท่านั้น

---

## 6. การดูแลรักษา

| งาน | วิธี |
|---|---|
| สำรองข้อมูล | File → Make a copy ของ spreadsheet เดือนละครั้ง + เก็บโฟลเดอร์ Drive |
| ดู error | แท็บ `ErrorLog` (timestamp, requestId, action, code, message) |
| หมุน token | เปลี่ยน Script Property + env แล้ว redeploy ทั้งสองฝั่ง |
| ลบคูปองถาวร | MVP เป็น soft delete; ลบแถว/ไฟล์เองใน Sheets/Drive เมื่อต้องการจริง |
| เก็บรูป | ตาม BRD RULE-13 เก็บตลอดอายุคูปอง + 1 ปี (ยังไม่ auto-delete) |
| Quota | Apps Script/Sheets มี quota รายวันตามบัญชี Google — ใช้งานส่วนตัวไม่ถึง limite; ถ้าเริ่มช้าที่หลักพันแถว พิจารณาย้าย DB |

---

## 7. ทดสอบและตรวจคุณภาพ

```bash
npm run typecheck   # TypeScript
npm test            # 111 tests (parser/validation/filter/format + Apps Script harness)
npm run build       # production build
npm run check       # ทั้งสามอย่างรวดเดียว
```

- **Baseline OCR/QR:** เปิด `/baseline` อัปโหลดรูปจริง 20–30 ใบ แล้วคัดลอกผล JSON ไปแนบ BRD
- **UAT:** ใช้ checklist §12 ใน `04-acceptance-criteria.md`
- **Apps Script test harness:** `tests/gas.test.ts` โหลด `.gs` เข้า VM พร้อม mock Sheets/Drive — ตรวจ logic ได้โดยไม่ต้อง deploy จริง (ไม่ได้แทนการทดสอบกับ Google จริง)

---

## 8. Troubleshooting

| อาการ | สาเหตุที่พบบ่อย | วิธีแก้ |
|---|---|---|
| `/api/health` ยังเป็น `demo` | ยังไม่ตั้ง env หรือยังไม่รีสตาร์ท | ตรวจ `.env.local`, รีสตาร์ท `npm run dev` |
| `UNAUTHORIZED` | secret ไม่ตรงกัน | เทียบ Script Property กับ env |
| 502 / `INTERNAL_ERROR` จาก Apps Script | URL ผิด, ยังไม่อนุญาตสิทธิ์, access ไม่ใช่ Anyone | เปิด `/exec` ในเบราว์เซอร์แล้ว authorize, ตรวจ deployment |
| เพิ่มคูปองแล้วไม่มีแถวใน Sheets | สคริปต์ไม่ได้ผูกกับ spreadsheet | สร้างสคริปต์จาก Extensions ของไฟล์นั้น |
| รูปไม่แสดง (โหมด gas) | Drive block link sharing | เปิดสิทธิ์หรือดูรูปผ่านหน้า Drive โดยตรง |
| OCR ค้าง/ช้ามากครั้งแรก | ต้องโหลดภาษา ~20 MB จาก CDN | รอ หรือใช้เน็ตที่ดีขึ้น; ครั้งถัดไปเร็วขึ้น |
| OCR ภาษาไทยแม่นต่ำ | ฟอนต์/พื้นหลัง/ตัวเล็ก | ใช้ `/baseline` วัด; crop รูป; พิจารณา cloud OCR Phase 2 |
| HEIC อัปโหลดไม่ได้ | Chrome ไม่ decode HEIC | ตั้ง iPhone เป็น “Most Compatible” หรือแคปเจอร์ใหม่เป็น JPG |
| `unable to start FSEvent stream` ตอน dev | Turbopack watcher ถูกจำกัด | `npm run dev:webpack` |
| 413 Request Entity Too Large | รูปใหญ่เกิน limit ของ host | ลดขนาดรูป/ลด `MAX_EDGE` |
| คูปองซ้ำเตือนทั้งที่ตั้งใจ | QR/รหัสซ้ำจริง | กดบันทึกต่อได้ ระบบจะเก็บ `duplicateOf` |
| เข้า `/user/{id}` แล้วไม่เห็นคูปอง | id ไม่ตรง (ตัวพิมพ์/คนละ id) | id ถูก normalize เป็นตัวพิมพ์เล็ก; ตรวจ path |

---

## 9. โครงสร้างที่ติดตั้งแล้ว

```
coupon/
├── app/                  หน้าเว็บ + API routes (BFF)
├── components/           UI (list, review, QR, actions, baseline)
├── lib/                  OCR, QR, parser, validation, store (demo/gas)
├── scripts/gas/          Backend สำหรับ Google Apps Script 4 ไฟล์
├── tests/                111 unit/integration tests (mock GAS)
├── docs/                 BRD + Flow + Data/API + AC + Setup
└── .data/                ข้อมูล demo (ถูก ignore โดย git)
```

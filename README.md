# Coupon Wallet

เว็บสำหรับ **สร้าง QR/บาร์โค้ดจากข้อความ** และ **เก็บคูปองแยกตาม user id** — หน้าแรกคือเครื่องมือสร้าง QR, กระเป๋าคูปองอยู่ที่ `/user/{id}`

**สถานะ: MVP implemented** — มี 3 ส่วน: หน้าสร้าง QR (หลัก), กระเป๋าคูปองหลาย user, และโหมดง่ายแบบไฟล์เดียว

---

## หน้าแรกและเส้นทาง

| หน้า | ใช้ทำอะไร |
|---|---|
| `/` | **หน้าหลัก: สร้าง QR / บาร์โค้ดจากข้อความ** (ไม่บันทึกข้อมูล) |
| `/qr?text=...` | ลิงก์แชร์ของหน้าสร้าง QR (เปิดแล้วสร้างโค้ดทันที) |
| `/lottery` | **เพิ่มเลขซื้อหวย** — กรอกเลข 3/2 ตัว, OCR เลขอั้นจากรูป, สรุปโพย |
| `/user` | พิมพ์ id เพื่อเข้ากระเป๋าคูปอง |
| `/user/{id}` | กระเป๋าคูปองของ id นั้น (ข้อมูลแยกกัน) |
| `/simple.html` | โหมดง่าย เก็บรูปอย่างเดียวในเบราว์เซอร์ |

id ตั้งเองได้: `a-z`, `0-9`, `-`, `_` ยาว 2–30 ตัว (เช่น `tar`, `demo`)

> ⚠️ ยังไม่มีระบบล็อกอิน — ใครรู้ id ก็เข้าถึงข้อมูลของ id นั้นได้ แต่จะเห็นเฉพาะคูปองของ id ตัวเอง

---

## เริ่มใช้งานเร็ว

```bash
npm install
npm run dev
```

เปิด:

```
http://localhost:3000/                  → สร้าง QR / บาร์โค้ด
http://localhost:3000/user              → เข้ากระเป๋าคูปอง
http://localhost:3000/user/tar          → ตัวอย่าง user tar (3 ใบ)
http://localhost:3000/user/demo         → ตัวอย่าง user demo (2 ใบ)
http://localhost:3000/simple.html       → โหมดง่าย
```

ไม่ต้องตั้งค่าใด ๆ — โหมดเต็มจะรันใน **demo mode** เก็บข้อมูลที่ `.data/` พร้อมคูปองตัวอย่าง 5 ใบ (tar 3, demo 2)

เชื่อม Google Sheets + Drive จริง: ดู [`docs/05-setup.md`](docs/05-setup.md)

> ถ้า `npm run dev` เจอ `unable to start FSEvent stream` ให้ใช้ `npm run dev:webpack`

---

## ฟีเจอร์ที่ทำแล้ว

| ฟีเจอร์ | รายละเอียด |
|---|---|
| สร้าง QR/บาร์โค้ด | `/` พิมพ์ข้อความ, `/qr?text=...` เปิดแล้วเห็นโค้ดเลย (ซ่อนช่องกรอก + ปุ่มสร้างใหม่), คัดลอก/แชร์, ไม่บันทึกข้อมูล |
| หลายผู้ใช้ | เก็บแยกตาม `userId`, เข้าที่ `/user/{id}`, id ตั้งเอง — เห็นเฉพาะของตัวเอง |
| เพิ่มคูปอง | อัปโหลด / ลากวาง / วางจาก clipboard (⌘V) / **ถ่ายรูป**, 1 รูป = 1 คูปอง |
| QR Reader | jsQR ก่อน → ZXing fallback (QR เอียง/เบลอ + บาร์โค้ด) |
| OCR | Tesseract.js ไทย+อังกฤษ ฝั่ง browser + progress/confidence |
| Auto naming | ใช้ `description` จาก OCR เป็นชื่อ ตัดอักขระพิเศษ + เดารหัส/วันหมดอายุ |
| Review & Edit | ตรวจ/แก้ทุกช่องก่อนบันทึก และแก้ภายหลังพร้อม log diff |
| บันทึกข้อมูล | Google Sheets + Drive ผ่าน Apps Script หรือ `.data` ใน demo |
| รายการคูปอง | ค้นหา, กรอง 5 แบบ, ค่าเริ่มต้น **list**, สลับ grid 2 คอลัมน์, โลโก้กลับกระเป๋าล่าสุด |
| ใช้คูปอง | 3 แท็บ: เลข QR / บาร์โค้ด Code 128 / QR + คัดลอก/เต็มหน้าจอ |
| Undo / History | ใช้แล้ว ↔ ยังไม่ใช้ พร้อม timeline ทุก action |
| ความปลอดภัยข้อมูล | soft delete, duplicate warning, expiry warning, formula-injection guard |
| ตรวจภาษา | คุณภาพข้อความ + ไฮไลต์คำน่าสงสัย (ไทย) ไม่แก้ให้อัตโนมัติ |
| แชร์คูปอง | `/share/{couponId}` เปิดได้โดยไม่ต้องมี user, อ่านอย่างเดียว, มีปุ่มแชร์ในรายละเอียด/QR |
| เพิ่มเลขซื้อหวย | `/lottery` — กรอกเลข 3/2 ตัว พร้อมราคาต่อฝั่ง (30 → 30x30, รวม 60 บาทบน+ล่าง), กลับเลข, OCR เลขอั้นจากรูป, เตือน “จ่ายครึ่ง”, เลือกส่วนลด 0–25%, สรุป/คัดลอก/แชร์ลิงก์ JSON และเก็บฉบับร่างในเบราว์เซอร์ |

---

## เทคโนโลยี

| ส่วน | ใช้จริง |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | CSS design system — **mobile-only** (กว้างสุด 480 px) |
| OCR | Tesseract.js 7 (`tha+eng`) ฝั่ง browser |
| QR/Barcode | jsQR + @zxing/library, `qrcode`, `jsbarcode` (Code 128) |
| Backend | Next.js Route Handlers (BFF) |
| Data | Google Apps Script → Sheets + Drive / `.data` demo |
| Validation | Zod 4 |
| Test | Vitest 5 — 111 tests รวม Apps Script harness |

---

## โครงสร้างโปรเจกต์

```
coupon/
├── app/
│   ├── page.tsx                     หน้าสร้าง QR (หลัก)
│   ├── qr/                          ลิงก์แชร์ + searchParams
│   ├── user/page.tsx                พิมพ์ id
│   ├── user/[id]/                   กระเป๋า + เพิ่มคูปอง
│   ├── user/[id]/coupons/[id]/      detail / edit / qr / history
│   ├── baseline/                    วัด OCR/QR
│   └── api/                         coupons, images, health
├── components/                      UI + QR tabs + barcode
├── lib/                             parser, OCR, QR, store, user, validation
├── scripts/gas/                     Code.gs, Sheets.gs, Drive.gs, Utils.gs
├── tests/                           parser, validation, GAS mock, user, QR
├── docs/                            BRD, flow, API, AC, setup, simple, create
└── .data/                           ข้อมูล demo (git ignore)
```

---

## เอกสาร

| ไฟล์ | เนื้อหา |
|---|---|
| [`docs/01-BRD.md`](docs/01-BRD.md) | BRD: ขอบเขต, FR, business rules, NFR |
| [`docs/02-business-flow.md`](docs/02-business-flow.md) | Business Flow + screen inventory |
| [`docs/03-data-model-and-api.md`](docs/03-data-model-and-api.md) | Sheets schema (มี `userId`), API contract |
| [`docs/04-acceptance-criteria.md`](docs/04-acceptance-criteria.md) | AC, test cases, UAT |
| [`docs/05-setup.md`](docs/05-setup.md) | ติดตั้ง, deploy Apps Script, env, Vercel |
| [`docs/06-simple-mode.md`](docs/06-simple-mode.md) | โหมดง่ายเก็บรูปอย่างเดียว |
| [`docs/07-create-text.md`](docs/07-create-text.md) | สร้าง QR/บาร์โค้ดจากข้อความ + ลิงก์แชร์ |
| [`docs/08-users.md`](docs/08-users.md) | user id และการแยกข้อมูล |
| [`docs/09-storage.md`](docs/09-storage.md) | การเก็บรูปให้ประหยัดพื้นที่ |
| [`docs/10-language-check.md`](docs/10-language-check.md) | ตรวจคุณภาพภาษา/คำน่าสงสัยจาก OCR |

---

## คำสั่งที่ใช้บ่อย

```bash
npm run dev           # dev
npm run dev:webpack   # dev (webpack) ถ้า watcher มีปัญหา
npm run build         # production build
npm start             # รัน production
npm test              # 111 tests
npm run typecheck     # TypeScript
npm run check         # typecheck + test + build
```

---

## ข้อจำกัดที่รู้อยู่

1. **ยังไม่มี login** — id เป็นเพียง path; ใครรู้ id ก็เข้าถึงคูปองของ id นั้น (เห็นเฉพาะของ id ตัวเอง)
2. id ตั้งเอง ไม่มีระบบกู้คืน/เปลี่ยน id
3. 1 รูป = 1 คูปอง
4. Idempotency เก็บใน memory ของ instance (10 นาที)
5. Share Target และแจ้งเตือนหมดอายุเป็น Phase 2
6. โหมด demo บน Vercel ไม่ถาวร — production ใช้โหมด Google
7. OCR ภาษาไทยควรวัด baseline ที่ `/baseline` ก่อนสรุปผล
8. ลิงก์ `/share/{couponId}` เปิดได้ด้วย couponId — ID เป็นลำดับรายวัน อาจเดาได้ ควรแชร์เฉพาะกับคนที่ต้องการ

---

## ถัดไป

1. วัด baseline OCR/QR ด้วยรูปจริง 20–30 ใบ
2. ถ้าจะเปิด public: เพิ่ม auth จริงผูกกับ userId
3. UAT ตาม `docs/04-acceptance-criteria.md`
4. Phase 2: Share Target, expiry reminder

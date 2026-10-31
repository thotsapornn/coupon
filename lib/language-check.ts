/**
 * ตรวจคุณภาพข้อความ description จาก OCR แบบ heuristic (ไม่เรียกบริการภายนอก)
 * เป้าหมาย: ชี้ “คำที่ควรตรวจ” ไม่ใช่แก้ข้อความอัตโนมัติ
 */

export type LanguageLevel = 'good' | 'check' | 'poor';

export interface LanguageFlag {
  word: string;
  reason: string;
}

export interface LanguageCheckResult {
  score: number;
  level: LanguageLevel;
  label: string;
  tokens: LanguageFlag[];
  notes: string[];
}

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

const COMMON_THAI = new Set(
  `
ใช้ ได้ กับ สินค้า ทุก หมวด ไม่ รวม ใน สุขภาพ ซื้อ เมนู ที่ ร่วม รายการ รับ ฟรี เฉพาะ ร้าน กำหนด
อัปไซซ์ เครื่องดื่ม ร้อน หรือ เย็น ระดับ เมื่อ ใด ก็ สูงสุด แอป ส่วนลด ลด บาท ขั้น ต่ำ โค้ด รหัส
คูปอง โปรโมชัน โปร พิเศษ แถม แลก ของ จำนวน จำกัด สิทธิ สิทธิ์ ลูกค้า ใหม่ เก่า ครั้ง แรก วัน เดือน
ปี วันที่ เวลา ถึง ก่อน หลัง หมดอายุ ใช้ได้ ใช้ได้ถึง ใช้ได้กับ ใช้ได้เฉพาะ ไม่รวม ไม่จำกัด สาขา
ทุกสาขา ต่อ ใบ ชิ้น ยอด บิล ค่าส่ง จัดส่ง สั่ง อาหาร ขนม กาแฟ ชา น้ำ ราคา แทน เงิน คืน สูง สุด
หนึ่ง สอง สาม สี่ ห้า หก เจ็ด แปด เก้า สิบ ร้อย พัน หมื่น แสน ล้าน ครึ่ง เปอร์เซ็นต์ เปอร์เซนต์
หน่วย บริการ สมาชิก สมัคร รับสิทธิ์ แลกซื้อ ซื้อครบ ของแถม ฟรีค่าส่ง ส่งฟรี ส่วน ยอดรวม สุทธิ
ภาษี บวก หาก เงื่อนไข เป็น ไป ตาม ระบุ ไว้ ข้าง ต้น ปลาย เปิด ปิด ทำการ หยุด นักขัตฤกษ์
ทุกวัน จันทร์ อังคาร พุธ พฤหัสบดี ศุกร์ เสาร์ อาทิตย์ มกราคม กุมภาพันธ์ มีนาคม เมษายน พฤษภาคม
มิถุนายน กรกฎาคม สิงหาคม กันยายน ตุลาคม พฤศจิกายน ธันวาคม
ต่อท่าน ต่อคน ต่อบิล ต่อรายการ ต่อครั้ง ใช้ร่วมกัน ไม่ได้ ใช้ร่วมกับ ไม่สามารถ เปลี่ยน คืนเงิน
เงินสด ทอน เท่านั้น ขึ้นไป ตั้งแต่ มากกว่า น้อยกว่า ไม่เกิน ไม่สามารถใช้ อย่างเดียว
เครื่อง อาหารเสริม เครื่องสำอาง เสื้อผ้า รองเท้า กระเป๋า สินค้าทั่วไป หมวดหมู่ ยี่ห้อ
ราคาปกติ ราคาพิเศษ ลดเพิ่ม ลดแล้ว ลดอีก ส่วนลดพิเศษ โปรแรง โปรใหญ่
เมนูแนะนำ เมนูใหม่ เมนูร้อน เมนูเย็น ชานม ไข่มุก ไก่ ทอด เบอร์เกอร์ พิซซ่า กาแฟสด
รับฟรี แลกฟรี แถมฟรี ฟรี 1 แถม 1 ซื้อ 1 แถม 1
เซเว่น อีเลฟเว่น แมคโดนัลด์ เคเอฟซี สตาร์บัคส์ ช้อปปี้ ลาซาด้า แกร็บ ไลน์แมน โรบินฮู้ด
ฟู้ดแพนด้า อโกด้า บุ๊คกิ้ง ท็อปส์ โลตัส บิ๊กซี เซ็นทรัล
ที่ ใน ของ และ หรือ แต่ ก็ จะ นี้ นั้น จาก ให้ ถูก ต้อง สามารถ ท่าน คน กัน ขึ้น ลง ไป มา เกิน
กว่า มาก น้อย ตั้งแต่ จนถึง ภายใน ภายนอก ระหว่าง บาง อย่าง เช่น ได้แก่ คือ เป็น อยู่ มี ไม่มี
ขาย แจก ส่ง เก็บ จ่าย ชำระ คิด เริ่ม สิ้นสุด หมดเขต เขต พื้นที่ จังหวัด อำเภอ ร้านค้า เว็บไซต์
แอปพลิเคชัน ระบบ หน้า หน้าจอ ตรวจสอบ ยืนยัน กรอก เลือก กด แตะ สแกน แสดง รายละเอียด
หมายเหตุ ตัวอย่าง มูลค่า มูล สตางค์ อัน แพ็ค ชุด กล่อง ขวด แก้ว ถุง ดวง คัน จาน ที่นั่ง โต๊ะ ห้อง คืน
อัป ไซซ์
`.trim().split(/\s+/),
);

const THAI_ONLY = /^[\u0E00-\u0E7F]+$/;
const LATIN_OR_CODE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const NUMBER_LIKE = /^\d+([.,/:-]\d+)*$/;
const URL_LIKE = /^(https?:\/\/|www\.)\S+$/i;
const TONE_MARKS = /[\u0E48-\u0E4B\u0E47]/g;
const INVALID_START = /^[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]/;
const REPEATED_CHAR = /(.)\1/;

function normalize(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[๐-๙]/g, (digit) => String(THAI_DIGITS.indexOf(digit)))
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function tokenize(text: string): string[] {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
    return [...segmenter.segment(text)]
      .filter((entry) => entry.isWordLike !== false)
      .map((entry) => entry.segment.trim())
      .filter(Boolean);
  }

  return text
    .split(/[\s,;:.!?()[\]{}"“”'’/\\|]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function suspiciousReason(word: string): string | null {
  if (INVALID_START.test(word)) return 'เริ่มด้วยสระ/วรรณยุกต์ผิดตำแหน่ง';
  const tones = word.match(TONE_MARKS);
  if (tones && tones.length > 1) return 'มีวรรณยุกต์ซ้ำ';
  if (REPEATED_CHAR.test(word)) return 'มีตัวอักษรซ้ำผิดปกติ';
  return null;
}

function levelOf(score: number): { level: LanguageLevel; label: string } {
  if (score >= 85) return { level: 'good', label: 'ดี' };
  if (score >= 70) return { level: 'check', label: 'ควรตรวจ' };
  return { level: 'poor', label: 'ควรแก้' };
}

export function checkTextLanguage(
  text: string,
  options: { ocrConfidence?: number | null } = {},
): LanguageCheckResult {
  const normalized = normalize(text);
  if (!normalized) {
    return {
      score: 0,
      level: 'poor',
      label: 'ไม่มีข้อความ',
      tokens: [],
      notes: ['ไม่มีข้อความให้ตรวจ'],
    };
  }

  const flags = new Map<string, string>();
  const tokens = tokenize(normalized);

  for (const raw of tokens) {
    const word = raw.replace(/^[^\u0E00-\u0E7FA-Za-z0-9]+|[^\u0E00-\u0E7FA-Za-z0-9]+$/g, '');
    if (!word) continue;
    if (NUMBER_LIKE.test(word) || URL_LIKE.test(word)) continue;
    if (LATIN_OR_CODE.test(word)) continue; // ชื่อแบรนด์/รหัส/อังกฤษ — ข้ามเพื่อลด false positive
    if (!THAI_ONLY.test(word)) continue;
    if (COMMON_THAI.has(word)) continue;

    const suspicious = suspiciousReason(word);
    if (suspicious) {
      flags.set(word, suspicious);
      continue;
    }

    // คำสั้นมากอาจเป็นคำ	function word ที่ไม่อยู่ในคลัง — ไม่ flag
    if (word.length >= 3) flags.set(word, 'ไม่พบในคลังคำ (อาจสะกด/ตัดคำผิด)');
  }

  const flagList = [...flags.entries()].map(([word, reason]) => ({ word, reason }));
  const notes: string[] = [];
  let score = 100 - Math.min(45, flagList.length * 7);

  if (typeof options.ocrConfidence === 'number' && options.ocrConfidence < 70) {
    score -= 10;
    notes.push('OCR confidence ต่ำ');
  }
  if (flagList.length > 0) {
    notes.push(`พบคำที่ควรตรวจ ${flagList.length} คำ`);
  }

  score = Math.max(0, Math.min(100, score));
  const { level, label } = levelOf(score);

  return { score, level, label, tokens: flagList.slice(0, 12), notes };
}

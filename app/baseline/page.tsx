import Link from 'next/link';
import { ArrowLeftIcon } from '@/components/Icons';
import { BaselineClient } from '@/components/BaselineClient';

export const metadata = {
  title: 'Baseline OCR & QR',
};

export default function BaselinePage() {
  return (
    <div className="page">
      <Link href="/" className="back-link">
        <ArrowLeftIcon size={15} />
        กลับไปหน้ารายการ
      </Link>

      <div className="page-head">
        <h1 className="page-title">Baseline OCR & QR</h1>
        <p className="page-sub">วัด QR, OCR, เวลา และชื่อที่ได้ — แก้ชื่อเทียบกับคำตอบจริงได้</p>
      </div>

      <BaselineClient />

      <div className="panel" style={{ marginTop: 16 }}>
        <h2 className="section-title">วิธีใช้</h2>
        <ol className="small" style={{ marginTop: 10, paddingLeft: 20, listStyle: 'decimal', display: 'grid', gap: 6 }}>
          <li>ใช้รูปจริง 20–30 ใบ (Shopee, Grab, LINE MAN, ธนาคาร, ร้านกาแฟ)</li>
          <li>อัปโหลดทีละใบ — วัด QR และ OCR</li>
          <li>แก้ “ชื่อ” ให้ตรงกับความจริง (ระบบเก็บชื่อเดิมไว้เทียบ)</li>
          <li>คัดลอก JSON ไปแนบ BRD</li>
        </ol>
        <div className="meta-grid" style={{ marginTop: 14 }}>
          <div className="meta-item">
            <span className="meta-label">QR</span>
            <span className="meta-value">≥ 80%</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">ชื่อถูก</span>
            <span className="meta-value">≥ 70%</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">เวลา</span>
            <span className="meta-value">≤ 30 วิ/ใบ</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">ต่ำกว่าเป้า</span>
            <span className="meta-value">ปรับ OCR/UX</span>
          </div>
        </div>
      </div>
    </div>
  );
}

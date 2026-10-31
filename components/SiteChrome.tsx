import Link from 'next/link';
import { SparklesIcon } from './Icons';
import { BrandLink } from './BrandLink';

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <BrandLink />

        <div className="header-actions">
          <Link href="/qr" className="btn btn-primary btn-sm">
            <SparklesIcon size={15} />
            สร้าง
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ mode }: { mode: 'demo' | 'gas' }) {
  return (
    <footer className="site-footer">
      <span>
        {mode === 'gas'
          ? 'ข้อมูลเก็บใน Google Sheets · รูปเก็บใน Google Drive'
          : 'โหมดทดลอง: ข้อมูลเก็บในไฟล์ .data บนเครื่องนี้'}
      </span>
      <span>
        Coupon Wallet · <Link href="/user">กระเป๋า</Link> ·{' '}
        <a href="/simple.html">โหมดง่าย</a> · <Link href="/baseline">Baseline</Link>
      </span>
    </footer>
  );
}

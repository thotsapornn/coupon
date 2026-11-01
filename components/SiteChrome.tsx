'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SparklesIcon, TicketIcon } from './Icons';
import { BrandLink } from './BrandLink';
import { LotteryShareMenu } from './LotteryShareMenu';
import { useLotteryShare } from './LotteryShareContext';

export function SiteHeader() {
  const pathname = usePathname() ?? '';
  const isLotteryPath = pathname === '/lottery' || pathname.startsWith('/lottery/');
  const { hasShare } = useLotteryShare();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        {isLotteryPath ? (
          <>
            <Link href="/lottery" className="brand" aria-label="หน้าจัดโพยหวย">
              <span className="brand-mark">
                <TicketIcon size={19} />
              </span>
              <span className="brand-text">
                <strong>หวย</strong>
                <span>จัดโพย · สถิติย้อนหลัง</span>
              </span>
            </Link>
            {pathname === '/lottery' && hasShare ? (
              <div className="header-actions">
                <LotteryShareMenu mode="full" label="แชร์ทั้งหน้า" />
              </div>
            ) : null}
          </>
        ) : (
          <>
            <BrandLink />
            <div className="header-actions">
              <Link href="/qr" className="btn btn-primary btn-sm">
                <SparklesIcon size={15} />
                สร้าง
              </Link>
            </div>
          </>
        )}
      </div>
    </header>
  );
}

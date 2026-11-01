'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShareIcon, SparklesIcon, TicketIcon } from './Icons';
import { BrandLink } from './BrandLink';
import { useLotteryShare } from './LotteryShareContext';

export function SiteHeader() {
  const pathname = usePathname() ?? '';
  const isLotteryPath = pathname === '/lottery' || pathname.startsWith('/lottery/');
  const { hasShare, isDisabled, requestShare } = useLotteryShare();

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
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => void requestShare('full')}
                  disabled={isDisabled('full')}
                >
                  <ShareIcon size={15} /> แชร์ทั้งหน้า
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <BrandLink />
            <div className="header-actions">
              <Link href="/lottery" className="btn btn-secondary btn-sm">
                <TicketIcon size={15} />
                หวย
              </Link>
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

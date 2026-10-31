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

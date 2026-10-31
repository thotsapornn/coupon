import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { storeMode } from '@/lib/store';

export const metadata: Metadata = {
  title: {
    default: 'Coupon Wallet — กระเป๋าคูปองส่วนลด',
    template: '%s · Coupon Wallet',
  },
  description:
    'เก็บคูปองจาก Screenshot อ่าน QR และข้อความอัตโนมัติ พร้อมบันทึกด้วย Google Sheets',
  applicationName: 'Coupon Wallet',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#f7f5f1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter mode={storeMode()} />
      </body>
    </html>
  );
}

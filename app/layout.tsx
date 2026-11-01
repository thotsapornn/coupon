import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteHeader } from '@/components/SiteChrome';
import { LotteryShareProvider } from '@/components/LotteryShareContext';

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
  themeColor: '#f7f5f1',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body>
        <LotteryShareProvider>
          <SiteHeader />
          <main>{children}</main>
        </LotteryShareProvider>
      </body>
    </html>
  );
}

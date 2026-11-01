import { LotteryTool } from '@/components/LotteryTool';
import { decodeLotteryShare } from '@/lib/lottery';

export const metadata = {
  title: 'จัดโพยหวย',
  description:
    'กรอกเลข 3 ตัว / 2 ตัว พร้อมราคา อัปโหลดรูปเลขอั้นให้ OCR อ่าน และสรุปเป็นโพย',
};

type PageProps = {
  searchParams: Promise<{ data?: string | string[] }>;
};

export default async function LotteryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.data) ? params.data[0] : params.data;
  const initialData = decodeLotteryShare(raw);

  return (
    <div className="page">
      <LotteryTool initialData={initialData} />
    </div>
  );
}

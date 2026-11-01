import { notFound } from 'next/navigation';
import { LotteryTool } from '@/components/LotteryTool';
import { decodeLotteryShare } from '@/lib/lottery';
import { getShare } from '@/lib/store';

export const metadata = {
  title: 'จัดโพยหวย',
  description:
    'กรอกเลข 3 ตัว / 2 ตัว พร้อมราคา อัปโหลดรูปเลขอั้นให้ OCR อ่าน และสรุปเป็นโพย',
};

type PageProps = {
  searchParams: Promise<{ data?: string | string[]; s?: string | string[] }>;
};

function firstParam(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LotteryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const shareKey = firstParam(params.s)?.trim().toLowerCase();
  let initialData = decodeLotteryShare(firstParam(params.data));

  if (shareKey) {
    const share = await getShare(shareKey);
    if (!share || share.kind !== 'full') notFound();
    initialData = decodeLotteryShare(share.data);
    if (!initialData) notFound();
  }

  return (
    <div className="page">
      <LotteryTool initialData={initialData} />
    </div>
  );
}

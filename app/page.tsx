import { TextCodeTool } from '@/components/TextCodeTool';

export const metadata = {
  title: 'สร้าง QR / บาร์โค้ด',
  description: 'พิมพ์ข้อความเพื่อสร้าง QR หรือบาร์โค้ดทันที ไม่บันทึกข้อมูล',
};

type PageProps = {
  searchParams: Promise<{ text?: string | string[] }>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.text) ? params.text[0] : params.text;
  const initialText = (raw ?? '').slice(0, 500);

  return (
    <div className="page">
      <TextCodeTool initialText={initialText} />
    </div>
  );
}

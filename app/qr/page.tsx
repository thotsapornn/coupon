import { TextCodeTool } from '@/components/TextCodeTool';

export const metadata = {
  title: 'สร้าง QR / บาร์โค้ด',
  description: 'สร้าง QR หรือบาร์โค้ดจากข้อความในลิงก์ ไม่บันทึกข้อมูล',
};

type PageProps = {
  searchParams: Promise<{ text?: string | string[] }>;
};

export default async function CreateQrPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.text) ? params.text[0] : params.text;
  const initialText = (raw ?? '').slice(0, 500);

  return (
    <div className="page">
      <TextCodeTool initialText={initialText} />
    </div>
  );
}

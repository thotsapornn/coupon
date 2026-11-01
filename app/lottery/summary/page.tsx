import { notFound } from 'next/navigation';
import { CopyButton } from '@/components/CopyButton';
import { formatMoney } from '@/lib/lottery';

export const metadata = {
  title: 'สรุปตัวเลข',
  description: 'สรุปรายการตัวเลขที่แชร์',
};

type PageProps = {
  searchParams: Promise<{
    date?: string | string[];
    text?: string | string[];
    total?: string | string[];
    before?: string | string[];
    discount?: string | string[];
  }>;
};

const SUMMARY_LINE = /^\d{2,3} = \d+(?:\.\d+)?x\d+(?:\.\d+)?$/;
const DRAW_DATE = /^\d{1,2} [ก-๙]+ \d{4}$/;
const AMOUNT = /^\d+(?:\.\d+)?$/;

export default async function SharedLotterySummaryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawDate = Array.isArray(params.date) ? params.date[0] : params.date;
  const rawText = Array.isArray(params.text) ? params.text[0] : params.text;
  const rawTotal = Array.isArray(params.total) ? params.total[0] : params.total;
  const rawBefore = Array.isArray(params.before) ? params.before[0] : params.before;
  const rawDiscount = Array.isArray(params.discount) ? params.discount[0] : params.discount;
  if (
    !rawDate ||
    !DRAW_DATE.test(rawDate) ||
    !rawText ||
    rawText.length > 7800 ||
    (rawTotal && !AMOUNT.test(rawTotal)) ||
    (rawBefore && !AMOUNT.test(rawBefore)) ||
    (rawDiscount && rawDiscount !== '25')
  ) {
    notFound();
  }

  const lines = rawText.split(/\r?\n/);
  if (lines.length === 0 || lines.length > 500 || !lines.every((line) => SUMMARY_LINE.test(line))) {
    notFound();
  }

  const summaryText = lines.join('\n');
  const lineTotal = lines.reduce((sum, line) => {
    const amount = line.match(/= (\d+(?:\.\d+)?)x/);
    return sum + Number(amount?.[1] ?? 0);
  }, 0);
  const total = formatMoney(rawTotal ? Number(rawTotal) : lineTotal);
  const before = rawBefore ? formatMoney(Number(rawBefore)) : null;
  const hasDiscount = Boolean(before && rawDiscount === '25');
  const discountAmount = hasDiscount ? formatMoney(Number(rawBefore) - Number(rawTotal)) : null;
  const copySummary = [
    summaryText,
    hasDiscount ? `ยอดสุทธิ: ${total} บาท` : `รวมราคา: ${total} บาท`,
    ...(hasDiscount
      ? [`ก่อนลด ${before} บาท · ส่วนลด ${rawDiscount}% (${discountAmount} บาท)`]
      : []),
  ].join('\n');

  return (
    <div className="page">
      <section className="lottery-card lottery-summary-shared">
        <div className="lottery-shared-heading">
          <span className="eyebrow">สรุปตัวเลข</span>
          <h1 className="page-title">งวดวันที่ {rawDate}</h1>
          <p className="section-sub">{lines.length} เลข · ราคาแสดงตามรายการ</p>
        </div>
        <div className="lottery-summary-box">
          <div className="lottery-summary-box-toolbar">
            <CopyButton
              value={summaryText}
              label="คัดลอกสรุป"
              copiedLabel="คัดลอกแล้ว"
              className="lottery-summary-copy-button"
              iconOnly
            />
          </div>
          <pre className="lottery-summary-copy lottery-summary-shared-text">{summaryText}</pre>
        </div>
        <div className="lottery-shared-total">
          <span>{hasDiscount ? 'ยอดสุทธิ' : 'รวมราคา'}</span>
          <strong className="mono">{total}</strong>
          <small>บาท</small>
          {hasDiscount ? (
            <p>ก่อนลด {before} บาท · ส่วนลด {rawDiscount}% ({discountAmount} บาท)</p>
          ) : null}
        </div>
        <div className="lottery-shared-copy-action">
          <CopyButton value={copySummary} label="คัดลอกสรุป" copiedLabel="คัดลอกแล้ว" />
        </div>
      </section>
    </div>
  );
}

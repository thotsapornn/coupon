import { notFound } from 'next/navigation';
import { CopyButton } from '@/components/CopyButton';
import { formatMoney } from '@/lib/lottery';
import { decodeShareJson } from '@/lib/share-codec';

export const metadata = {
  title: 'สรุปตัวเลข',
  description: 'สรุปรายการตัวเลขที่แชร์',
};

type PageProps = {
  searchParams: Promise<{
    data?: string | string[];
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

function firstParam(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePayload(value?: string): Record<string, unknown> | null {
  if (!value) return null;
  const candidates = [value];
  try {
    const decoded = decodeURIComponent(value);
    if (decoded !== value) candidates.push(decoded);
  } catch {
    // Try the raw value if it was not percent-encoded.
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the next encoding candidate.
    }
  }
  return null;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return undefined;
}

export default async function SharedLotterySummaryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawPayload = firstParam(params.data);
  const decodedPayload = decodeShareJson(rawPayload ?? '');
  const payload =
    decodedPayload && typeof decodedPayload === 'object' && !Array.isArray(decodedPayload)
      ? (decodedPayload as Record<string, unknown>)
      : parsePayload(rawPayload);
  const rawDate = stringValue(payload?.date) ?? firstParam(params.date);
  const rawText = stringValue(payload?.text) ?? firstParam(params.text);
  const rawTotal = stringValue(payload?.total) ?? firstParam(params.total);
  const rawBefore = stringValue(payload?.before) ?? firstParam(params.before);
  const rawDiscount = stringValue(payload?.discount) ?? firstParam(params.discount);
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
    const amounts = line.match(/= (\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/);
    return sum + Number(amounts?.[1] ?? 0) + Number(amounts?.[2] ?? 0);
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

import { describe, expect, it } from 'vitest';
import {
  historicalLotteryRoundKey,
  lotteryRoundKeyForDate,
} from '../lib/lottery-history';
import {
  buildLotterySummary,
  DEFAULT_LOTTERY_PRICE,
  decodeLotteryShare,
  encodeLotteryShare,
  extractNumberTokens,
  formatEntryPrice,
  formatSummaryLine,
  isValidLotteryEntry,
  lotterySummaryToText,
  matchesRestricted,
  normalizeDigits,
  normalizeLotteryNumber,
  normalizePrice,
  parseRestrictedNumbers,
  summaryToText,
  uniquePermutations,
  type LotteryEntry,
  type SharedLotteryState,
} from '../lib/lottery';

const SAMPLE_OCR = `เลขอั้น 1 พ.ย. 69

เด็งโต๊ด/3-6 กลับ (จ่ายครึ่ง)
049-059-145-147-156
159-258-568-579-679

บน/ล่าง/คลับ (จ่ายครึ่ง)
15-25-28-29-39
56-58-59-79-89

ปิดรับเวลา 14.40 น.

“เขียนตัวเลยให้ขัดเจนนะครับ”`;

const THREE = ['049', '059', '145', '147', '156', '159', '258', '568', '579', '679'];
const TWO = ['15', '25', '28', '29', '39', '56', '58', '59', '79', '89'];

function entry(partial: Partial<LotteryEntry> & Pick<LotteryEntry, 'number'>): LotteryEntry {
  return {
    id: partial.number,
    price: 30,
    reverse: false,
    ...partial,
  };
}

describe('lottery history round matching', () => {
  it('matches a selected calendar date to the same historical draw round', () => {
    expect(lotteryRoundKeyForDate('2026-11-01')).toBe('1-11');
    expect(historicalLotteryRoundKey('1 พฤศจิกายน 2568')).toBe('1-11');
  });

  it('normalizes shifted official draw dates', () => {
    expect(historicalLotteryRoundKey('17 มกราคม 2568')).toBe('16-1');
    expect(historicalLotteryRoundKey('2 พฤษภาคม 2568')).toBe('1-5');
  });
});

describe('lottery parsing', () => {
  it('reads 3-digit and 2-digit groups from the sample image text', () => {
    const parsed = parseRestrictedNumbers(SAMPLE_OCR);

    expect(parsed.three.numbers).toEqual(THREE);
    expect(parsed.two.numbers).toEqual(TWO);
    expect(parsed.three.reversed).toBe(true);
    expect(parsed.two.reversed).toBe(true);
    expect(parsed.title).toBe('เลขอั้น 1 พ.ย. 69');
    expect(parsed.closingTime).toBe('14:40');
    expect(parsed.halfPay).toBe(true);
    expect(parsed.warnings).toEqual([]);
  });

  it('classifies plain lists by digit length when there is no heading', () => {
    const parsed = parseRestrictedNumbers(`
      049-059-145
      15-25-28
    `);

    expect(parsed.three.numbers).toEqual(['049', '059', '145']);
    expect(parsed.two.numbers).toEqual(['15', '25', '28']);
  });

  it('ignores dates and closing times', () => {
    const parsed = parseRestrictedNumbers(`
      เลขอั้น 1 พ.ย. 69
      ปิดรับเวลา 14.40 น.
      049 059
    `);

    expect(parsed.three.numbers).toEqual(['049', '059']);
    expect(parsed.two.numbers).toEqual([]);
    expect(parsed.closingTime).toBe('14:40');
  });

  it('treats a numeric date in the title as a title, not restricted numbers', () => {
    const parsed = parseRestrictedNumbers(`
      เลขอั้น 1/11/69
      049 059
    `);

    expect(parsed.title).toBe('เลขอั้น 1/11/69');
    expect(parsed.three.numbers).toEqual(['049', '059']);
    expect(parsed.two.numbers).toEqual([]);
  });

  it('still reads a title line that also contains a number list', () => {
    const parsed = parseRestrictedNumbers('เลขอั้น 049 059 145');

    expect(parsed.title).toBeUndefined();
    expect(parsed.three.numbers).toEqual(['049', '059', '145']);
  });

  it('normalises Thai digits and common OCR confusables', () => {
    expect(normalizeDigits('๐๑๒๓๔๕๖๗๘๙')).toBe('0123456789');

    const parsed = parseRestrictedNumbers(`
      O49-O59-145
      ๑๕-๒๕-๒๘
    `);

    expect(parsed.three.numbers).toEqual(['049', '059', '145']);
    expect(parsed.two.numbers).toEqual(['15', '25', '28']);
  });

  it('keeps leading zeros and extracts tokens from labelled lines', () => {
    expect(extractNumberTokens('เลขท้าย 3 ตัว: 049 059 145')).toEqual([
      '049',
      '059',
      '145',
    ]);

    const parsed = parseRestrictedNumbers(`
      เลขท้าย 3 ตัว: 049 059 145
      เลขท้าย 2 ตัว: 15 25 28
    `);

    expect(parsed.three.numbers).toEqual(['049', '059', '145']);
    expect(parsed.two.numbers).toEqual(['15', '25', '28']);
  });

  it('warns when a token has the wrong length for its heading', () => {
    const parsed = parseRestrictedNumbers(`
      เต็ง/3 ตัว
      049-59
    `);

    expect(parsed.three.numbers).toEqual(['049']);
    expect(parsed.two.numbers).toEqual(['59']);
    expect(parsed.warnings.join(' ')).toContain('59');
  });
});

describe('lottery reversal', () => {
  it('returns every unique permutation', () => {
    expect(uniquePermutations('23')).toEqual(['23', '32']);
    expect(uniquePermutations('123')).toEqual([
      '123',
      '132',
      '213',
      '231',
      '312',
      '321',
    ]);
    expect(uniquePermutations('112')).toEqual(['112', '121', '211']);
    expect(uniquePermutations('049')).toEqual([
      '049',
      '094',
      '409',
      '490',
      '904',
      '940',
    ]);
  });

  it('matches exact and reversed restricted numbers', () => {
    const parsed = parseRestrictedNumbers(SAMPLE_OCR);

    expect(matchesRestricted('049', parsed)).toEqual({
      number: '049',
      matched: '049',
      kind: 'exact',
    });
    expect(matchesRestricted('940', parsed)).toEqual({
      number: '940',
      matched: '049',
      kind: 'reverse',
    });
    expect(matchesRestricted('95', parsed)).toEqual({
      number: '95',
      matched: '59',
      kind: 'reverse',
    });
    expect(matchesRestricted('940', parsed, false)).toBeNull();
    expect(matchesRestricted('123', parsed)).toBeNull();
  });
});

describe('lottery summary', () => {
  const parsed = parseRestrictedNumbers(SAMPLE_OCR);

  it('matches the requested example output', () => {
    const entries = [entry({ number: '123' }), entry({ number: '23', reverse: true })];
    const summary = buildLotterySummary(entries, parsed);

    expect(summary.lines.map((line) => line.number)).toEqual(['123', '23', '32']);
    expect(summaryToText(summary.lines)).toBe('123 = 30x30\n23 = 30x30\n32 = 30x30');
    expect(summary.totalAmount).toBe(180);
    expect(summary.discountedAmount).toBe(180);
    expect(summary.restrictedCount).toBe(0);
  });

  it('adds a half-pay note to restricted lines', () => {
    const entries = [entry({ number: '940' })];
    const summary = buildLotterySummary(entries, parsed);

    expect(summary.restrictedCount).toBe(1);
    expect(summary.lines[0].match).toEqual({
      number: '940',
      matched: '049',
      kind: 'reverse',
    });
    expect(formatSummaryLine(summary.lines[0], { includeWarning: true })).toBe(
      '940 = 30x30 (จ่ายครึ่ง)',
    );
    expect(summaryToText(summary.lines, { includeWarning: true })).toBe(
      '940 = 30x30 (จ่ายครึ่ง)',
    );
  });

  it('can turn off restricted warnings', () => {
    const entries = [entry({ number: '049' })];
    const summary = buildLotterySummary(entries, parsed, { useRestricted: false });

    expect(summary.restrictedCount).toBe(0);
    expect(summary.lines[0].match).toBeNull();
  });

  it('applies a discount to the total without changing individual number prices', () => {
    const entries = [entry({ number: '123' })];
    const summary = buildLotterySummary(entries, parsed, { discount: 25 });

    expect(summary.lines[0].price).toBe('30x30');
    expect(summaryToText(summary.lines)).toBe('123 = 30x30');
    expect(summary.totalAmount).toBe(60);
    expect(summary.discountedAmount).toBe(45);
    expect(lotterySummaryToText(summary, { discount: 25 })).toBe(
      '123 = 30x30\nรวมราคา: 60 บาท\nส่วนลด 25%: -15 บาท\nยอดสุทธิ: 45 บาท',
    );
  });

  it('applies the discount once to the combined amount of multiple numbers', () => {
    const entries = [entry({ number: '123', price: 30 }), entry({ number: '45', price: 50 })];
    const summary = buildLotterySummary(entries, parsed, { discount: 25 });

    expect(summary.totalAmount).toBe(160);
    expect(summary.discountedAmount).toBe(120);
    expect(summary.lines.map((line) => line.price)).toEqual(['30x30', '50x50']);
    expect(lotterySummaryToText(summary, { discount: 25 })).toContain(
      'ยอดสุทธิ: 120 บาท',
    );
  });

  it('keeps the original number first when reversing', () => {
    const entries = [entry({ number: '20', reverse: true })];
    const summary = buildLotterySummary(entries, parsed);

    expect(summary.lines.map((line) => line.number)).toEqual(['20', '02']);
    expect(summary.totalAmount).toBe(120);
  });

  it('expands a reversed 3-digit entry into six lines', () => {
    const entries = [entry({ number: '123', reverse: true })];
    const summary = buildLotterySummary(entries, parsed);

    expect(summary.lines.map((line) => line.number)).toEqual([
      '123',
      '132',
      '213',
      '231',
      '312',
      '321',
    ]);
    expect(summary.totalAmount).toBe(360);
  });
});

describe('lottery input helpers', () => {
  it('normalises a single price and formats it as amount x rate', () => {
    expect(normalizePrice('30')).toBe(30);
    expect(normalizePrice(' 30 ')).toBe(30);
    expect(normalizePrice('30.5')).toBe(30.5);
    expect(normalizePrice('1,000')).toBe(1000);
    expect(normalizePrice('30x30')).toBeNull();
    expect(normalizePrice('')).toBeNull();
    expect(normalizePrice('abc')).toBeNull();
    expect(normalizePrice('0')).toBeNull();
    expect(normalizePrice('-5')).toBeNull();
    expect(formatEntryPrice(30)).toBe('30x30');
    expect(formatEntryPrice(30.5)).toBe('30.5x30.5');
  });

  it('accepts only 2 or 3 digit numbers', () => {
    expect(normalizeLotteryNumber('123')).toBe('123');
    expect(normalizeLotteryNumber(' 049 ')).toBe('049');
    expect(normalizeLotteryNumber('๑๒๓')).toBe('123');
    expect(normalizeLotteryNumber('12-3')).toBe('123');
    expect(normalizeLotteryNumber('1')).toBeNull();
    expect(normalizeLotteryNumber('1234')).toBeNull();
    expect(normalizeLotteryNumber('12a')).toBeNull();
  });
});

describe('lottery share', () => {
  const state: SharedLotteryState = {
    restrictedText: SAMPLE_OCR,
    useRestricted: true,
    includeReversed: false,
    priceInput: '30',
    discount: 25,
    entries: [entry({ number: '123' })],
    numberInput: '45',
    reverseInput: true,
    historyRound: '2026-11-16',
    editingId: '123',
  };

  it('encodes and decodes the full state', () => {
    const encoded = encodeLotteryShare(state);
    expect(encoded).not.toContain('{');
    expect(decodeLotteryShare(encoded)).toEqual(state);
  });

  it('accepts an already-decoded JSON string', () => {
    expect(decodeLotteryShare(JSON.stringify(state))).toEqual(state);
  });

  it('rejects invalid share values', () => {
    expect(decodeLotteryShare('')).toBeNull();
    expect(decodeLotteryShare(undefined)).toBeNull();
    expect(decodeLotteryShare('not-json')).toBeNull();
  });

  it('fills defaults and drops invalid entries', () => {
    const encoded = encodeURIComponent(
      JSON.stringify({
        priceInput: '30x30',
        discount: 7,
        entries: [
          { id: 'bad', number: '1', price: 30, reverse: false },
          { id: 'ok', number: '123', price: 30, reverse: false },
        ],
      }),
    );

    const decoded = decodeLotteryShare(encoded);
    expect(decoded).not.toBeNull();
    expect(decoded?.priceInput).toBe(DEFAULT_LOTTERY_PRICE);
    expect(decoded?.discount).toBe(0);
    expect(decoded?.entries.map((item) => item.number)).toEqual(['123']);
    expect(decoded?.useRestricted).toBe(true);
    expect(decoded?.includeReversed).toBe(true);
  });

  it('validates entries', () => {
    expect(isValidLotteryEntry(entry({ number: '123' }))).toBe(true);
    expect(isValidLotteryEntry({ id: 'x', number: '1', price: 30, reverse: false })).toBe(false);
    expect(isValidLotteryEntry({ id: 'x', number: '123', price: 0, reverse: false })).toBe(false);
  });
});

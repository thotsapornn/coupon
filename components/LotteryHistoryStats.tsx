'use client';

import { useMemo } from 'react';
import type { ParsedRestricted } from '@/lib/lottery';
import {
  historicalLotteryRoundKey,
  lotteryHistoryDraws,
  lotteryRoundDateLabel,
} from '@/lib/lottery-history';

const POSITIONS = ['แสน', 'หมื่น', 'พัน', 'ร้อย', 'สิบ', 'หน่วย'];

export function LotteryHistoryStats({
  restricted,
  selectedDate,
  selectedRound,
}: {
  restricted: ParsedRestricted;
  selectedDate: string;
  selectedRound: string | null;
}) {
  const roundLabel = lotteryRoundDateLabel(selectedDate);

  const draws = useMemo(
    () =>
      selectedRound
        ? lotteryHistoryDraws
            .filter((draw) => historicalLotteryRoundKey(draw.date) === selectedRound)
            .sort((a, b) => b.year - a.year)
        : [],
    [selectedRound],
  );

  const interestingDigits = useMemo(() => {
    const counts = new Map<string, number>();
    for (const draw of draws) {
      for (const digit of new Set(draw.lastTwo.split(''))) {
        counts.set(digit, (counts.get(digit) ?? 0) + 1);
      }
    }
    const restrictedDigits = new Set(
      [...restricted.two.numbers, ...restricted.three.numbers].flatMap((number) =>
        number.split(''),
      ),
    );
    return [...counts]
      .map(([digit, count]) => ({ digit, count }))
      .filter(({ digit }) => !restrictedDigits.has(digit))
      .sort((a, b) => b.count - a.count || a.digit.localeCompare(b.digit))
      .slice(0, 1);
  }, [draws, restricted]);

  const firstPrizeDigits = useMemo(
    () => {
      if (draws.length === 0) return [];
      return POSITIONS.map((position, index) => {
        const counts = new Map<string, number>();
        for (const draw of draws) {
          const digit = draw.firstPrize[index];
          counts.set(digit, (counts.get(digit) ?? 0) + 1);
        }
        const maxCount = Math.max(...counts.values());
        const digits = [...counts]
          .filter(([, count]) => count === maxCount)
          .map(([digit]) => digit)
          .sort();
        return { position, digits, count: maxCount };
      });
    },
    [draws],
  );

  const sourceUrl = 'https://www.lottery.co.th/previous';

  return (
    <details className="lottery-card lottery-history">
      <summary className="lottery-history-summary">
        <span>
          <strong>สถิติย้อนหลัง 5 ปี</strong>
          <small>งวด {roundLabel} · รางวัลที่ 1 และเลขท้าย 2 ตัว</small>
        </span>
        <span className="lottery-history-total">{draws.length} งวด</span>
      </summary>

      <div className="lottery-history-content">
        {draws.length === 0 ? (
          <p className="lottery-history-filter-note">
            ไม่มีผลย้อนหลังสำหรับวันที่นี้ในชุดข้อมูลที่รวบรวมไว้
          </p>
        ) : null}

        {draws.length > 0 ? (
          <>
        <section className="lottery-history-section" aria-labelledby="history-last-two-title">
          <div className="lottery-history-section-head">
            <h3 id="history-last-two-title">เลขเด่น 1 หลัก</h3>
            <span>จากเลขท้าย 2 ตัว · ตัดเลขอั้น</span>
          </div>
          {restricted.two.numbers.length + restricted.three.numbers.length === 0 ? (
            <p className="lottery-history-filter-note">
              อัปโหลดรูปเลขอั้นเพื่อกรองเลขที่ติดอั้นออก
            </p>
          ) : null}
          {interestingDigits.length > 0 ? (
            <div className="lottery-history-singles">
              {interestingDigits.map((item) => (
                <div className="lottery-history-single" key={item.digit}>
                  <strong className="mono">{item.digit}</strong>
                  <span>
                    {item.count}/{draws.length} งวด ·{' '}
                    {((item.count / draws.length) * 100).toFixed(1)}% ย้อนหลัง
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="lottery-history-filter-note">
              เลขเด่นจากสถิติติดเลขอั้นทั้งหมด
            </p>
          )}
        </section>

        <section className="lottery-history-section" aria-labelledby="history-first-title">
          <div className="lottery-history-section-head">
            <h3 id="history-first-title">เลขที่ออกบ่อยในรางวัลที่ 1</h3>
            <span>แยกตามหลัก</span>
          </div>
          <div className="lottery-history-digits">
            {firstPrizeDigits.map((item) => (
              <div className="lottery-history-digit" key={item.position}>
                <span>หลัก{item.position}</span>
                <strong className="mono">{item.digits.join(' / ')}</strong>
                <small>{item.count} ครั้ง</small>
              </div>
            ))}
          </div>
        </section>

        <details className="lottery-history-results">
          <summary>ดูผลย้อนหลังทั้งหมด {draws.length} งวด</summary>
          <div className="lottery-history-table-wrap">
            <table className="lottery-history-table">
              <thead>
                <tr>
                  <th scope="col">งวด</th>
                  <th scope="col">รางวัลที่ 1</th>
                  <th scope="col">เลขท้าย 2 ตัว</th>
                </tr>
              </thead>
              <tbody>
                {draws.map((draw) => (
                  <tr key={`${draw.year}-${draw.date}`}>
                    <td>{draw.date}</td>
                    <td className="mono">{draw.firstPrize}</td>
                    <td className="mono">{draw.lastTwo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
          </>
        ) : null}

        <p className="lottery-history-disclaimer">
          ความถี่นี้เป็นข้อมูลย้อนหลัง ไม่ได้เพิ่มโอกาสถูกรางวัลในงวดหน้า · เลขท้าย 2 ตัวมีโอกาสทางทฤษฎี
          1/100 ต่อเลข · แหล่งข้อมูล{' '}
          <a href={sourceUrl} target="_blank" rel="noreferrer">
            lottery.co.th
          </a>
        </p>
      </div>
    </details>
  );
}

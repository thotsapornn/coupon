import Link from 'next/link';
import type { Coupon } from '@/lib/types';
import { getCardExpiryLabel } from '@/lib/format';
import { ClockIcon, QrIcon, TicketIcon } from './Icons';
import { StatusBadge } from './StatusBadge';

const PALETTES = [
  ['#b65637', '#7d3b28'],
  ['#1d6b4e', '#123f2f'],
  ['#2b5b83', '#1b3a55'],
  ['#9a6412', '#6d450b'],
  ['#6c4a7a', '#422c4d'],
];

function pickPalette(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 9973;
  }
  const [from, to] = PALETTES[hash % PALETTES.length];
  return [from, to];
}

export function CouponThumb({ coupon }: { coupon: Coupon }) {
  if (coupon.imageUrl && coupon.imageStatus === 'ok') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={coupon.imageUrl} alt={`รูปคูปอง ${coupon.title}`} loading="lazy" />
    );
  }

  const [from, to] = pickPalette(coupon.couponId);
  return (
    <span className="thumb-placeholder" style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}>
      <TicketIcon size={30} />
      <span className="thumb-initial">{(coupon.merchant ?? coupon.title).slice(0, 1).toUpperCase()}</span>
      <span className="thumb-caption">Coupon Wallet</span>
    </span>
  );
}

export function CouponCard({ coupon }: { coupon: Coupon }) {
  const expiry = getCardExpiryLabel(coupon);
  const detailHref = `/user/${coupon.userId}/coupons/${coupon.couponId}`;
  const qrHref = `${detailHref}/qr`;
  const canShowQr = Boolean(coupon.qrRawValue || coupon.couponCode);

  return (
    <article className={`coupon-card${coupon.status === 'used' ? ' is-used' : ''}`}>
      <Link href={detailHref} className="coupon-media" aria-label={`ดูรายละเอียด ${coupon.title}`}>
        <CouponThumb coupon={coupon} />
        <StatusBadge coupon={coupon} />
      </Link>

      <div className="coupon-body">
        <Link href={detailHref} className="coupon-info">
          <span className="coupon-merchant">{coupon.merchant ?? 'คูปอง'}</span>
          <h3 className="coupon-title">{coupon.title}</h3>
          {coupon.discountText ? <p className="coupon-discount">{coupon.discountText}</p> : null}
        </Link>

        <div className="coupon-foot">
          <span className={`coupon-expiry tone-${expiry.tone}`} title={expiry.text}>
            <ClockIcon size={13} />
            <span className="coupon-expiry-text">{expiry.text}</span>
          </span>
          {canShowQr ? (
            <Link
              href={qrHref}
              className="coupon-qr-btn"
              aria-label={`แสดง QR ${coupon.title}`}
              title="แสดง QR"
            >
              <QrIcon size={14} />
              <span>แสดง QR</span>
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

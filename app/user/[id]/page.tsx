import { notFound as nextNotFound } from 'next/navigation';
import { WalletClient } from '@/components/WalletClient';
import { getStats, listCoupons } from '@/lib/store';
import { normalizeUserId } from '@/lib/user';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ id: string }> };

export default async function UserWalletPage({ params }: PageProps) {
  const { id } = await params;
  const userId = normalizeUserId(id);
  if (!userId) nextNotFound();

  const [coupons, stats] = await Promise.all([
    listCoupons({ userId, limit: 1000 }),
    getStats(userId),
  ]);

  return (
    <WalletClient
      userId={userId}
      initial={{ items: coupons.items, total: coupons.total, stats }}
    />
  );
}

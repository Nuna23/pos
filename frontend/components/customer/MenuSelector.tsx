'use client';

import OrderFlow from '@/components/order/OrderFlow';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Props {
  branchId: number;
}

export default function MenuSelector({ branchId }: Props) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-orange-500 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🥞</span>
          <h1 className="font-bold text-lg">สั่งเครป · สาขา {branchId}</h1>
        </div>
        <Link href="/order" className="text-xs bg-white/20 px-3 py-1.5 rounded-lg font-medium">
          เปลี่ยนสาขา
        </Link>
      </header>

      {/* After ordering, the customer goes to their live queue tracker. */}
      <OrderFlow
        mode="customer"
        branchId={branchId}
        onPlaced={(order) => router.push(`/queue/${order.id}`)}
      />
    </div>
  );
}

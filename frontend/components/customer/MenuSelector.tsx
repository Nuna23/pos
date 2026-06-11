'use client';

import OrderFlow from '@/components/order/OrderFlow';
import { useRouter } from 'next/navigation';

interface Props {
  branchId: number;
}

export default function MenuSelector({ branchId }: Props) {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-orange-500 text-white px-4 py-3 flex items-center gap-2">
        <span className="text-2xl">🥞</span>
        <h1 className="font-bold text-lg">สั่งเครป · สาขา {branchId}</h1>
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

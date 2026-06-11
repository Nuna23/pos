'use client';

import DashboardPanel from '@/components/dashboard/DashboardPanel';
import BranchStock from '@/components/merchant/BranchStock';
import KanbanBoard from '@/components/merchant/KanbanBoard';
import OrderFlow from '@/components/order/OrderFlow';
import { Order } from '@/types';
import Link from 'next/link';
import { useState } from 'react';

const TABS = ['สั่งอาหาร', 'กระดานหน้าเตา', 'สต็อกสาขา', 'Dashboard'];

interface Props {
  // Which branch this แม่ค้า is working at — fixed by the URL (/merchant/[branch]).
  branchId: number;
}

export default function POSPanel({ branchId }: Props) {
  const [tab, setTab] = useState(0);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-orange-500 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-base">CrepePOS — แม่ค้า · สาขา {branchId}</h1>
        <Link
          href={`/order/${branchId}`}
          className="text-xs bg-white/20 px-3 py-1.5 rounded-lg font-medium"
        >
          หน้าลูกค้า
        </Link>
      </header>

      {/* Tabs (board + dashboard live here now, not as separate pages) */}
      <div className="flex bg-white border-b">
        {TABS.map((label, i) => (
          <button
            key={label}
            onClick={() => setTab(i)}
            className={`flex-1 py-3 text-sm font-medium transition border-b-2 ${
              tab === i
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 0 && (
        <>
          {lastOrder && (
            <div className="m-4 bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
              <p className="text-green-700 font-bold text-lg">
                สั่งเสร็จแล้ว! คิว #{lastOrder.queueNumber}
              </p>
              <button
                onClick={() => setLastOrder(null)}
                className="mt-1 text-xs text-green-500 underline"
              >
                ปิด
              </button>
            </div>
          )}
          {/* Walk-up order taken by the shop — same flow as the customer,
              constrained to this branch's stock. */}
          <OrderFlow
            mode="merchant"
            branchId={branchId}
            onPlaced={(order) => setLastOrder(order)}
          />
        </>
      )}

      {tab === 1 && <KanbanBoard />}
      {tab === 2 && <BranchStock branchId={branchId} />}
      {tab === 3 && <DashboardPanel />}
    </div>
  );
}

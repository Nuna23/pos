'use client';

import { api } from '@/lib/api';
import { useEffect, useState } from 'react';

interface BranchItem {
  id: number;
  name: string;
  category: string;
  alertThreshold: number;
  quantity: number;
}

interface Props {
  // Fixed by the URL — this branch's แม่ค้า only ever sees its own stock.
  branchId: number;
}

// Refresh so the branch sees updates as admin distributes stock.
const POLL_INTERVAL = 5000;

export default function BranchStock({ branchId }: Props) {
  const [items, setItems] = useState<BranchItem[]>([]);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .get<BranchItem[]>(`/branches/${branchId}/stock`)
        .then((r) => {
          if (active) setItems(r.data);
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, POLL_INTERVAL);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [branchId]);

  const doughs = items.filter((i) => i.category === 'DOUGH');
  const toppings = items.filter((i) => i.category === 'TOPPING');

  return (
    <div className="p-4 space-y-4">
      <p className="text-xs text-gray-400">วัตถุดิบที่แอดมินแบ่งให้สาขานี้</p>

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">
          ยังไม่มีวัตถุดิบที่แบ่งให้สาขานี้
        </div>
      ) : (
        <div className="space-y-4">
          {[
            { label: 'แป้ง', list: doughs },
            { label: 'ไส้', list: toppings },
          ].map(
            ({ label, list }) =>
              list.length > 0 && (
                <section key={label}>
                  <h2 className="text-sm font-semibold text-gray-500 mb-2">{label}</h2>
                  <div className="space-y-2">
                    {list.map((i) => {
                      const low = i.quantity <= i.alertThreshold;
                      return (
                        <div
                          key={i.id}
                          className="bg-white rounded-xl p-3 flex items-center justify-between shadow-sm"
                        >
                          <span className="text-sm font-medium text-gray-800">{i.name}</span>
                          <span
                            className={`text-sm font-bold ${low ? 'text-red-500' : 'text-gray-800'}`}
                          >
                            {i.quantity}
                            {low && <span className="ml-1 text-xs font-normal">ใกล้หมด</span>}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ),
          )}
        </div>
      )}
    </div>
  );
}

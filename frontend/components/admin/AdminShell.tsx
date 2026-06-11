'use client';

import CostPanel from '@/components/admin/CostPanel';
import FinancePanel from '@/components/admin/FinancePanel';
import StockPanel from '@/components/admin/StockPanel';
import { useState } from 'react';

const TABS = ['คลังสาขา', 'การเงิน', 'วัตถุดิบ'];

export default function AdminShell() {
  const [tab, setTab] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-800 text-white px-4 py-3">
        <h1 className="font-bold text-base">CrepePOS — Admin</h1>
      </header>

      <div className="flex bg-white border-b">
        {TABS.map((label, i) => (
          <button
            key={label}
            onClick={() => setTab(i)}
            className={`flex-1 py-3 text-sm font-medium transition border-b-2 ${
              tab === i ? 'border-gray-800 text-gray-800' : 'border-transparent text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 0 && <StockPanel />}
      {tab === 1 && <FinancePanel />}
      {tab === 2 && <CostPanel />}
    </div>
  );
}

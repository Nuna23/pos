'use client';

import { api } from '@/lib/api';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Branch {
  id: number;
  name: string;
}

// First entry to the merchant area: pick a branch. The choice lives in the URL
// (/merchant/[branch]) so each branch's แม่ค้า has its own link and only ever
// sees its own stock.
export default function MerchantPage() {
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    api.get<Branch[]>('/branches').then((r) => setBranches(r.data));
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-orange-50 p-6">
      <div className="text-center space-y-2 mb-8">
        <div className="text-5xl">🥞</div>
        <h1 className="text-2xl font-bold text-orange-600">CrepePOS — แม่ค้า</h1>
        <p className="text-gray-500 text-sm">เลือกสาขาของคุณ</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {branches.map((b) => (
          <Link
            key={b.id}
            href={`/merchant/${b.id}`}
            className="bg-orange-500 text-white text-center py-4 rounded-2xl text-lg font-semibold shadow-md hover:bg-orange-600 transition"
          >
            {b.name}
          </Link>
        ))}
      </div>
    </main>
  );
}

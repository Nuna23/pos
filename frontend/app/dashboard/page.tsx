'use client';

import SalesChart from '@/components/dashboard/SalesChart';
import TopToppings from '@/components/dashboard/TopToppings';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';

interface DashboardSummary {
  period: string;
  totalRevenue: number;
  orderCount: number;
  peakHours: { hour: number; count: number }[];
  topToppings: { name: string; count: number }[];
}

export default function DashboardPage() {
  const [period, setPeriod] = useState<'day' | 'month'>('day');
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<DashboardSummary>(`/dashboard/summary?period=${period}`)
      .then((r: import('axios').AxiosResponse<DashboardSummary>) => setSummary(r.data))
      .finally(() => setLoading(false));
  }, [period]);

  const exportExcel = () => {
    window.open(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/export`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-gray-800">Dashboard ยอดขาย</h1>
          <button
            onClick={exportExcel}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
          >
            Export Excel
          </button>
        </div>

        <div className="flex gap-2 mb-5">
          {(['day', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                period === p ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600'
              }`}
            >
              {p === 'day' ? 'วันนี้' : 'เดือนนี้'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">กำลังโหลด...</div>
        ) : summary ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">รายได้รวม</p>
                <p className="text-3xl font-bold text-orange-500">
                  ฿{summary.totalRevenue.toLocaleString()}
                </p>
              </div>
              <div className="bg-white rounded-2xl p-5 shadow-sm">
                <p className="text-xs text-gray-400 mb-1">จำนวนออเดอร์</p>
                <p className="text-3xl font-bold text-blue-500">{summary.orderCount}</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-500 mb-3">ช่วงเวลาขายดี</h2>
              <SalesChart data={summary.peakHours} />
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-500 mb-3">ท็อปปิ้งยอดฮิต</h2>
              <TopToppings data={summary.topToppings} />
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-gray-400">ไม่มีข้อมูล</div>
        )}
      </div>
    </div>
  );
}

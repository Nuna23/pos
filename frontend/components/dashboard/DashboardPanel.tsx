'use client';

import SalesChart from '@/components/dashboard/SalesChart';
import TopToppings from '@/components/dashboard/TopToppings';
import { api } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

interface DashboardSummary {
  period: string;
  date: string;
  totalRevenue: number;
  orderCount: number;
  peakHours: { hour: number; count: number }[];
  topToppings: { name: string; count: number }[];
}

export default function DashboardPanel() {
  const today = new Date().toISOString().slice(0, 10);
  const [period, setPeriod] = useState<'day' | 'month'>('day');
  const [date, setDate] = useState(today);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Start/end of the selected day or month (for the Excel export window).
  const range = useCallback(() => {
    if (period === 'day') return { start: date, end: date };
    const start = date.slice(0, 8) + '01';
    const d = new Date(date);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { start, end };
  }, [period, date]);

  useEffect(() => {
    setLoading(true);
    api
      .get<DashboardSummary>(`/dashboard/summary?period=${period}&date=${date}`)
      .then((r: import('axios').AxiosResponse<DashboardSummary>) => setSummary(r.data))
      .finally(() => setLoading(false));
  }, [period, date]);

  const exportExcel = () => {
    const { start, end } = range();
    window.open(`${process.env.NEXT_PUBLIC_API_URL}/dashboard/export?start=${start}&end=${end}`, '_blank');
  };

  return (
    <div className="p-4">
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

        <div className="flex gap-2 items-center mb-5">
          {(['day', 'month'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                period === p ? 'bg-orange-500 text-white' : 'bg-white border text-gray-600'
              }`}
            >
              {p === 'day' ? 'รายวัน' : 'รายเดือน'}
            </button>
          ))}
          <input
            type={period === 'day' ? 'date' : 'month'}
            value={period === 'day' ? date : date.slice(0, 7)}
            onChange={(e) => setDate(period === 'day' ? e.target.value : `${e.target.value}-01`)}
            className="ml-auto border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800"
          />
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

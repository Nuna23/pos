'use client';

import BranchQrModal from '@/components/admin/BranchQrModal';
import { api } from '@/lib/api';
import { useCallback, useEffect, useState } from 'react';

interface IngredientRow {
  id: number;
  name: string;
  category: string;
  units: number;
  revenue: number;
  cost: number;
  profit: number;
}

interface Finance {
  period: 'day' | 'month';
  date: string;
  revenue: number;
  cogs: number;
  otherCosts: number;
  oneTimeCosts: number;
  recurringMonthly: number;
  grossProfit: number;
  netProfit: number;
  orderCount: number;
  crepeCount: number;
  grossProfitPerCrepe: number;
  perIngredient: IngredientRow[];
}

type Frequency = 'ONCE' | 'MONTHLY';

interface Expense {
  id: number;
  label: string;
  amount: number;
  spentOn: string;
  frequency: Frequency;
}

const baht = (n: number) => `฿${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function FinancePanel() {
  const today = new Date().toISOString().slice(0, 10);
  const [period, setPeriod] = useState<'day' | 'month'>('day');
  const [date, setDate] = useState(today);
  const [fin, setFin] = useState<Finance | null>(null);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [freq, setFreq] = useState<Frequency>('ONCE');
  const [showQr, setShowQr] = useState(false);

  // Window for the expenses list, matching the selected period.
  const range = useCallback(() => {
    if (period === 'day') return { start: date, end: date };
    const start = date.slice(0, 8) + '01';
    const d = new Date(date);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { start, end };
  }, [period, date]);

  const loadFinance = useCallback(() => {
    api
      .get<Finance>(`/admin/finance?period=${period}&date=${date}`)
      .then((r) => setFin(r.data));
  }, [period, date]);

  const loadExpenses = useCallback(() => {
    const { start, end } = range();
    api
      .get<Expense[]>(`/admin/expenses?start=${start}&end=${end}`)
      .then((r) => setExpenses(r.data));
  }, [range]);

  useEffect(() => {
    loadFinance();
    loadExpenses();
  }, [loadFinance, loadExpenses]);


  const addExpense = async () => {
    const amt = parseFloat(amount);
    if (!label.trim() || isNaN(amt) || amt < 0) return;
    await api.post('/admin/expenses', {
      label: label.trim(),
      amount: amt,
      // One-time costs use the day selected in the period picker above.
      spentOn: date.slice(0, 10),
      frequency: freq,
    });
    setLabel('');
    setAmount('');
    loadExpenses();
    loadFinance();
  };

  const deleteExpense = async (id: number) => {
    await api.delete(`/admin/expenses/${id}`);
    loadExpenses();
    loadFinance();
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {showQr && <BranchQrModal onClose={() => setShowQr(false)} />}

      <button
        onClick={() => setShowQr(true)}
        className="w-full bg-white border border-gray-200 rounded-xl py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        🏷️ ตั้งค่า QR ชำระเงินรายสาขา
      </button>

      {/* Period controls */}
      <div className="flex gap-2 items-center">
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
          onChange={(e) =>
            setDate(period === 'day' ? e.target.value : `${e.target.value}-01`)
          }
          className="ml-auto border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800"
        />
      </div>

      {fin && (
        <>
          {/* Headline numbers */}
          <div className="grid grid-cols-2 gap-3">
            <Stat label="ยอดขาย" value={baht(fin.revenue)} color="text-blue-600" />
            <Stat label="ต้นทุนวัตถุดิบ" value={baht(fin.cogs)} color="text-amber-600" />
            <Stat label="ค่าใช้จ่ายอื่น" value={baht(fin.otherCosts)} color="text-amber-600" />
            <Stat
              label="กำไรสุทธิ"
              value={baht(fin.netProfit)}
              color={fin.netProfit >= 0 ? 'text-green-600' : 'text-red-500'}
            />
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm flex justify-between text-sm">
            <span className="text-gray-500">
              กำไรขั้นต้น {baht(fin.grossProfit)} · {fin.crepeCount} เครป ({fin.orderCount} ออเดอร์)
            </span>
            <span className="text-gray-700 font-medium">
              ~{baht(fin.grossProfitPerCrepe)}/เครป
            </span>
          </div>
          {fin.recurringMonthly > 0 && (
            <p className="text-xs text-gray-400 -mt-1 px-1">
              ค่าใช้จ่ายอื่น = ครั้งเดียว {baht(fin.oneTimeCosts)} + รายเดือนเฉลี่ย{' '}
              {baht(fin.recurringMonthly)}
              {period === 'day' ? '/วัน' : ''}
            </p>
          )}

          {/* Per-ingredient profit */}
          <section className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 mb-2">กำไรต่อวัตถุดิบ</h2>
            {fin.perIngredient.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">ยังไม่มียอดขายในช่วงนี้</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 text-right">
                    <th className="text-left font-normal pb-1">วัตถุดิบ</th>
                    <th className="font-normal pb-1">ขาย</th>
                    <th className="font-normal pb-1">รายได้</th>
                    <th className="font-normal pb-1">ทุน</th>
                    <th className="font-normal pb-1">กำไร</th>
                  </tr>
                </thead>
                <tbody>
                  {fin.perIngredient.map((it) => (
                    <tr key={it.id} className="text-right border-t">
                      <td className="text-left py-1 text-gray-800">{it.name}</td>
                      <td className="text-gray-500">{it.units}</td>
                      <td className="text-gray-500">{baht(it.revenue)}</td>
                      <td className="text-gray-500">{baht(it.cost)}</td>
                      <td className="font-medium text-green-600">{baht(it.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Other costs management */}
          <section className="bg-white rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-gray-500 mb-2">ค่าใช้จ่ายอื่น</h2>

            <div className="space-y-2 mb-3">
              <div className="flex gap-2">
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="รายการ (เช่น ค่าเช่า)"
                  className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="บาท"
                  className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800"
                />
              </div>
              <div className="flex gap-2 items-center">
                {/* one-time vs recurring monthly (spread evenly per day) */}
                {(['ONCE', 'MONTHLY'] as Frequency[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFreq(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      freq === f
                        ? 'bg-gray-800 text-white border-gray-800'
                        : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {f === 'ONCE' ? 'ครั้งเดียว' : 'รายเดือน'}
                  </button>
                ))}
                <button
                  onClick={addExpense}
                  className="ml-auto bg-orange-500 text-white text-sm font-medium px-4 py-1.5 rounded-lg shrink-0"
                >
                  เพิ่ม
                </button>
              </div>
              {freq === 'MONTHLY' && (
                <p className="text-xs text-gray-400">
                  ค่าใช้จ่ายรายเดือนจะถูกเฉลี่ยเท่า ๆ กันทุกวันของเดือน
                </p>
              )}
            </div>

            {expenses.length === 0 ? (
              <p className="text-sm text-gray-400 py-2 text-center">ไม่มีรายการในช่วงนี้</p>
            ) : (
              <div className="space-y-1">
                {expenses.map((ex) => (
                  <div key={ex.id} className="flex items-center text-sm py-1 border-t">
                    <span className="text-gray-700">{ex.label}</span>
                    {ex.frequency === 'MONTHLY' ? (
                      <span className="ml-2 text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">
                        รายเดือน
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs ml-2">{ex.spentOn}</span>
                    )}
                    <span className="text-amber-600 font-medium w-16 text-right ml-auto">
                      {baht(ex.amount)}
                    </span>
                    <button
                      onClick={() => deleteExpense(ex.id)}
                      className="text-red-400 text-xs ml-3"
                    >
                      ลบ
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

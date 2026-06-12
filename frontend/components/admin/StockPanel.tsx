'use client';

import { useToast } from '@/components/ui/useToast';
import { api } from '@/lib/api';
import { useEffect, useState } from 'react';

interface Branch {
  id: number;
  name: string;
}

interface AdminStock {
  id: number;
  name: string;
  category: string;
  stockQuantity: number;
  branchStock: Record<string, number>;
  allocated: number;
  unallocated: number;
}

export default function StockPanel() {
  const { show, view: toast } = useToast();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<AdminStock[]>([]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Branch[]>('/branches'),
      api.get<AdminStock[]>('/admin/stock'),
    ]).then(([b, p]) => {
      setBranches(b.data);
      setProducts(p.data);
    });
  }, []);

  const distribute = async (productId: number, branchId: number, sign: 1 | -1) => {
    const key = `${productId}-${branchId}`;
    const amt = parseFloat(amounts[key] ?? '');
    if (!amt || amt <= 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.post<AdminStock>('/admin/distribute', {
        productId,
        branchId,
        amount: sign * amt,
      });
      setProducts((prev) => prev.map((p) => (p.id === productId ? res.data : p)));
      setAmounts((prev) => ({ ...prev, [key]: '' }));
      const bName = branches.find((b) => b.id === branchId)?.name ?? `สาขา ${branchId}`;
      show(sign > 0 ? `แบ่ง ${amt} ให้ ${bName} แล้ว` : `คืน ${amt} จาก ${bName} แล้ว`);
    } catch {
      const msg =
        sign > 0
          ? 'แบ่งไม่สำเร็จ — สต็อกคงเหลือไม่พอ'
          : 'คืนไม่สำเร็จ — จำนวนเกินที่สาขามีอยู่';
      setError(msg);
      show(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  const shown = query ? products.filter((p) => String(p.id) === query) : products;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-3">
      {toast}
      <p className="text-xs text-gray-400">แบ่งสต็อกวัตถุดิบจากคลังกลางให้แต่ละสาขา</p>
      <select
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white"
      >
        <option value="">ทั้งหมด ({products.length})</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.category === 'DOUGH' ? 'แป้ง' : 'ไส้'})
          </option>
        ))}
      </select>
      {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-3 py-2">
            {error}
          </div>
        )}

        {shown.length === 0 && (
          <p className="text-sm text-gray-400 py-6 text-center">ไม่พบวัตถุดิบ</p>
        )}

        {shown.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-800">{p.name}</p>
                <span className="text-xs text-gray-400">
                  {p.category === 'DOUGH' ? 'แป้ง' : 'ไส้'}
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">คงคลังรวม</p>
                <p className="text-lg font-bold text-gray-800">{p.stockQuantity}</p>
                <p className="text-xs text-green-600">เหลือแบ่ง {p.unallocated}</p>
              </div>
            </div>

            <div className="mt-3 space-y-2 border-t pt-3">
              {branches.map((b) => {
                const key = `${p.id}-${b.id}`;
                return (
                  <div key={b.id} className="flex items-center gap-2">
                    <span className="text-sm text-gray-600 w-14 shrink-0">{b.name}</span>
                    <span className="text-sm font-bold text-orange-500 w-10 text-right shrink-0">
                      {p.branchStock[b.id] ?? 0}
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      min="0"
                      value={amounts[key] ?? ''}
                      onChange={(e) => setAmounts((prev) => ({ ...prev, [key]: e.target.value }))}
                      placeholder="จำนวน"
                      className="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800"
                    />
                    <button
                      onClick={() => distribute(p.id, b.id, 1)}
                      disabled={busy}
                      className="bg-orange-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      ให้
                    </button>
                    <button
                      onClick={() => distribute(p.id, b.id, -1)}
                      disabled={busy}
                      className="bg-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
                    >
                      คืน
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
    </div>
  );
}

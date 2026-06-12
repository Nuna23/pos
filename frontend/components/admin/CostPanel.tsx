'use client';

import { api } from '@/lib/api';
import { Product, ProductCategory } from '@/types';
import { useEffect, useRef, useState } from 'react';

// Ingredient management: add ingredients, edit each one's sell price, and set
// the unit-based cost (cost per unit + crepes per unit -> per-crepe cost, which
// feeds the profit numbers). Unit costs stand in for the shop's Excel sheet.
export default function CostPanel() {
  const [products, setProducts] = useState<Product[]>([]);
  const [price, setPrice] = useState<Record<number, string>>({});
  const [unitCost, setUnitCost] = useState<Record<number, string>>({});
  const [crepes, setCrepes] = useState<Record<number, string>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  // New-ingredient form
  const [nName, setNName] = useState('');
  const [nCat, setNCat] = useState<ProductCategory>('TOPPING');
  const [nPrice, setNPrice] = useState('');
  const [nUnitCost, setNUnitCost] = useState('');
  const [nCrepes, setNCrepes] = useState('');
  const [nStock, setNStock] = useState('');
  const [adding, setAdding] = useState(false);

  // Read-only unallocated (central, not yet given to any branch) per product.
  const [unalloc, setUnalloc] = useState<Record<number, number>>({});

  // Import
  const fileRef = useRef<HTMLInputElement>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const load = () => {
    api.get<Product[]>('/products').then((r) => {
      setProducts(r.data);
      setPrice(Object.fromEntries(r.data.map((p) => [p.id, String(p.price)])));
      setUnitCost(Object.fromEntries(r.data.map((p) => [p.id, String(p.unitCost)])));
      setCrepes(Object.fromEntries(r.data.map((p) => [p.id, String(p.crepesPerUnit)])));
    });
    api
      .get<{ id: number; unallocated: number }[]>('/admin/stock')
      .then((r) => setUnalloc(Object.fromEntries(r.data.map((p) => [p.id, p.unallocated]))))
      .catch(() => {});
  };
  useEffect(load, []);

  const save = async (p: Product) => {
    const pr = parseFloat(price[p.id] ?? '');
    const uc = parseFloat(unitCost[p.id] ?? '');
    const cpu = parseFloat(crepes[p.id] ?? '');
    if (isNaN(pr) || pr <= 0 || isNaN(uc) || uc < 0 || isNaN(cpu) || cpu <= 0) return;
    setSavingId(p.id);
    try {
      const res = await api.patch<Product>(`/products/${p.id}`, {
        price: pr,
        unitCost: uc,
        crepesPerUnit: cpu,
      });
      setProducts((prev) => prev.map((x) => (x.id === p.id ? res.data : x)));
    } finally {
      setSavingId(null);
    }
  };

  const addIngredient = async () => {
    const pr = parseFloat(nPrice);
    if (!nName.trim() || isNaN(pr) || pr <= 0) return;
    setAdding(true);
    try {
      await api.post('/products', {
        name: nName.trim(),
        category: nCat,
        price: pr,
        unitCost: parseFloat(nUnitCost) || 0,
        crepesPerUnit: parseFloat(nCrepes) || 1,
        stockQuantity: parseFloat(nStock) || 0,
        deductionAmount: 1, // 1 serving of stock per crepe
        alertThreshold: 0,
      });
      setNName('');
      setNPrice('');
      setNUnitCost('');
      setNCrepes('');
      setNStock('');
      load();
    } finally {
      setAdding(false);
    }
  };

  const remove = async (p: Product) => {
    if (!window.confirm(`ลบ "${p.name}" ?`)) return;
    await api.delete(`/products/${p.id}`);
    load();
  };

  const importFile = async (file: File) => {
    setImporting(true);
    setImportMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<{ added: number; updated: number; skipped: number }>(
        '/admin/import',
        fd,
      );
      const { added, updated, skipped } = res.data;
      setImportMsg(`นำเข้าสำเร็จ: เพิ่ม ${added} · อัปเดต ${updated} · ข้าม ${skipped}`);
      load();
    } catch (e) {
      const err = e as import('axios').AxiosError<{ error?: string }>;
      setImportMsg(err.response?.data?.error ?? 'นำเข้าไม่สำเร็จ');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const input =
    'border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 min-w-0';

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-3">
      {/* Add ingredient */}
      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
        <h2 className="text-sm font-semibold text-gray-500">เพิ่มวัตถุดิบ</h2>
        <div className="flex gap-2">
          <input
            value={nName}
            onChange={(e) => setNName(e.target.value)}
            placeholder="ชื่อวัตถุดิบ"
            className={`${input} flex-1`}
          />
          {(['DOUGH', 'TOPPING'] as ProductCategory[]).map((c) => (
            <button
              key={c}
              onClick={() => setNCat(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                nCat === c
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {c === 'DOUGH' ? 'แป้ง' : 'ไส้'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Labeled label="ราคาขาย ฿">
            <input type="number" min="0" value={nPrice} onChange={(e) => setNPrice(e.target.value)} className={`${input} w-full`} />
          </Labeled>
          <Labeled label="ทุน/หน่วย ฿">
            <input type="number" min="0" value={nUnitCost} onChange={(e) => setNUnitCost(e.target.value)} className={`${input} w-full`} />
          </Labeled>
          <Labeled label="ทำได้ (เครป)">
            <input type="number" min="1" value={nCrepes} onChange={(e) => setNCrepes(e.target.value)} className={`${input} w-full`} />
          </Labeled>
          <Labeled label="สต็อกเริ่มต้น">
            <input type="number" min="0" value={nStock} onChange={(e) => setNStock(e.target.value)} className={`${input} w-full`} />
          </Labeled>
          <button
            onClick={addIngredient}
            disabled={adding}
            className="self-end bg-orange-500 text-white text-sm font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
          >
            เพิ่มวัตถุดิบ
          </button>
        </div>
      </section>

      {/* Import from Excel / CSV on the admin's machine */}
      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-500">นำเข้าจากไฟล์ Excel</h2>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) importFile(f);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={importing}
            className="bg-green-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg disabled:opacity-50"
          >
            {importing ? 'กำลังนำเข้า...' : 'เลือกไฟล์ (.xlsx / .csv)'}
          </button>
        </div>
        <p className="text-[11px] text-gray-400">
          คอลัมน์: name, category, price, unit_cost, crepes_per_unit (จับคู่ตามชื่อวัตถุดิบ)
        </p>
        {importMsg && <p className="text-xs text-gray-700">{importMsg}</p>}
      </section>

      <p className="text-xs text-gray-400 px-1">
        แก้ราคาขายและต้นทุน (ต้นทุน/เครป = ทุนต่อหน่วย ÷ จำนวนเครป)
      </p>

      {/* Edit existing */}
      {products.map((p) => {
        const pr = parseFloat(price[p.id] ?? '0') || 0;
        const uc = parseFloat(unitCost[p.id] ?? '0') || 0;
        const cpu = parseFloat(crepes[p.id] ?? '0') || 0;
        const perCrepe = cpu > 0 ? uc / cpu : 0;
        const margin = pr - perCrepe;
        return (
          <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-800">
                {p.name}{' '}
                <span className="text-xs text-gray-400">{p.category === 'DOUGH' ? 'แป้ง' : 'ไส้'}</span>
              </p>
              <p className="text-xs text-gray-400">
                ต้นทุน/เครป ฿{perCrepe.toLocaleString(undefined, { maximumFractionDigits: 2 })} · กำไร{' '}
                <span className={margin >= 0 ? 'text-green-600' : 'text-red-500'}>
                  ฿{margin.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </span>
              </p>
            </div>
            <p className="text-xs text-gray-500">
              สต็อกที่ยังไม่ได้แบ่ง (เหลือแบ่ง):{' '}
              <span className="font-semibold text-green-600">
                {(unalloc[p.id] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </p>
            <div className="flex items-end gap-2 flex-wrap">
              <Labeled label="ขาย ฿">
                <input type="number" min="0" value={price[p.id] ?? ''} onChange={(e) => setPrice((s) => ({ ...s, [p.id]: e.target.value }))} className={`${input} w-20`} />
              </Labeled>
              <Labeled label="ทุน/หน่วย ฿">
                <input type="number" min="0" value={unitCost[p.id] ?? ''} onChange={(e) => setUnitCost((s) => ({ ...s, [p.id]: e.target.value }))} className={`${input} w-20`} />
              </Labeled>
              <Labeled label="ทำได้ (เครป)">
                <input type="number" min="1" value={crepes[p.id] ?? ''} onChange={(e) => setCrepes((s) => ({ ...s, [p.id]: e.target.value }))} className={`${input} w-20`} />
              </Labeled>
              <button
                onClick={() => save(p)}
                disabled={savingId === p.id}
                className="ml-auto bg-gray-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                บันทึก
              </button>
              <button
                onClick={() => remove(p)}
                className="bg-red-50 text-red-500 text-xs font-medium px-3 py-1.5 rounded-lg border border-red-200"
              >
                ลบ
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-400">{label}</span>
      {children}
    </label>
  );
}

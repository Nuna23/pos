'use client';

import { useToast } from '@/components/ui/useToast';
import { api } from '@/lib/api';
import { Product, ProductCategory } from '@/types';
import { useEffect, useRef, useState } from 'react';

// Ingredient management: add ingredients, adjust each one's central stock with
// เพิ่ม/ลด dialogs, and edit every field (name, category, price, cost, ทำได้,
// stock) in a single แก้ไข popup. Unit costs stand in for the shop's Excel sheet.
export default function CostPanel() {
  const { show, view: toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);

  // Dropdown filter for the existing-ingredient list ('' = ทั้งหมด).
  const [selId, setSelId] = useState('');

  // Quick stock add/reduce dialog.
  const [stockModal, setStockModal] = useState<{ product: Product; mode: 'add' | 'reduce' } | null>(null);
  const [modalAmount, setModalAmount] = useState('');
  const [modalSaving, setModalSaving] = useState(false);

  // Full edit dialog.
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editSaving, setEditSaving] = useState(false);

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
  const [importing, setImporting] = useState(false);

  const refreshUnalloc = () =>
    api
      .get<{ id: number; unallocated: number }[]>('/admin/stock')
      .then((r) => setUnalloc(Object.fromEntries(r.data.map((p) => [p.id, p.unallocated]))))
      .catch(() => {});

  const load = () => {
    api.get<Product[]>('/products').then((r) => setProducts(r.data));
    refreshUnalloc();
  };
  useEffect(load, []);

  const openStock = (product: Product, mode: 'add' | 'reduce') => {
    setStockModal({ product, mode });
    setModalAmount('');
  };

  const submitStock = async () => {
    if (!stockModal) return;
    const { product, mode } = stockModal;
    const amt = parseFloat(modalAmount);
    if (isNaN(amt) || amt <= 0) {
      show('จำนวนไม่ถูกต้อง', 'error');
      return;
    }
    setModalSaving(true);
    try {
      const delta = mode === 'add' ? amt : -amt;
      const res = await api.patch<Product>(`/products/${product.id}/replenish`, { amount: delta });
      setProducts((prev) => prev.map((x) => (x.id === product.id ? res.data : x)));
      refreshUnalloc();
      show(`${mode === 'add' ? 'เพิ่ม' : 'ลด'}สต็อก "${product.name}" แล้ว (รวม ${res.data.stockQuantity})`);
      setStockModal(null);
    } catch (e) {
      const err = e as import('axios').AxiosError<{ error?: string }>;
      show(err.response?.data?.error ?? 'อัปเดตสต็อกไม่สำเร็จ', 'error');
    } finally {
      setModalSaving(false);
    }
  };

  const saveEdit = async (vals: {
    name: string;
    category: ProductCategory;
    price: number;
    unitCost: number;
    crepesPerUnit: number;
    stockQuantity: number;
  }) => {
    if (!editProduct) return;
    setEditSaving(true);
    try {
      const res = await api.patch<Product>(`/products/${editProduct.id}`, vals);
      setProducts((prev) => prev.map((x) => (x.id === editProduct.id ? res.data : x)));
      refreshUnalloc();
      show(`บันทึก "${vals.name}" แล้ว`);
      setEditProduct(null);
    } catch (e) {
      const err = e as import('axios').AxiosError<{ error?: string }>;
      show(err.response?.data?.error ?? 'บันทึกไม่สำเร็จ', 'error');
    } finally {
      setEditSaving(false);
    }
  };

  const addIngredient = async () => {
    const pr = parseFloat(nPrice);
    const uc = parseFloat(nUnitCost);
    const cp = parseFloat(nCrepes);
    const st = parseFloat(nStock);
    if (!nName.trim()) return show('กรอกชื่อวัตถุดิบ', 'error');
    if (isNaN(pr) || pr <= 0) return show('กรอกราคาขาย (มากกว่า 0)', 'error');
    if (isNaN(uc) || uc < 0) return show('กรอกทุน/หน่วย', 'error');
    if (isNaN(cp) || cp <= 0) return show('กรอกจำนวนเครปที่ทำได้ (มากกว่า 0)', 'error');
    if (isNaN(st) || st < 0) return show('กรอกสต็อกเริ่มต้น', 'error');
    setAdding(true);
    try {
      await api.post('/products', {
        name: nName.trim(),
        category: nCat,
        price: pr,
        unitCost: uc,
        crepesPerUnit: cp,
        stockQuantity: st,
        deductionAmount: 1, // 1 serving of stock per crepe
        alertThreshold: 0,
      });
      const added = nName.trim();
      setNName('');
      setNPrice('');
      setNUnitCost('');
      setNCrepes('');
      setNStock('');
      load();
      show(`เพิ่มวัตถุดิบ "${added}" แล้ว`);
    } catch (e) {
      const err = e as import('axios').AxiosError<{ error?: string }>;
      show(err.response?.data?.error ?? 'เพิ่มวัตถุดิบไม่สำเร็จ', 'error');
    } finally {
      setAdding(false);
    }
  };

  const remove = async (p: Product) => {
    if (!window.confirm(`ลบ "${p.name}" ?`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      load();
      show(`ลบ "${p.name}" แล้ว`);
    } catch {
      show('ลบไม่สำเร็จ', 'error');
    }
  };

  const importFile = async (file: File) => {
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<{ added: number; updated: number; skipped: number }>(
        '/admin/import',
        fd,
      );
      const { added, updated, skipped } = res.data;
      show(`นำเข้าสำเร็จ: เพิ่ม ${added} · อัปเดต ${updated} · ข้าม ${skipped}`);
      load();
    } catch (e) {
      const err = e as import('axios').AxiosError<{ error?: string }>;
      show(err.response?.data?.error ?? 'นำเข้าไม่สำเร็จ', 'error');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const input =
    'border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-800 min-w-0';

  const shown = selId ? products.filter((p) => String(p.id) === selId) : products;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-3">
      {toast}
      {/* Add new ingredient — every field is required (marked *). */}
      <section className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
        <h2 className="text-sm font-semibold text-gray-500">เพิ่มวัตถุดิบใหม่</h2>
        <div className="grid grid-cols-2 gap-2">
          <Labeled label="ชื่อวัตถุดิบ" req>
            <input
              value={nName}
              onChange={(e) => setNName(e.target.value)}
              placeholder="ชื่อวัตถุดิบ"
              className={`${input} w-full`}
            />
          </Labeled>
          <Labeled label="ประเภท" req>
            <div className="flex gap-2">
              {(['DOUGH', 'TOPPING'] as ProductCategory[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setNCat(c)}
                  className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    nCat === c
                      ? 'bg-gray-800 text-white border-gray-800'
                      : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  {c === 'DOUGH' ? 'แป้ง' : 'ไส้'}
                </button>
              ))}
            </div>
          </Labeled>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Labeled label="ราคาขาย ฿" req>
            <input type="number" min="0" value={nPrice} onChange={(e) => setNPrice(e.target.value)} className={`${input} w-full`} />
          </Labeled>
          <Labeled label="ทุน/หน่วย ฿" req>
            <input type="number" min="0" value={nUnitCost} onChange={(e) => setNUnitCost(e.target.value)} className={`${input} w-full`} />
          </Labeled>
          <Labeled label="ทำได้ (เครป)" req>
            <input type="number" min="1" value={nCrepes} onChange={(e) => setNCrepes(e.target.value)} className={`${input} w-full`} />
          </Labeled>
          <Labeled label="สต็อกเริ่มต้น" req>
            <input type="number" min="0" value={nStock} onChange={(e) => setNStock(e.target.value)} className={`${input} w-full`} />
          </Labeled>
        </div>
        <button
          onClick={addIngredient}
          disabled={adding}
          className="w-full bg-orange-500 text-white text-sm font-medium px-3 py-2 rounded-lg disabled:opacity-50"
        >
          {adding ? 'กำลังเพิ่ม...' : '+ เพิ่มวัตถุดิบ'}
        </button>
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
      </section>

      {/* Pick an ingredient (dropdown) */}
      <select
        value={selId}
        onChange={(e) => setSelId(e.target.value)}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 bg-white"
      >
        <option value="">ทั้งหมด ({products.length})</option>
        {products.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name} ({p.category === 'DOUGH' ? 'แป้ง' : 'ไส้'})
          </option>
        ))}
      </select>

      {/* Existing ingredients */}
      {shown.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">ไม่พบวัตถุดิบ</p>
      ) : (
        shown.map((p) => {
          const perCrepe = p.crepesPerUnit > 0 ? p.unitCost / p.crepesPerUnit : 0;
          const margin = p.price - perCrepe;
          return (
            <div key={p.id} className="bg-white rounded-xl p-3 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-800">
                  {p.name}{' '}
                  <span className="text-xs text-gray-400">{p.category === 'DOUGH' ? 'แป้ง' : 'ไส้'}</span>
                </p>
                <p className="text-xs text-gray-400">
                  ขาย ฿{Number(p.price).toLocaleString()} · ทุน/เครป ฿
                  {perCrepe.toLocaleString(undefined, { maximumFractionDigits: 2 })} · กำไร{' '}
                  <span className={margin >= 0 ? 'text-green-600' : 'text-red-500'}>
                    ฿{margin.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 flex-wrap">
                <span className="text-xs text-gray-500">
                  สต็อกรวม{' '}
                  <span className="font-bold text-gray-800">
                    {p.stockQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                  {' · '}เหลือแบ่ง{' '}
                  <span className="font-semibold text-green-600">
                    {(unalloc[p.id] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </span>
                <div className="ml-auto flex gap-1.5">
                  <button
                    onClick={() => openStock(p, 'add')}
                    className="bg-green-50 text-green-700 border border-green-200 text-xs font-medium px-2.5 py-1.5 rounded-lg"
                  >
                    เพิ่ม
                  </button>
                  <button
                    onClick={() => openStock(p, 'reduce')}
                    className="bg-amber-50 text-amber-700 border border-amber-200 text-xs font-medium px-2.5 py-1.5 rounded-lg"
                  >
                    ลด
                  </button>
                  <button
                    onClick={() => setEditProduct(p)}
                    className="bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-2.5 py-1.5 rounded-lg"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => remove(p)}
                    className="bg-red-50 text-red-500 border border-red-200 text-xs font-medium px-2.5 py-1.5 rounded-lg"
                  >
                    ลบ
                  </button>
                </div>
              </div>
            </div>
          );
        })
      )}

      {/* Quick stock add/reduce dialog */}
      {stockModal && (
        <StockDialog
          product={stockModal.product}
          mode={stockModal.mode}
          amount={modalAmount}
          setAmount={setModalAmount}
          saving={modalSaving}
          onCancel={() => setStockModal(null)}
          onSubmit={submitStock}
        />
      )}

      {/* Full edit dialog */}
      {editProduct && (
        <EditDialog
          product={editProduct}
          saving={editSaving}
          onCancel={() => setEditProduct(null)}
          onSave={saveEdit}
          notify={show}
        />
      )}
    </div>
  );
}

function StockDialog({
  product,
  mode,
  amount,
  setAmount,
  saving,
  onCancel,
  onSubmit,
}: {
  product: Product;
  mode: 'add' | 'reduce';
  amount: string;
  setAmount: (v: string) => void;
  saving: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const title = mode === 'add' ? 'เพิ่มสต็อก' : 'ลดสต็อก';
  const amt = parseFloat(amount) || 0;
  const preview = mode === 'add' ? product.stockQuantity + amt : product.stockQuantity - amt;

  return (
    <Modal title={title} onCancel={onCancel}>
      <p className="text-xs text-gray-500">
        {product.name} · สต็อกรวมปัจจุบัน{' '}
        <span className="font-semibold text-gray-800">{product.stockQuantity}</span>
      </p>
      <label className="block">
        <span className="text-[11px] text-gray-400">จำนวน *</span>
        <input
          type="number"
          min="0"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !saving) onSubmit();
          }}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 mt-1"
        />
      </label>
      <p className="text-xs text-gray-500">
        สต็อกรวมใหม่:{' '}
        <span className={`font-bold ${preview < 0 ? 'text-red-500' : 'text-gray-800'}`}>
          {preview.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </p>
      <DialogActions saving={saving} onCancel={onCancel} onSubmit={onSubmit} />
    </Modal>
  );
}

function EditDialog({
  product,
  saving,
  onCancel,
  onSave,
  notify,
}: {
  product: Product;
  saving: boolean;
  onCancel: () => void;
  onSave: (vals: {
    name: string;
    category: ProductCategory;
    price: number;
    unitCost: number;
    crepesPerUnit: number;
    stockQuantity: number;
  }) => void;
  notify: (text: string, kind?: 'success' | 'error' | 'info') => void;
}) {
  const [name, setName] = useState(product.name);
  const [cat, setCat] = useState<ProductCategory>(product.category);
  const [price, setPrice] = useState(String(product.price));
  const [unitCost, setUnitCost] = useState(String(product.unitCost));
  const [crepes, setCrepes] = useState(String(product.crepesPerUnit));
  const [stock, setStock] = useState(String(product.stockQuantity));

  const input = 'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 mt-1';

  const submit = () => {
    const pr = parseFloat(price);
    const uc = parseFloat(unitCost);
    const cp = parseFloat(crepes);
    const st = parseFloat(stock);
    if (!name.trim()) return notify('กรอกชื่อวัตถุดิบ', 'error');
    if (isNaN(pr) || pr <= 0) return notify('กรอกราคาขาย (มากกว่า 0)', 'error');
    if (isNaN(uc) || uc < 0) return notify('กรอกทุน/หน่วย', 'error');
    if (isNaN(cp) || cp <= 0) return notify('กรอกจำนวนเครปที่ทำได้ (มากกว่า 0)', 'error');
    if (isNaN(st) || st < 0) return notify('กรอกสต็อก', 'error');
    onSave({
      name: name.trim(),
      category: cat,
      price: pr,
      unitCost: uc,
      crepesPerUnit: cp,
      stockQuantity: st,
    });
  };

  return (
    <Modal title="แก้ไขวัตถุดิบ" onCancel={onCancel}>
      <label className="block">
        <span className="text-[11px] text-gray-400">ชื่อวัตถุดิบ *</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
      </label>
      <div>
        <span className="text-[11px] text-gray-400">ประเภท *</span>
        <div className="flex gap-2 mt-1">
          {(['DOUGH', 'TOPPING'] as ProductCategory[]).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition ${
                cat === c
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {c === 'DOUGH' ? 'แป้ง' : 'ไส้'}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-[11px] text-gray-400">ราคาขาย ฿ *</span>
          <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className="text-[11px] text-gray-400">ทุน/หน่วย ฿ *</span>
          <input type="number" min="0" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className="text-[11px] text-gray-400">ทำได้ (เครป) *</span>
          <input type="number" min="1" value={crepes} onChange={(e) => setCrepes(e.target.value)} className={input} />
        </label>
        <label className="block">
          <span className="text-[11px] text-gray-400">สต็อกรวม *</span>
          <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className={input} />
        </label>
      </div>
      <DialogActions saving={saving} onCancel={onCancel} onSubmit={submit} />
    </Modal>
  );
}

function Modal({
  title,
  onCancel,
  children,
}: {
  title: string;
  onCancel: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800">{title}</h2>
          <button onClick={onCancel} className="text-gray-400 text-sm">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DialogActions({
  saving,
  onCancel,
  onSubmit,
}: {
  saving: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <button onClick={onCancel} className="flex-1 bg-gray-100 text-gray-700 text-sm font-medium py-2 rounded-lg">
        ยกเลิก
      </button>
      <button
        onClick={onSubmit}
        disabled={saving}
        className="flex-1 bg-orange-500 text-white text-sm font-medium py-2 rounded-lg disabled:opacity-50"
      >
        {saving ? 'กำลังบันทึก...' : 'บันทึก'}
      </button>
    </div>
  );
}

function Labeled({
  label,
  req,
  children,
}: {
  label: string;
  req?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] text-gray-400">
        {label}
        {req && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}

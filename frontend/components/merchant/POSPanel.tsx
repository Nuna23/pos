'use client';

import { api } from '@/lib/api';
import { Order, Product } from '@/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface CartItem {
  baseDough: Product;
  toppings: Product[];
}

export default function POSPanel() {
  const [doughs, setDoughs] = useState<Product[]>([]);
  const [toppings, setToppings] = useState<Product[]>([]);
  const [selectedDough, setSelectedDough] = useState<Product | null>(null);
  const [selectedToppings, setSelectedToppings] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [lastOrder, setLastOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get<Product[]>('/products?category=DOUGH'),
      api.get<Product[]>('/products?category=TOPPING'),
    ]).then(([d, t]) => {
      setDoughs(d.data);
      setToppings(t.data);
    });
  }, []);

  const toggleTopping = (t: Product) => {
    setSelectedToppings((prev) =>
      prev.find((x) => x.id === t.id) ? prev.filter((x) => x.id !== t.id) : [...prev, t],
    );
  };

  const addToCart = () => {
    if (!selectedDough) return;
    setCart((prev) => [...prev, { baseDough: selectedDough, toppings: selectedToppings }]);
    setSelectedDough(null);
    setSelectedToppings([]);
  };

  const removeFromCart = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalPrice = cart.reduce(
    (sum, item) =>
      sum + Number(item.baseDough.price) + item.toppings.reduce((s, t) => s + Number(t.price), 0),
    0,
  );

  const submitOrder = async () => {
    if (cart.length === 0) return;
    setLoading(true);
    try {
      const res = await api.post<Order>('/orders', {
        items: cart.map((item) => ({
          baseDoughId: item.baseDough.id,
          toppingIds: item.toppings.map((t) => t.id),
        })),
      });
      setLastOrder(res.data);
      setCart([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-orange-500 text-white px-4 py-3 flex items-center justify-between">
        <h1 className="font-bold text-base">CrepePOS — แม่ค้า</h1>
        <Link href="/merchant/board" className="text-xs bg-white/20 px-2 py-1 rounded-lg">
          กระดานเตา
        </Link>
      </header>

      <div className="p-4 space-y-5">
        {lastOrder && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 text-center">
            <p className="text-green-700 font-bold text-lg">
              สั่งเสร็จแล้ว! คิว #{lastOrder.queueNumber}
            </p>
            <button onClick={() => setLastOrder(null)} className="mt-1 text-xs text-green-500 underline">
              ปิด
            </button>
          </div>
        )}

        <section>
          <h2 className="font-semibold text-gray-700 mb-2 text-sm">เลือกแป้ง</h2>
          <div className="grid grid-cols-2 gap-2">
            {doughs.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDough(d)}
                className={`py-3 px-3 rounded-xl text-sm font-medium border-2 transition ${
                  selectedDough?.id === d.id
                    ? 'bg-orange-500 text-white border-orange-500'
                    : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {d.name}
                <br />
                <span className="text-xs opacity-70">฿{Number(d.price)}</span>
              </button>
            ))}
          </div>
        </section>

        {selectedDough && (
          <section>
            <h2 className="font-semibold text-gray-700 mb-2 text-sm">
              เลือกไส้ (ได้หลายอย่าง)
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {toppings.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTopping(t)}
                  className={`py-2 px-1 rounded-xl text-xs font-medium border-2 transition ${
                    selectedToppings.find((x) => x.id === t.id)
                      ? 'bg-amber-400 text-white border-amber-400'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  {t.name}
                  <br />
                  <span className="opacity-70">฿{Number(t.price)}</span>
                </button>
              ))}
            </div>
            <button
              onClick={addToCart}
              className="mt-3 w-full bg-orange-500 text-white py-3 rounded-xl font-semibold text-sm"
            >
              + เพิ่มลงตะกร้า
            </button>
          </section>
        )}

        {cart.length > 0 && (
          <section>
            <h2 className="font-semibold text-gray-700 mb-2 text-sm">
              ตะกร้า ({cart.length} แผ่น)
            </h2>
            <div className="space-y-2">
              {cart.map((item, idx) => (
                <div key={idx} className="bg-white rounded-xl p-3 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{item.baseDough.name}</p>
                    {item.toppings.length > 0 && (
                      <p className="text-xs text-gray-400">
                        + {item.toppings.map((t) => t.name).join(', ')}
                      </p>
                    )}
                  </div>
                  <button onClick={() => removeFromCart(idx)} className="text-red-400 text-xs ml-2">
                    ลบ
                  </button>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-3 bg-white rounded-xl p-4">
              <span className="font-bold text-gray-800">รวม</span>
              <span className="text-xl font-bold text-orange-500">฿{totalPrice}</span>
            </div>

            <button
              onClick={submitOrder}
              disabled={loading}
              className="mt-3 w-full bg-orange-600 text-white py-4 rounded-xl text-lg font-bold disabled:opacity-50 transition"
            >
              {loading ? 'กำลังสั่ง...' : 'สั่งเครป'}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

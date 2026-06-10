'use client';

import ToppingPicker from '@/components/customer/ToppingPicker';
import { api } from '@/lib/api';
import { Order, Product } from '@/types';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type Step = 'dough' | 'toppings' | 'review';

interface CartItem {
  baseDough: Product;
  toppings: Product[];
}

export default function MenuSelector() {
  const router = useRouter();
  const [doughs, setDoughs] = useState<Product[]>([]);
  const [toppings, setToppings] = useState<Product[]>([]);
  const [step, setStep] = useState<Step>('dough');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [currentDough, setCurrentDough] = useState<Product | null>(null);
  const [currentToppings, setCurrentToppings] = useState<Product[]>([]);
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

  const selectDough = (d: Product) => {
    setCurrentDough(d);
    setStep('toppings');
  };

  const confirmCrepe = () => {
    if (!currentDough) return;
    setCart((prev) => [...prev, { baseDough: currentDough, toppings: currentToppings }]);
    setCurrentDough(null);
    setCurrentToppings([]);
    setStep('review');
  };

  const totalPrice = cart.reduce(
    (sum, item) =>
      sum + Number(item.baseDough.price) + item.toppings.reduce((s, t) => s + Number(t.price), 0),
    0,
  );

  const placeOrder = async () => {
    setLoading(true);
    try {
      let pushSubscription = null;

      if ('serviceWorker' in navigator && 'PushManager' in window) {
        try {
          const reg = await navigator.serviceWorker.register('/sw.js');
          const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
          });
          const subJson = sub.toJSON();
          if (subJson.keys) {
            pushSubscription = {
              endpoint: sub.endpoint,
              p256dh: subJson.keys.p256dh,
              auth: subJson.keys.auth,
            };
          }
        } catch {
          // Push denied — order proceeds without web push
        }
      }

      const res = await api.post<Order>('/orders', {
        items: cart.map((item) => ({
          baseDoughId: item.baseDough.id,
          toppingIds: item.toppings.map((t) => t.id),
        })),
        pushSubscription,
      });

      router.push(`/queue/${res.data.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-orange-50">
      <header className="bg-orange-500 text-white px-4 py-4 text-center">
        <div className="text-2xl">🥞</div>
        <h1 className="font-bold text-lg">สั่งเครป</h1>
      </header>

      <div className="p-4 space-y-5">
        {(step === 'dough' || step === 'toppings') && (
          <section>
            <h2 className="font-bold text-gray-700 mb-3 text-sm">
              1. เลือกแป้ง{' '}
              <span className="text-red-400 font-normal text-xs">*จำเป็น</span>
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {doughs.map((d) => (
                <button
                  key={d.id}
                  onClick={() => selectDough(d)}
                  className={`py-4 px-3 rounded-2xl text-sm font-medium border-2 transition active:scale-95 ${
                    currentDough?.id === d.id
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
        )}

        {step === 'toppings' && currentDough && (
          <section>
            <h2 className="font-bold text-gray-700 mb-1 text-sm">
              2. เลือกไส้ (ได้หลายอย่าง)
            </h2>
            <p className="text-xs text-gray-400 mb-3">แป้ง: {currentDough.name}</p>
            <ToppingPicker
              toppings={toppings}
              selected={currentToppings}
              onToggle={(t) =>
                setCurrentToppings((prev) =>
                  prev.find((x) => x.id === t.id) ? prev.filter((x) => x.id !== t.id) : [...prev, t],
                )
              }
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setStep('dough')}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-xl font-medium text-sm"
              >
                ← เปลี่ยนแป้ง
              </button>
              <button
                onClick={confirmCrepe}
                className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-semibold text-sm"
              >
                ยืนยัน →
              </button>
            </div>
          </section>
        )}

        {step === 'review' && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-700 text-sm">ออเดอร์ของคุณ</h2>
              <button onClick={() => setStep('dough')} className="text-orange-500 text-xs underline">
                + เพิ่มเครป
              </button>
            </div>
            <div className="space-y-2">
              {cart.map((item, idx) => (
                <div key={idx} className="bg-white rounded-xl p-3">
                  <p className="font-medium text-sm">{item.baseDough.name}</p>
                  {item.toppings.length > 0 && (
                    <p className="text-xs text-gray-400">
                      + {item.toppings.map((t) => t.name).join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 bg-white rounded-xl p-4">
              <span className="font-bold text-gray-800">รวม</span>
              <span className="text-xl font-bold text-orange-500">฿{totalPrice}</span>
            </div>
            <button
              onClick={placeOrder}
              disabled={loading}
              className="mt-3 w-full bg-orange-600 text-white py-4 rounded-2xl text-lg font-bold disabled:opacity-50 shadow-lg transition"
            >
              {loading ? 'กำลังสั่ง...' : `สั่งเครป ฿${totalPrice}`}
            </button>
          </section>
        )}
      </div>
    </div>
  );
}

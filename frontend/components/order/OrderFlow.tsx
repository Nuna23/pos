'use client';

import ToppingPicker from '@/components/customer/ToppingPicker';
import PaymentModal from '@/components/order/PaymentModal';
import { api } from '@/lib/api';
import { getPushSubscription } from '@/lib/push';
import { Order, PaymentMethod, Product } from '@/types';
import { useCallback, useEffect, useState } from 'react';

interface CartLine {
  baseDough: Product;
  toppings: Product[];
  quantity: number;
}

interface Props {
  // 'customer' subscribes to web push so they can be notified when ready;
  // 'merchant' is the shop taking a walk-up order. Otherwise identical.
  mode: 'customer' | 'merchant';
  // Orders are placed for this branch and constrained to its stock.
  branchId: number;
  onPlaced: (order: Order) => void;
}

// Identity of a crepe configuration, so identical builds stack as a quantity.
function lineKey(doughId: number, toppingIds: number[]): string {
  return `${doughId}:${[...toppingIds].sort((a, b) => a - b).join(',')}`;
}

function linePrice(line: CartLine): number {
  const unit =
    Number(line.baseDough.price) + line.toppings.reduce((s, t) => s + Number(t.price), 0);
  return unit * line.quantity;
}

export default function OrderFlow({ mode, branchId, onPlaced }: Props) {
  const [doughs, setDoughs] = useState<Product[]>([]);
  const [toppings, setToppings] = useState<Product[]>([]);
  // Branch stock per product id; an ingredient is out of stock if the branch
  // has less than one crepe's worth (its deductionAmount).
  const [available, setAvailable] = useState<Record<number, number>>({});
  const [selectedDough, setSelectedDough] = useState<Product | null>(null);
  const [selectedToppings, setSelectedToppings] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [showPayment, setShowPayment] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branchQr, setBranchQr] = useState<string | null>(null);

  const loadAvailability = useCallback(() => {
    api
      .get<{ id: number; quantity: number }[]>(`/branches/${branchId}/stock`)
      .then((r) => {
        const map: Record<number, number> = {};
        for (const it of r.data) map[it.id] = it.quantity;
        setAvailable(map);
      })
      .catch(() => {});
  }, [branchId]);

  useEffect(() => {
    Promise.all([
      api.get<Product[]>('/products?category=DOUGH'),
      api.get<Product[]>('/products?category=TOPPING'),
    ]).then(([d, t]) => {
      setDoughs(d.data);
      setToppings(t.data);
    });
  }, []);

  useEffect(loadAvailability, [loadAvailability]);

  // The branch's payment QR image to show at checkout.
  useEffect(() => {
    api
      .get<{ qrImage: string | null }>(`/branches/${branchId}`)
      .then((r) => setBranchQr(r.data.qrImage))
      .catch(() => {});
  }, [branchId]);

  const inStock = (p: Product) => (available[p.id] ?? 0) >= p.deductionAmount;

  const toggleTopping = (t: Product) => {
    if (!inStock(t)) return;
    setSelectedToppings((prev) =>
      prev.find((x) => x.id === t.id) ? prev.filter((x) => x.id !== t.id) : [...prev, t],
    );
  };

  const addToCart = () => {
    if (!selectedDough) return;
    const key = lineKey(
      selectedDough.id,
      selectedToppings.map((t) => t.id),
    );
    setCart((prev) => {
      const existing = prev.find((l) => lineKey(l.baseDough.id, l.toppings.map((t) => t.id)) === key);
      if (existing) {
        return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { baseDough: selectedDough, toppings: selectedToppings, quantity: 1 }];
    });
    setSelectedDough(null);
    setSelectedToppings([]);
  };

  const changeQty = (idx: number, delta: number) =>
    setCart((prev) =>
      prev
        .map((l, i) => (i === idx ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );

  const totalQty = cart.reduce((s, l) => s + l.quantity, 0);
  const totalPrice = cart.reduce((s, l) => s + linePrice(l), 0);

  const placeOrder = async (paymentMethod: PaymentMethod) => {
    if (cart.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      // A customer ordering on their own phone subscribes to web push (while we
      // have their tap, for the permission prompt) so the backend can notify
      // them when the crepe is ready — even with the page closed/phone locked.
      // The queue page also fires a local notification as a foreground fallback.
      let pushSubscription = null;
      if (mode === 'customer') {
        pushSubscription = await getPushSubscription();
      }

      // Each cart line expands to `quantity` identical items; the whole cart is
      // one order.
      const items = cart.flatMap((line) =>
        Array.from({ length: line.quantity }, () => ({
          baseDoughId: line.baseDough.id,
          toppingIds: line.toppings.map((t) => t.id),
        })),
      );

      const res = await api.post<Order>('/orders', {
        branchId,
        items,
        paymentMethod,
        ...(pushSubscription ? { pushSubscription } : {}),
      });
      setCart([]);
      setShowPayment(false);
      onPlaced(res.data);
    } catch (e) {
      const err = e as import('axios').AxiosError<{ error?: string; product?: string }>;
      setShowPayment(false);
      if (err.response?.status === 409) {
        setError(`${err.response.data?.product ?? 'วัตถุดิบบางอย่าง'} หมดแล้ว — กรุณาเลือกใหม่`);
        loadAvailability();
      } else {
        setError('สั่งไม่สำเร็จ กรุณาลองใหม่');
      }
    } finally {
      setLoading(false);
    }
  };

  const outOfStockToppingIds = new Set(toppings.filter((t) => !inStock(t)).map((t) => t.id));

  return (
    <div className="p-4 space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-3 py-2">
          {error}
        </div>
      )}

      {/* Build a crepe */}
      <section>
        <h2 className="font-semibold text-gray-700 mb-2 text-sm">
          1. เลือกแป้ง <span className="text-red-400 font-normal text-xs">*จำเป็น</span>
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {doughs.map((d) => {
            const ok = inStock(d);
            return (
              <button
                key={d.id}
                onClick={() => ok && setSelectedDough(d)}
                disabled={!ok}
                className={`relative py-3 px-3 rounded-xl text-sm font-medium border-2 transition active:scale-95 ${
                  !ok
                    ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-not-allowed'
                    : selectedDough?.id === d.id
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-white text-gray-700 border-gray-200'
                }`}
              >
                {d.name}
                <br />
                <span className="text-xs opacity-70">{ok ? `฿${Number(d.price)}` : 'หมด'}</span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedDough && (
        <section>
          <h2 className="font-semibold text-gray-700 mb-2 text-sm">2. เลือกไส้ (ได้หลายอย่าง)</h2>
          <ToppingPicker
            toppings={toppings}
            selected={selectedToppings}
            disabledIds={outOfStockToppingIds}
            onToggle={toggleTopping}
          />
          <button
            onClick={addToCart}
            className="mt-3 w-full bg-orange-500 text-white py-3 rounded-xl font-semibold text-sm active:scale-95 transition"
          >
            + เพิ่มใส่ตะกร้า
          </button>
        </section>
      )}

      {/* Cart — a bold, bordered panel with its own header bar so it reads as a
          clearly separate zone from the crepe-building area above. */}
      {cart.length > 0 && (
        <section className="rounded-3xl border-2 border-orange-300 bg-white shadow-xl overflow-hidden">
          <div className="bg-orange-500 text-white px-4 py-3 flex items-center gap-2">
            <span className="text-lg">🛒</span>
            <h2 className="font-bold text-base">ตะกร้า</h2>
            <span className="ml-auto bg-white/25 rounded-full px-2.5 py-0.5 text-xs font-semibold">
              {totalQty} แผ่น
            </span>
          </div>

          <div className="p-3">
            <div className="space-y-2">
              {cart.map((line, idx) => (
                <div key={idx} className="bg-orange-50 rounded-xl p-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{line.baseDough.name}</p>
                    {line.toppings.length > 0 && (
                      <p className="text-xs text-gray-400 truncate">
                        + {line.toppings.map((t) => t.name).join(', ')}
                      </p>
                    )}
                    <p className="text-xs text-orange-500 font-medium mt-0.5">฿{linePrice(line)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => changeQty(idx, -1)}
                      className="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-700 font-bold leading-none"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-semibold text-gray-800">{line.quantity}</span>
                    <button
                      onClick={() => changeQty(idx, 1)}
                      className="w-7 h-7 rounded-full bg-orange-500 text-white font-bold leading-none"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-dashed border-orange-200">
              <span className="font-bold text-gray-800">รวม</span>
              <span className="text-2xl font-bold text-orange-500">฿{totalPrice}</span>
            </div>

            <button
              onClick={() => setShowPayment(true)}
              className="mt-3 w-full bg-orange-600 text-white py-4 rounded-2xl text-lg font-bold shadow-lg active:scale-95 transition"
            >
              ชำระเงิน ฿{totalPrice}
            </button>
          </div>
        </section>
      )}

      {showPayment && (
        <PaymentModal
          amount={totalPrice}
          loading={loading}
          qrImage={branchQr}
          onClose={() => setShowPayment(false)}
          onConfirm={placeOrder}
        />
      )}
    </div>
  );
}

'use client';

import { api } from '@/lib/api';
import { Order, OrderStatus } from '@/types';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

// The PHP backend has no websocket, so the tracker polls for status changes.
const POLL_INTERVAL = 3000;

// Show a local "crepe ready" notification when the order turns DONE. This works
// on any backend (including PHP 5.6) — it's fired by the page that's polling,
// not pushed from the server. Falls back to nothing if permission isn't granted.
function notifyReady(order: Order) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const title = 'เครปของคุณพร้อมแล้ว! 🥞';
  const body = `คิวที่ ${order.queueNumber} มารับได้เลย`;
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => reg.showNotification(title, { body, icon: '/icon-192.png' }))
      .catch(() => {
        try {
          new Notification(title, { body });
        } catch {
          /* ignore */
        }
      });
  } else {
    try {
      new Notification(title, { body });
    } catch {
      /* ignore */
    }
  }
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; emoji: string; color: string }> = {
  PENDING: { label: 'รอทำ', emoji: '⏳', color: 'text-yellow-500' },
  COOKING: { label: 'กำลังลงเตา 🔥', emoji: '👩‍🍳', color: 'text-orange-500' },
  DONE: { label: 'พร้อมรับแล้ว!', emoji: '✅', color: 'text-green-500' },
  CANCELLED: { label: 'ยกเลิกแล้ว', emoji: '❌', color: 'text-red-400' },
};

interface Props {
  orderId: number;
}

export default function QueueTracker({ orderId }: Props) {
  const [order, setOrder] = useState<Order | null>(null);
  const notifiedRef = useRef(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval>;

    const load = () =>
      api
        .get<Order>(`/orders/${orderId}`)
        .then((r: import('axios').AxiosResponse<Order>) => {
          if (!active) return;
          // Fire the "ready" notification once, on the transition to DONE.
          if (r.data.status === 'DONE' && !notifiedRef.current) {
            notifiedRef.current = true;
            notifyReady(r.data);
          }
          setOrder(r.data);
          // No more changes coming once the order is finished — stop polling.
          if (r.data.status === 'DONE' || r.data.status === 'CANCELLED') {
            clearInterval(timer);
          }
        })
        .catch(() => {});

    load();
    timer = setInterval(load, POLL_INTERVAL);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [orderId]);

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">กำลังโหลด...</p>
      </div>
    );
  }

  const config = STATUS_CONFIG[order.status];

  return (
    <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-4 w-full max-w-sm">
        <div className="text-6xl">{config.emoji}</div>

        <div className="bg-white rounded-3xl p-8 shadow-md">
          <p className="text-gray-400 text-sm mb-1">เลขคิวของคุณ</p>
          <p className="text-6xl font-bold text-orange-500">{order.queueNumber}</p>
          <p className={`mt-3 text-xl font-bold ${config.color}`}>{config.label}</p>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm text-left">
          <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">
            ออเดอร์ของคุณ
          </p>
          {order.items.map((item, idx) => (
            <div key={idx} className="text-sm mb-1">
              <span className="font-medium">{item.baseDough.name}</span>
              {item.toppings.length > 0 && (
                <span className="text-gray-400">
                  {' + '}
                  {item.toppings.map((t) => t.product.name).join(', ')}
                </span>
              )}
            </div>
          ))}
          <p className="mt-3 font-bold text-orange-500">฿{Number(order.totalPrice)}</p>
        </div>

        {order.status === 'DONE' && (
          <div className="bg-green-500 text-white rounded-2xl p-5 text-center">
            <p className="font-bold text-lg">เครปของคุณพร้อมแล้ว!</p>
            <p className="text-sm opacity-90 mt-1">มารับได้เลยครับ/ค่ะ 🥞</p>
          </div>
        )}

        <Link
          href={order.branchId ? `/order/${order.branchId}` : '/order'}
          className="block w-full bg-white border-2 border-orange-400 text-orange-500 py-3 rounded-2xl font-semibold shadow-sm hover:bg-orange-100 transition"
        >
          ← กลับไปสั่งเครป
        </Link>
      </div>
    </div>
  );
}

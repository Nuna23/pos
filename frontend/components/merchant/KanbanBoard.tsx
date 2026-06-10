'use client';

import OrderCard from '@/components/merchant/OrderCard';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { Order, OrderStatus } from '@/types';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const COLUMNS: { id: OrderStatus; label: string; color: string }[] = [
  { id: 'PENDING', label: 'รอทำ', color: 'bg-yellow-50 border-yellow-200' },
  { id: 'COOKING', label: 'กำลังลงเตา', color: 'bg-orange-50 border-orange-200' },
  { id: 'DONE', label: 'เสร็จแล้ว', color: 'bg-green-50 border-green-200' },
];

export default function KanbanBoard() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    api.get<Order[]>('/orders/today').then((r: import('axios').AxiosResponse<Order[]>) => setOrders(r.data));

    const s = getSocket();
    if (!s) return;

    s.on('order:new', (order: Order) => {
      setOrders((prev) => [order, ...prev]);
    });
    s.on('order:updated', (updated: Order) => {
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    });

    return () => {
      s.off('order:new');
      s.off('order:updated');
    };
  }, []);

  const handleStatusChange = async (orderId: number, newStatus: OrderStatus) => {
    await api.put(`/orders/${orderId}/status`, { status: newStatus });
  };

  const columnOrders = (status: OrderStatus) =>
    orders.filter((o) => o.status === status).sort((a, b) => a.queueNumber - b.queueNumber);

  return (
    <div className="min-h-screen bg-gray-100 p-3">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold text-gray-800">กระดานหน้าเตา</h1>
        <div className="flex gap-2">
          <span className="text-xs text-gray-400 self-center">
            {new Date().toLocaleDateString('th-TH')}
          </span>
          <Link
            href="/merchant"
            className="text-xs text-orange-500 border border-orange-300 px-2 py-1 rounded-lg"
          >
            POS
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {COLUMNS.map((col) => (
          <div key={col.id} className={`rounded-2xl border-2 p-2 ${col.color}`}>
            <div className="flex items-center gap-1 mb-2">
              <h2 className="font-semibold text-gray-700 text-xs">{col.label}</h2>
              <span className="bg-white rounded-full px-1.5 py-0.5 text-xs font-bold text-gray-500">
                {columnOrders(col.id).length}
              </span>
            </div>
            <div className="space-y-2">
              {columnOrders(col.id).map((order) => (
                <OrderCard key={order.id} order={order} onStatusChange={handleStatusChange} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

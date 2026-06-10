'use client';

import { Order, OrderStatus } from '@/types';

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: 'COOKING',
  COOKING: 'DONE',
};

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  PENDING: 'เริ่มทำ →',
  COOKING: 'เสร็จแล้ว ✓',
};

interface Props {
  order: Order;
  onStatusChange: (orderId: number, newStatus: OrderStatus) => Promise<void>;
}

export default function OrderCard({ order, onStatusChange }: Props) {
  const nextStatus = NEXT_STATUS[order.status];

  return (
    <div className="bg-white rounded-xl p-3 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl font-bold text-orange-500">#{order.queueNumber}</span>
        <span className="text-xs text-gray-400">
          {new Date(order.createdAt).toLocaleTimeString('th-TH', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>

      <div className="space-y-1 mb-3">
        {order.items.map((item, idx) => (
          <div key={idx} className="text-xs text-gray-600">
            <span className="font-medium text-gray-800">{item.baseDough.name}</span>
            {item.toppings.length > 0 && (
              <span className="text-gray-400">
                {' + '}
                {item.toppings.map((t) => t.product.name).join(', ')}
              </span>
            )}
          </div>
        ))}
      </div>

      {nextStatus && ACTION_LABEL[order.status] && (
        <button
          onClick={() => onStatusChange(order.id, nextStatus)}
          className="w-full bg-orange-500 text-white text-xs py-2 rounded-lg font-medium hover:bg-orange-600 active:scale-95 transition"
        >
          {ACTION_LABEL[order.status]}
        </button>
      )}
    </div>
  );
}

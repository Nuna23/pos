'use client';

import { PROMPTPAY_ID, promptPayPayload } from '@/lib/promptpay';
import { PaymentMethod } from '@/types';
import { useState } from 'react';
import QRCode from 'react-qr-code';

interface Props {
  amount: number;
  loading: boolean;
  // The branch's uploaded payment QR image (data URI); falls back to a
  // generated PromptPay QR when not set.
  qrImage?: string | null;
  onClose: () => void;
  onConfirm: (method: PaymentMethod) => void;
}

export default function PaymentModal({ amount, loading, qrImage, onClose, onConfirm }: Props) {
  const [method, setMethod] = useState<PaymentMethod>('QR');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800">ชำระเงิน</h2>
          <button onClick={onClose} className="text-gray-400 text-sm" disabled={loading}>
            ✕
          </button>
        </div>

        <div className="text-center">
          <p className="text-xs text-gray-400">ยอดชำระ</p>
          <p className="text-3xl font-bold text-orange-500">฿{amount}</p>
        </div>

        {/* Method picker */}
        <div className="grid grid-cols-2 gap-2">
          {(['QR', 'CASH'] as PaymentMethod[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`py-3 rounded-xl text-sm font-semibold border-2 transition ${
                method === m
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-white text-gray-600 border-gray-200'
              }`}
            >
              {m === 'QR' ? 'สแกน QR' : 'เงินสด'}
            </button>
          ))}
        </div>

        {/* Method detail */}
        {method === 'QR' ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="bg-white p-3 rounded-xl border">
              {qrImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrImage} alt="QR ชำระเงิน" className="w-[180px] h-[180px] object-contain" />
              ) : (
                <QRCode value={promptPayPayload(PROMPTPAY_ID, amount)} size={180} />
              )}
            </div>
            <p className="text-xs text-gray-400">
              {qrImage ? 'สแกนเพื่อชำระเงิน' : 'สแกนเพื่อชำระผ่าน PromptPay'}
            </p>
          </div>
        ) : (
          <div className="py-6 text-center text-gray-500 text-sm">
            รับเงินสด <span className="font-bold text-gray-800">฿{amount}</span> จากลูกค้า
          </div>
        )}

        <button
          onClick={() => onConfirm(method)}
          disabled={loading}
          className="w-full bg-orange-600 text-white py-4 rounded-2xl text-lg font-bold disabled:opacity-50 shadow-lg transition"
        >
          {loading ? 'กำลังสั่ง...' : 'ยืนยันชำระเงิน'}
        </button>
      </div>
    </div>
  );
}

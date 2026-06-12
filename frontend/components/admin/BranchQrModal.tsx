'use client';

import { api } from '@/lib/api';
import { useEffect, useRef, useState } from 'react';

interface Branch {
  id: number;
  name: string;
  qrImage: string | null;
}

// Admin popup to set each branch's payment QR image (shown to customers at
// checkout). Click a branch's "เปลี่ยนรูป" to upload a picture.
export default function BranchQrModal({ onClose }: { onClose: () => void }) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const load = () => api.get<Branch[]>('/branches').then((r) => setBranches(r.data));
  useEffect(() => {
    load();
  }, []);

  const upload = async (id: number, file: File) => {
    setUploadingId(id);
    try {
      const fd = new FormData();
      fd.append('file', file);
      await api.post(`/admin/branches/${id}/qr`, fd);
      await load();
    } finally {
      setUploadingId(null);
    }
  };

  const clear = async (id: number) => {
    await api.delete(`/admin/branches/${id}/qr`);
    load();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl p-5 w-full max-w-md max-h-[85vh] overflow-y-auto space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-gray-800">QR ชำระเงินรายสาขา</h2>
          <button onClick={onClose} className="text-gray-400 text-sm">
            ✕
          </button>
        </div>
        <p className="text-xs text-gray-400">
          คลิก “เปลี่ยนรูป” เพื่อตั้งรูป QR ที่ลูกค้าจะเห็นตอนชำระเงินของแต่ละสาขา
        </p>

        {branches.map((b) => (
          <div key={b.id} className="border border-gray-200 rounded-xl p-3 flex items-center gap-3">
            <div className="w-20 h-20 shrink-0 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden border">
              {b.qrImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.qrImage} alt={b.name} className="w-full h-full object-contain" />
              ) : (
                <span className="text-[10px] text-gray-300">ไม่มีรูป</span>
              )}
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800 text-sm">{b.name}</p>
              <div className="flex gap-2 mt-2">
                <input
                  ref={(el) => {
                    fileRefs.current[b.id] = el;
                  }}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(b.id, f);
                    e.currentTarget.value = '';
                  }}
                />
                <button
                  onClick={() => fileRefs.current[b.id]?.click()}
                  disabled={uploadingId === b.id}
                  className="bg-orange-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50"
                >
                  {uploadingId === b.id ? 'กำลังอัปโหลด...' : 'เปลี่ยนรูป'}
                </button>
                {b.qrImage && (
                  <button onClick={() => clear(b.id)} className="text-red-400 text-xs px-2">
                    ลบ
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { useCallback, useState } from 'react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastMsg {
  id: number;
  text: string;
  kind: ToastKind;
}

// Tiny self-contained toast: call `show(text, kind)` to pop a message, and
// render `view` once anywhere in the component. No provider/context needed.
export function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const show = useCallback((text: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500);
  }, []);

  const view = (
    <div className="fixed inset-x-0 top-5 z-[80] flex flex-col items-center gap-2.5 px-4 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`animate-toast-in pointer-events-auto flex items-center gap-2.5 max-w-md w-auto px-5 py-3.5 rounded-2xl text-base font-semibold shadow-2xl ring-2 ${
            t.kind === 'success'
              ? 'bg-green-600 text-white ring-green-300'
              : t.kind === 'error'
                ? 'bg-red-500 text-white ring-red-300'
                : 'bg-gray-900 text-white ring-gray-500'
          }`}
        >
          <span className="grid place-items-center w-6 h-6 rounded-full bg-white/25 text-sm shrink-0">
            {t.kind === 'success' ? '✓' : t.kind === 'error' ? '!' : 'i'}
          </span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );

  return { show, view };
}

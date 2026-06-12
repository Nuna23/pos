'use client';

import QueueTracker from '@/components/customer/QueueTracker';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function QueueContent() {
  const searchParams = useSearchParams();
  const id = Number(searchParams.get('id') ?? '0');
  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        ไม่พบออเดอร์
      </div>
    );
  }
  return <QueueTracker orderId={id} />;
}

export default function QueuePage() {
  return (
    <Suspense>
      <QueueContent />
    </Suspense>
  );
}

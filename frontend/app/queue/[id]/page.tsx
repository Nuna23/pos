'use client';

import QueueTracker from '@/components/customer/QueueTracker';
import { useParams } from 'next/navigation';

export default function QueuePage() {
  const params = useParams();
  return <QueueTracker orderId={Number(params.id)} />;
}

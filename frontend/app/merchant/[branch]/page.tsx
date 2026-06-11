'use client';

import POSPanel from '@/components/merchant/POSPanel';
import { useParams } from 'next/navigation';

const VALID_BRANCHES = [1, 2, 3];

export default function MerchantBranchPage() {
  const params = useParams();
  const branchId = Number(params.branch);

  if (!VALID_BRANCHES.includes(branchId)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-gray-500">ไม่พบสาขานี้</p>
        <p className="text-gray-400 text-sm">กรุณาสแกน QR โค้ดของสาขา</p>
      </div>
    );
  }

  return <POSPanel branchId={branchId} />;
}

'use client';

import MenuSelector from '@/components/customer/MenuSelector';
import Link from 'next/link';
import { useParams } from 'next/navigation';

const VALID_BRANCHES = [1, 2, 3];

export default function OrderBranchPage() {
  const params = useParams();
  const branchId = Number(params.branch);

  if (!VALID_BRANCHES.includes(branchId)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-gray-500">ไม่พบสาขานี้</p>
        <Link href="/order" className="text-orange-500 underline text-sm">
          เลือกสาขา
        </Link>
      </div>
    );
  }

  return <MenuSelector branchId={branchId} />;
}

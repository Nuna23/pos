import POSPanel from '@/components/merchant/POSPanel';

export function generateStaticParams() {
  return [{ branch: '1' }, { branch: '2' }, { branch: '3' }];
}

const VALID_BRANCHES = [1, 2, 3];

export default async function MerchantBranchPage({ params }: { params: Promise<{ branch: string }> }) {
  const { branch } = await params;
  const branchId = Number(branch);

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

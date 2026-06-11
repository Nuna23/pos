// Each branch's แม่ค้า enters via that branch's QR code (which points at
// /merchant/[branch]). This bare page just explains that — there is no branch
// chooser.
export default function MerchantPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-orange-50 p-6 text-center">
      <div className="text-5xl mb-3">🥞</div>
      <h1 className="text-2xl font-bold text-orange-600 mb-2">CrepePOS — แม่ค้า</h1>
      <p className="text-gray-500 text-sm max-w-xs">
        กรุณาสแกน QR โค้ดของสาขาเพื่อเข้าใช้งาน
      </p>
    </main>
  );
}

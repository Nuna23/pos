// Customers enter a specific branch by scanning that branch's QR code
// (which points at /order/[branch]). This bare page just explains that — there
// is no branch chooser.
export default function OrderPage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-orange-50 p-6 text-center">
      <div className="text-6xl mb-3">🥞</div>
      <h1 className="text-2xl font-bold text-orange-600 mb-2">สั่งเครป</h1>
      <p className="text-gray-500 text-sm max-w-xs">
        กรุณาสแกน QR โค้ดของสาขาเพื่อเริ่มสั่งเครป
      </p>
    </main>
  );
}

import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-orange-50 p-6">
      <div className="text-center space-y-3 mb-10">
        <div className="text-6xl">🥞</div>
        <h1 className="text-3xl font-bold text-orange-600">CrepePOS</h1>
        <p className="text-gray-500 text-sm">ระบบจัดการร้านเครปอัจฉริยะ</p>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <Link
          href="/merchant"
          className="bg-orange-500 text-white text-center py-4 rounded-2xl text-lg font-semibold shadow-md hover:bg-orange-600 transition"
        >
          หน้าแม่ค้า (POS)
        </Link>
        <Link
          href="/merchant/board"
          className="bg-amber-400 text-white text-center py-4 rounded-2xl text-lg font-semibold shadow-md hover:bg-amber-500 transition"
        >
          กระดานหน้าเตา
        </Link>
        <Link
          href="/order"
          className="bg-white border-2 border-orange-400 text-orange-500 text-center py-4 rounded-2xl text-lg font-semibold shadow-md hover:bg-orange-50 transition"
        >
          สั่งเครป (ลูกค้า)
        </Link>
        <Link
          href="/dashboard"
          className="bg-gray-800 text-white text-center py-4 rounded-2xl text-lg font-semibold shadow-md hover:bg-gray-900 transition"
        >
          Dashboard ยอดขาย
        </Link>
      </div>
    </main>
  );
}

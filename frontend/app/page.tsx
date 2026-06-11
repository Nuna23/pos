import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col bg-orange-50">
      {/* Merchant entry is a small top-right link (same pattern as JLcheckin). */}
      <div className="flex justify-end p-4">
        <Link
          href="/merchant"
          className="text-sm bg-white border border-orange-300 text-orange-500 px-4 py-2 rounded-xl font-medium shadow-sm hover:bg-orange-100 transition"
        >
          หน้าแม่ค้า
        </Link>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="text-center space-y-3 mb-10">
          <div className="text-6xl">🥞</div>
          <h1 className="text-3xl font-bold text-orange-600">CrepePOS</h1>
          <p className="text-gray-500 text-sm">ระบบจัดการร้านเครปอัจฉริยะ</p>
        </div>

        <Link
          href="/order"
          className="bg-orange-500 text-white text-center py-4 px-10 rounded-2xl text-lg font-semibold shadow-md hover:bg-orange-600 transition"
        >
          สั่งเครป (ลูกค้า)
        </Link>
      </div>
    </main>
  );
}

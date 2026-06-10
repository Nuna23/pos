'use client';

interface Props {
  data: { name: string; count: number }[];
}

export default function TopToppings({ data }: Props) {
  const max = data[0]?.count ?? 1;

  if (data.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีข้อมูล</p>;
  }

  return (
    <div className="space-y-3">
      {data.map((item, idx) => (
        <div key={item.name} className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-4 text-right font-medium">{idx + 1}</span>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-sm text-gray-700">{item.name}</span>
              <span className="text-xs text-gray-400">{item.count} ครั้ง</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-400 rounded-full transition-all"
                style={{ width: `${(item.count / max) * 100}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

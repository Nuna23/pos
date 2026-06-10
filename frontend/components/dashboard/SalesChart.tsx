'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface Props {
  data: { hour: number; count: number }[];
}

export default function SalesChart({ data }: Props) {
  const chartData = Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`,
    count: data.find((d) => d.hour === h)?.count ?? 0,
  })).filter((d) => {
    const h = parseInt(d.hour);
    return d.count > 0 || (h >= 8 && h <= 22);
  });

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

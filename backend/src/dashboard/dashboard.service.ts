import { Injectable } from '@nestjs/common';
import { Workbook } from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary(period: 'day' | 'month' = 'day') {
    const start = new Date();
    if (period === 'day') {
      start.setHours(0, 0, 0, 0);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
    }

    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start }, status: { not: 'CANCELLED' } },
      include: { items: { include: { toppings: { include: { product: true } } } } },
    });

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalPrice), 0);

    const peakHoursMap: Record<number, number> = {};
    const toppingCount: Record<string, number> = {};

    for (const order of orders) {
      const hour = order.createdAt.getHours();
      peakHoursMap[hour] = (peakHoursMap[hour] ?? 0) + 1;

      for (const item of order.items) {
        for (const t of item.toppings) {
          toppingCount[t.product.name] = (toppingCount[t.product.name] ?? 0) + 1;
        }
      }
    }

    const topToppings = Object.entries(toppingCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const peakHours = Object.entries(peakHoursMap).map(([hour, count]) => ({
      hour: Number(hour),
      count,
    }));

    return { period, totalRevenue, orderCount: orders.length, peakHours, topToppings };
  }

  async exportToExcel(startDate?: string, endDate?: string): Promise<Buffer> {
    const start = startDate ? new Date(startDate) : (() => { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d; })();
    const end = endDate ? new Date(endDate) : new Date();

    const orders = await this.prisma.order.findMany({
      where: { createdAt: { gte: start, lte: end } },
      include: { items: { include: { baseDough: true, toppings: { include: { product: true } } } } },
      orderBy: { createdAt: 'asc' },
    });

    const wb = new Workbook();
    const ws = wb.addWorksheet('Sales');

    ws.columns = [
      { header: 'วันที่', key: 'date', width: 22 },
      { header: 'เลขคิว', key: 'queue', width: 10 },
      { header: 'สถานะ', key: 'status', width: 12 },
      { header: 'แป้ง', key: 'dough', width: 20 },
      { header: 'ไส้', key: 'toppings', width: 40 },
      { header: 'ราคา (บาท)', key: 'price', width: 15 },
    ];

    for (const order of orders) {
      for (const item of order.items) {
        ws.addRow({
          date: order.createdAt.toLocaleString('th-TH'),
          queue: order.queueNumber,
          status: order.status,
          dough: item.baseDough.name,
          toppings: item.toppings.map((t) => t.product.name).join(', '),
          price: Number(order.totalPrice),
        });
      }
    }

    ws.getRow(1).font = { bold: true };
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}

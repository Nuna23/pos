import { BadRequestException, Injectable } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { CreateOrderDto } from './dto/create-order.dto';

const ORDER_INCLUDE = {
  items: {
    include: {
      baseDough: true,
      toppings: { include: { product: true } },
    },
  },
} as const;

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private productsService: ProductsService,
  ) {}

  findAll(status?: OrderStatus) {
    return this.prisma.order.findMany({
      where: status ? { status } : undefined,
      include: ORDER_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  findAllToday() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.prisma.order.findMany({
      where: { createdAt: { gte: today, lt: tomorrow } },
      include: ORDER_INCLUDE,
      orderBy: { queueNumber: 'asc' },
    });
  }

  findOne(id: number) {
    return this.prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
  }

  async create(dto: CreateOrderDto) {
    const doughIds = dto.items.map((i) => i.baseDoughId);
    const toppingIds = dto.items.flatMap((i) => i.toppingIds);
    const allIds = [...new Set([...doughIds, ...toppingIds])];

    const products = await this.prisma.product.findMany({ where: { id: { in: allIds } } });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let totalPrice = 0;
    for (const item of dto.items) {
      const dough = productMap.get(item.baseDoughId);
      if (!dough) throw new BadRequestException(`Dough #${item.baseDoughId} not found`);
      totalPrice += Number(dough.price);
      for (const toppingId of item.toppingIds) {
        const topping = productMap.get(toppingId);
        if (!topping) throw new BadRequestException(`Topping #${toppingId} not found`);
        totalPrice += Number(topping.price);
      }
    }

    // Per-day queue number reset
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const lastOrder = await this.prisma.order.findFirst({
      where: { createdAt: { gte: today, lt: tomorrow } },
      orderBy: { queueNumber: 'desc' },
    });
    const queueNumber = (lastOrder?.queueNumber ?? 0) + 1;

    const order = await this.prisma.$transaction(async (tx) => {
      return tx.order.create({
        data: {
          queueNumber,
          totalPrice,
          pushEndpoint: dto.pushSubscription?.endpoint,
          pushP256dh: dto.pushSubscription?.p256dh,
          pushAuth: dto.pushSubscription?.auth,
          items: {
            create: dto.items.map((item) => ({
              baseDoughId: item.baseDoughId,
              toppings: { create: item.toppingIds.map((productId) => ({ productId })) },
            })),
          },
        },
        include: ORDER_INCLUDE,
      });
    });

    // Deduct stock after order is committed
    await Promise.all([
      ...dto.items.map((item) => {
        const dough = productMap.get(item.baseDoughId)!;
        return this.productsService.deductStock(item.baseDoughId, dough.deductionAmount);
      }),
      ...dto.items.flatMap((item) =>
        item.toppingIds.map((toppingId) => {
          const topping = productMap.get(toppingId)!;
          return this.productsService.deductStock(toppingId, topping.deductionAmount);
        }),
      ),
    ]);

    return order;
  }

  updateStatus(id: number, status: OrderStatus) {
    return this.prisma.order.update({
      where: { id },
      data: { status },
      include: ORDER_INCLUDE,
    });
  }
}

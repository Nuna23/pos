import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductCategory } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  findAll(category?: ProductCategory) {
    return this.prisma.product.findMany({
      where: category ? { category } : undefined,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException(`Product #${id} not found`);
    return product;
  }

  create(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  async update(id: number, dto: UpdateProductDto) {
    await this.findOne(id);
    const updated = await this.prisma.product.update({ where: { id }, data: dto });
    // Reset alertSent if stock was replenished above threshold
    if (dto.stockQuantity !== undefined && updated.stockQuantity > updated.alertThreshold) {
      return this.prisma.product.update({ where: { id }, data: { alertSent: false } });
    }
    return updated;
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.product.delete({ where: { id } });
  }

  async deductStock(productId: number, amount: number) {
    return this.prisma.product.update({
      where: { id: productId },
      data: { stockQuantity: { decrement: amount } },
    });
  }

  async replenishStock(id: number, amount: number) {
    return this.prisma.product.update({
      where: { id },
      data: { stockQuantity: { increment: amount }, alertSent: false },
    });
  }

  async getLowStockProducts() {
    const all = await this.prisma.product.findMany({ where: { alertSent: false } });
    return all.filter((p) => p.stockQuantity <= p.alertThreshold);
  }
}

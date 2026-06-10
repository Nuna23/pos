import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { QueueGateway } from '../queue/queue.gateway';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly queueGateway: QueueGateway,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get()
  findAll(@Query('status') status?: OrderStatus) {
    return this.ordersService.findAll(status);
  }

  @Get('today')
  findAllToday() {
    return this.ordersService.findAllToday();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.ordersService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateOrderDto) {
    const order = await this.ordersService.create(dto);
    this.queueGateway.broadcastNewOrder(order);
    return order;
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: OrderStatus,
  ) {
    const order = await this.ordersService.updateStatus(id, status);
    this.queueGateway.broadcastStatusUpdate(order as Record<string, unknown>);
    if (status === 'DONE') {
      await this.notificationsService.sendPushToCustomer(order);
    }
    return order;
  }
}

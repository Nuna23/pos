import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class QueueGateway {
  @WebSocketServer()
  server: Server;

  broadcastNewOrder(order: unknown) {
    this.server.emit('order:new', order);
  }

  broadcastStatusUpdate(order: Record<string, unknown>) {
    this.server.emit('order:updated', order);
    this.server.to(`order:${order.id}`).emit('order:status', {
      id: order.id,
      status: order.status,
      queueNumber: order.queueNumber,
    });
  }

  @SubscribeMessage('join:order')
  handleJoinOrder(
    @ConnectedSocket() client: Socket,
    @MessageBody() orderId: number,
  ) {
    void client.join(`order:${orderId}`);
    return { event: 'joined', data: orderId };
  }
}

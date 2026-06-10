import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import * as webpush from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {
    const email = this.config.get<string>('WEB_PUSH_VAPID_EMAIL') ?? 'mailto:admin@example.com';
    const pubKey = this.config.get<string>('WEB_PUSH_VAPID_PUBLIC_KEY') ?? '';
    const privKey = this.config.get<string>('WEB_PUSH_VAPID_PRIVATE_KEY') ?? '';
    if (pubKey && privKey && !pubKey.includes('your_vapid')) {
      try {
        webpush.setVapidDetails(email, pubKey, privKey);
      } catch {
        this.logger.warn('Web Push VAPID keys invalid — push notifications disabled');
      }
    }
  }

  async sendPushToCustomer(order: {
    id: number;
    queueNumber: number;
    pushEndpoint: string | null;
    pushP256dh: string | null;
    pushAuth: string | null;
  }) {
    if (!order.pushEndpoint || !order.pushP256dh || !order.pushAuth) return;

    const payload = JSON.stringify({
      title: 'เครปของคุณพร้อมแล้ว! 🥞',
      body: `คิวที่ ${order.queueNumber} มารับได้เลย`,
      orderId: order.id,
    });

    try {
      await webpush.sendNotification(
        {
          endpoint: order.pushEndpoint,
          keys: { p256dh: order.pushP256dh, auth: order.pushAuth },
        },
        payload,
      );
    } catch (err) {
      this.logger.error(`Push notification failed for order ${order.id}`, err);
    }
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkStockAndNotifyLine() {
    const all = await this.prisma.product.findMany({ where: { alertSent: false } });
    const toAlert = all.filter((p) => p.stockQuantity <= p.alertThreshold);
    if (toAlert.length === 0) return;

    const token = this.config.get<string>('LINE_CHANNEL_ACCESS_TOKEN');
    const userId = this.config.get<string>('LINE_NOTIFY_USER_ID');
    if (!token || !userId) {
      this.logger.warn('LINE credentials not configured — skipping stock alert');
      return;
    }

    const lines = toAlert.map(
      (p) => `⚠️ ${p.name}: เหลือ ${p.stockQuantity} (ถึงขีดแจ้งเตือน ${p.alertThreshold})`,
    );
    const message = `🥞 CrepePOS แจ้งเตือนสต็อกใกล้หมด:\n${lines.join('\n')}`;

    try {
      await axios.post(
        'https://api.line.me/v2/bot/message/push',
        { to: userId, messages: [{ type: 'text', text: message }] },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );

      await this.prisma.product.updateMany({
        where: { id: { in: toAlert.map((p) => p.id) } },
        data: { alertSent: true },
      });

      this.logger.log(`LINE stock alert sent for ${toAlert.length} products`);
    } catch (err) {
      this.logger.error('Failed to send LINE stock alert', err);
    }
  }
}

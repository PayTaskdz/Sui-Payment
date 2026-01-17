import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentsPoller {
  private readonly logger = new Logger(PaymentsPoller.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Cron('*/15 * * * * *')
  async pollProcessingOrders() {
    const orders = await this.prisma.order.findMany({
      where: { status: 'CONFIRMED_GAIAN_PAYMENT', gaianOrderId: { not: null } },
      take: 20,
      orderBy: { updatedAt: 'asc' },
    });

    if (orders.length === 0) return;

    this.logger.log(`Polling ${orders.length} processing orders...`);

    for (const o of orders) {
      try {
        await this.paymentsService.syncStatus(o.id);
      } catch (err) {
        this.logger.warn(`Failed to sync order ${o.id}: ${String((err as any)?.message ?? err)}`);
      }
    }
  }
}


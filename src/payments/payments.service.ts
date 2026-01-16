import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Order, PaymentTarget } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ConfirmUserPaymentDto } from './dto/confirm-user-payment.dto';
import { GaianClient } from '../gaian/gaian.client';
import { SuiRpcService } from '../sui/sui-rpc.service';
import { decimalToRawAmount, isRawIntString } from '../common/money';
import { OrderResponseDto } from './dto/order.response.dto';
import { CreateOrderResponseDto } from './dto/create-order.response.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly gaian: GaianClient,
    private readonly suiRpc: SuiRpcService,
  ) {}

  private toOrderResponse(order: any): OrderResponseDto {
    return {
      id: order.id,
      username: order.username,
      payerWalletAddress: order.payerWalletAddress,
      cryptoCurrency: order.cryptoCurrency,
      coinType: order.coinType,
      expectedCryptoAmountRaw: order.expectedCryptoAmountRaw,
      userPaymentTxDigest: order.userPaymentTxDigest,
      userPaymentVerifiedAt: order.userPaymentVerifiedAt,
      fiatAmount: String(order.fiatAmount),
      fiatCurrency: order.fiatCurrency,
      status: order.status,
      bankTransferStatus: order.bankTransferStatus,
      bankTransactionReference: order.bankTransactionReference,
      exchangeRate: order.exchangeRate ? String(order.exchangeRate) : null,
      gaianOrderId: order.gaianOrderId ?? null,
      paymentTarget: order.paymentTarget
        ? {
            id: order.paymentTarget.id,
            username: order.paymentTarget.username,
            fiatCurrency: order.paymentTarget.fiatCurrency,
            displayName: order.paymentTarget.displayName,
            country: order.paymentTarget.country,
          }
        : undefined,
      clientRequestId: order.clientRequestId ?? null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async createOrder(dto: CreateOrderDto): Promise<CreateOrderResponseDto> {
    const target = await this.prisma.paymentTarget.findUnique({
      where: { username: dto.username },
    });

    if (!target || !target.isActive) {
      throw new NotFoundException('USERNAME_NOT_FOUND');
    }

    const partnerWalletAddress = this.configService.get<string>('PARTNER_SUI_ADDRESS');
    if (!partnerWalletAddress) {
      throw new BadRequestException('PARTNER_SUI_ADDRESS_NOT_CONFIGURED');
    }

    const coinType = this.configService.get<string>('SUI_USDC_COIN_TYPE');
    if (!coinType) {
      throw new BadRequestException('SUI_USDC_COIN_TYPE_NOT_CONFIGURED');
    }

    const usdcDecimals = Number(this.configService.get<string>('SUI_USDC_DECIMALS') ?? '6');

    const exchangeResp = await this.gaian.calculateExchange({
      amount: dto.amount,
      country: dto.country,
      chain: 'Solana',
      token: dto.token,
    });

    if (!exchangeResp?.success || !exchangeResp?.exchangeInfo?.cryptoAmount) {
      throw new BadRequestException('GAIAN_CALCULATE_EXCHANGE_FAILED');
    }

    const cryptoAmount = String(exchangeResp.exchangeInfo.cryptoAmount);
    const expectedCryptoAmountRaw = isRawIntString(cryptoAmount)
      ? cryptoAmount
      : decimalToRawAmount(cryptoAmount, usdcDecimals);

    const exchangeRate = exchangeResp.exchangeInfo.exchangeRate
      ? Number(exchangeResp.exchangeInfo.exchangeRate)
      : undefined;

    const order = await this.prisma.order.create({
      data: {
        username: dto.username,
        paymentTargetId: target.id,
        payerWalletAddress: dto.payerWalletAddress,
        partnerWalletAddress,
        cryptoCurrency: dto.cryptoCurrency,
        coinType,
        expectedCryptoAmountRaw,
        fiatAmount: dto.amount,
        fiatCurrency: dto.fiatCurrency,
        exchangeRate,
        gaianRaw: exchangeResp,
        clientRequestId: dto.clientRequestId,
      },
    });

    return {
      id: order.id,
      status: order.status,
      exchangeInfo: exchangeResp.exchangeInfo,
      paymentInstruction: {
        toAddress: partnerWalletAddress,
        coinType,
        amountRaw: expectedCryptoAmountRaw,
      },
      payout: {
        username: target.username,
        fiatCurrency: target.fiatCurrency,
      },
    };
  }

  

  async confirmUserPayment(orderId: string, dto: ConfirmUserPaymentDto): Promise<OrderResponseDto> {
    // Start a transaction to handle both verification and Gaian call atomically
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Get the order with pessimistic locking to prevent concurrent updates
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { paymentTarget: true },
      });

      if (!order) {
        throw new NotFoundException('ORDER_NOT_FOUND');
      }

      // 2. If already completed or failed, just return current state
      if (order.status === 'COMPLETED' || order.status === 'FAILED') {
        return this.toOrderResponse(order);
      }

      if (!order.paymentTarget) {
        throw new BadRequestException('PAYMENT_TARGET_NOT_FOUND');
      }

      let updatedOrder = order;

      // 3. Handle on-chain verification if needed
      if (order.status === 'AWAITING_USER_PAYMENT') {
        const verify = await this.suiRpc.verifyTransfer(
          dto.userPaymentTxDigest,
          order.partnerWalletAddress,
          order.coinType,
          order.expectedCryptoAmountRaw,
        );

        if (!verify.success) {
          throw new BadRequestException(verify.message ?? 'USER_PAYMENT_NOT_VERIFIED');
        }

        // Update status to mark as verified
        updatedOrder = await tx.order.update({
          where: { id: order.id },
          data: {
            status: 'USER_PAYMENT_VERIFIED',
            userPaymentTxDigest: dto.userPaymentTxDigest,
            userPaymentVerifiedAt: new Date(),
          },
          include: { paymentTarget: true },
        });
      }

      // 4. If we're in a state to call Gaian, do it now
      if ((updatedOrder.status as any) === 'USER_PAYMENT_VERIFIED' || (updatedOrder.status as any) === 'CONFIRMING_GAIAN_PAYMENT') {
        try {
          // Mark as processing to prevent duplicate calls
          await tx.order.update({
            where: { id: orderId },
            data: { status: 'CONFIRMING_GAIAN_PAYMENT' as any },
          });

          // Call Gaian
          const gaianResp = await this.gaian.placeOrderPrefund({
            qrString: updatedOrder.paymentTarget!.qrString,
            amount: Number(updatedOrder.fiatAmount),
            fiatCurrency: updatedOrder.fiatCurrency,
            cryptoCurrency: updatedOrder.cryptoCurrency,
            fromAddress: updatedOrder.payerWalletAddress,
            transactionReference: updatedOrder.userPaymentTxDigest || undefined,
          });

          const gaianOrderId = gaianResp?.orderId;
          if (!gaianOrderId) {
            throw new BadRequestException('GAIAN_ORDER_ID_MISSING');
          }

          // Update with Gaian response
          updatedOrder = await tx.order.update({
            where: { id: orderId },
            data: {
              gaianOrderId,
              gaianRaw: gaianResp,
              status: 'CONFIRMED_GAIAN_PAYMENT' as any,
            },
            include: { paymentTarget: true },
          });
        } catch (err) {
          // On error, update status but don't throw yet - we'll rethrow after transaction
          await tx.order.update({
            where: { id: orderId },
            data: { status: 'CONFIRMING_GAIAN_PAYMENT' as any },
          });
          throw err; // Re-throw to trigger transaction rollback
        }
      }

      // 5. If we get here, either we didn't need to do anything or everything succeeded
      return this.toOrderResponse(updatedOrder);
    });
  }

  async getUserOrdersByWallet(
    walletAddress: string,
    query?: { page?: number; limit?: number; status?: string },
  ) {
    return this.gaian.getUserOrdersByWallet(walletAddress, query);
  }

  private static toNumberStrict(v: unknown, err: string): number {
    const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
    if (!Number.isFinite(n)) throw new BadRequestException(err);
    return n;
  }

  private async calcExchangeFiatToUsdc(args: {
    fiatAmount: number;
    country: string;
    token: string;
  }) {
    const resp = await this.gaian.calculateExchange({
      amount: args.fiatAmount,
      country: args.country,
      chain: 'Solana',
      token: args.token,
    });

    if (!resp?.success || !resp?.exchangeInfo?.cryptoAmount) {
      throw new BadRequestException('GAIAN_CALCULATE_EXCHANGE_FAILED');
    }

    return resp.exchangeInfo;
  }

  async quote(dto: {
    username: string;
    direction: string;
    fiatAmount?: number;
    usdcAmount?: string;
    country: string;
    token: string;
  }) {
    const target = await this.prisma.paymentTarget.findUnique({
      where: { username: dto.username },
    });

    if (!target || !target.isActive) {
      throw new NotFoundException('USERNAME_NOT_FOUND');
    }

    const usdcDecimals = Number(this.configService.get<string>('SUI_USDC_DECIMALS') ?? '6');

    if (dto.direction === 'FIAT_TO_USDC') {
      if (typeof dto.fiatAmount !== 'number') {
        throw new BadRequestException('FIAT_AMOUNT_REQUIRED');
      }

      const exchangeInfo = await this.calcExchangeFiatToUsdc({
        fiatAmount: dto.fiatAmount,
        country: dto.country,
        token: dto.token,
      });

      const cryptoAmount = String(exchangeInfo.cryptoAmount);
      const usdcAmountRaw = isRawIntString(cryptoAmount)
        ? cryptoAmount
        : decimalToRawAmount(cryptoAmount, usdcDecimals);

      return {
        success: true,
        direction: dto.direction,
        username: target.username,
        fiatCurrency: exchangeInfo.fiatCurrency,
        fiatAmount: exchangeInfo.fiatAmount,
        cryptoCurrency: exchangeInfo.cryptoCurrency,
        usdcAmount: cryptoAmount,
        usdcAmountRaw,
        exchangeRate: exchangeInfo.exchangeRate,
        feeAmount: exchangeInfo.feeAmount,
        timestamp: exchangeInfo.timestamp,
        gaianExchangeInfo: exchangeInfo,
      };
    }

    if (dto.direction === 'USDC_TO_FIAT') {
      if (!dto.usdcAmount) {
        throw new BadRequestException('USDC_AMOUNT_REQUIRED');
      }

      const probeFiatAmount = target.fiatCurrency === 'PHP' ? 10 : 50000;
      const probe = await this.calcExchangeFiatToUsdc({
        fiatAmount: probeFiatAmount,
        country: dto.country,
        token: dto.token,
      });

      const exchangeRate = PaymentsService.toNumberStrict(probe.exchangeRate, 'INVALID_EXCHANGE_RATE');
      const usdc = PaymentsService.toNumberStrict(dto.usdcAmount, 'INVALID_USDC_AMOUNT');

      const fiatAmount = Math.ceil(usdc * exchangeRate);
      const exchangeInfo = await this.calcExchangeFiatToUsdc({
        fiatAmount,
        country: dto.country,
        token: dto.token,
      });

      return {
        success: true,
        direction: dto.direction,
        username: target.username,
        fiatCurrency: exchangeInfo.fiatCurrency,
        fiatAmount: exchangeInfo.fiatAmount,
        cryptoCurrency: exchangeInfo.cryptoCurrency,
        usdcAmount: dto.usdcAmount,
        exchangeRate: exchangeInfo.exchangeRate,
        feeAmount: exchangeInfo.feeAmount,
        timestamp: exchangeInfo.timestamp,
        gaianExchangeInfo: exchangeInfo,
      };
    }

    throw new BadRequestException('INVALID_DIRECTION');
  }

  async syncStatus(orderId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      throw new NotFoundException('ORDER_NOT_FOUND');
    }

    if (!order.gaianOrderId) {
      return order;
    }

    const gaianStatus = await this.gaian.getStatus(order.gaianOrderId);
    const currentStatus: string | undefined = gaianStatus?.status;

    // Always update gaianRaw with the latest status
    const next: any = {
      gaianRaw: gaianStatus,
      bankTransactionReference: gaianStatus?.bankTransactionReference ?? undefined
    };

    // Update status based on Gaian status
    const normalized = currentStatus?.toLowerCase();
    if (normalized === 'completed') {
      next.status = 'COMPLETED';
      next.bankTransferStatus = 'COMPLETED';
    } else if (normalized === 'failed') {
      next.status = 'FAILED';
      next.bankTransferStatus = 'FAILED';
    } else {
      next.status = 'CONFIRMED_GAIAN_PAYMENT';
      next.bankTransferStatus = 'PROCESSING';
    }

    await this.prisma.order.update({
      where: { id: order.id },
      data: next,
    });

    return this.getOrder(orderId);
  }

  async getOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { paymentTarget: true },
    });

    if (!order) {
      throw new NotFoundException('ORDER_NOT_FOUND');
    }

    return order;
  }
}


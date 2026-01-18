import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
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
  ) { }

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
      hiddenWalletFeeRate: order.hiddenWalletFeeRate ? String(order.hiddenWalletFeeRate) : null,
      hiddenWalletFeeAmount: order.hiddenWalletFeeAmount ? String(order.hiddenWalletFeeAmount) : null,
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
    // Defaults
    const fiatCurrency = dto.fiatCurrency || 'VND';
    const country = dto.country || 'VN';
    const cryptoCurrency = 'USDC';
    const token = 'USDC';

    // Config
    const partnerWalletAddress = this.configService.get<string>('PARTNER_SUI_ADDRESS');
    if (!partnerWalletAddress) {
      throw new BadRequestException('PARTNER_SUI_ADDRESS_NOT_CONFIGURED');
    }

    const coinType = this.configService.get<string>('SUI_USDC_COIN_TYPE');
    if (!coinType) {
      throw new BadRequestException('SUI_USDC_COIN_TYPE_NOT_CONFIGURED');
    }

    const usdcDecimals = Number(this.configService.get<string>('SUI_USDC_DECIMALS') ?? '6');

    const feePercentStr = this.configService.get<string>('HIDDEN_WALLET_FEE_PERCENT') ?? '0.2';
    const feeRate = Number(feePercentStr) / 100;
    if (!Number.isFinite(feeRate) || feeRate < 0) {
      throw new BadRequestException('INVALID_HIDDEN_WALLET_FEE_PERCENT');
    }

    // Idempotency check
    if (dto.clientRequestId) {
      const existing = await this.prisma.order.findUnique({
        where: {
          payerWalletAddress_clientRequestId: {
            payerWalletAddress: dto.payerWalletAddress,
            clientRequestId: dto.clientRequestId,
          },
        },
      });

      if (existing) {
        const existingFeeRate = existing.hiddenWalletFeeRate ? Number(existing.hiddenWalletFeeRate) : feeRate;
        const existingFeePercent = String(existingFeeRate * 100);

        const baseCryptoAmountRaw = existing.hiddenWalletFeeAmount
          ? String(Number(existing.expectedCryptoAmountRaw) - Number(existing.hiddenWalletFeeAmount))
          : existing.expectedCryptoAmountRaw;

        return {
          id: existing.id,
          status: existing.status,
          exchangeInfo: (existing.gaianRaw as any)?.exchangeInfo ?? null,
          hiddenWallet: {
            feePercent: existingFeePercent,
            feeRate: existingFeeRate,
            feeAmount: existing.hiddenWalletFeeAmount ? Number(existing.hiddenWalletFeeAmount) : 0,
            amountBeforeFee: Number(baseCryptoAmountRaw),
            amountWithFee: Number(existing.expectedCryptoAmountRaw),
          },
          paymentInstruction: {
            toAddress: existing.partnerWalletAddress,
            coinType: existing.coinType,
            totalCrypto: (Number(existing.expectedCryptoAmountRaw) / Math.pow(10, usdcDecimals)).toFixed(usdcDecimals),
            totalCryptoRaw: existing.expectedCryptoAmountRaw,
            totalPayout: Number(existing.fiatAmount),
          },
          payout: {
            fiatCurrency: existing.fiatCurrency,
          },
        };
      }
    }

    // Step 1: Get exchange rate by probing with a sample fiat amount
    const probeFiatAmount = fiatCurrency === 'PHP' ? 100 : 100000; // 100 PHP or 100k VND
    const probeResp = await this.gaian.calculateExchange({
      amount: probeFiatAmount,
      country,
      chain: 'Solana',
      token,
    });

    if (!probeResp?.success || !probeResp?.exchangeInfo?.exchangeRate) {
      throw new BadRequestException('GAIAN_CALCULATE_EXCHANGE_FAILED');
    }

    const exchangeRate = Number(probeResp.exchangeInfo.exchangeRate);

    // Step 2: Convert USDC amount to fiat amount
    // exchangeRate = fiat per 1 USDC (e.g., 25500 VND per 1 USDC)
    const fiatAmount = Math.round(dto.usdcAmount * exchangeRate);

    // Step 3: Calculate the actual USDC amount after Gaian fees
    const exchangeResp = await this.gaian.calculateExchange({
      amount: fiatAmount,
      country,
      chain: 'Solana',
      token,
    });

    if (!exchangeResp?.success || !exchangeResp?.exchangeInfo?.cryptoAmount) {
      throw new BadRequestException('GAIAN_CALCULATE_EXCHANGE_FAILED');
    }

    const cryptoAmount = String(exchangeResp.exchangeInfo.cryptoAmount);
    const gaianExpectedCryptoAmountRaw = isRawIntString(cryptoAmount)
      ? cryptoAmount
      : decimalToRawAmount(cryptoAmount, usdcDecimals);

    const gaianExpected = Number(gaianExpectedCryptoAmountRaw);

    // Step 4: Add HiddenWallet fee on top of what Gaian expects
    const expectedCryptoAmountRaw = String(
      Math.ceil(gaianExpected / (1 - feeRate)),
    );

    const hiddenWalletFeeAmountRaw = Math.max(0, Number(expectedCryptoAmountRaw) - gaianExpected);
    const hiddenWalletFeeAmount = hiddenWalletFeeAmountRaw / Math.pow(10, usdcDecimals);

    // Create order with qrString directly
    const order = await this.prisma.order.create({
      data: {
        qrString: dto.qrString,
        payerWalletAddress: dto.payerWalletAddress,
        partnerWalletAddress,
        cryptoCurrency,
        coinType,
        expectedCryptoAmountRaw,
        fiatAmount,
        fiatCurrency,
        hiddenWalletFeeRate: feeRate,
        hiddenWalletFeeAmount,
        exchangeRate,
        gaianRaw: exchangeResp,
        clientRequestId: dto.clientRequestId,
      },
    });

    return {
      id: order.id,
      status: order.status,
      exchangeInfo: exchangeResp.exchangeInfo,
      hiddenWallet: {
        feePercent: feePercentStr,
        feeRate,
        feeAmount: hiddenWalletFeeAmountRaw,
        amountBeforeFee: Number(gaianExpectedCryptoAmountRaw),
        amountWithFee: Number(expectedCryptoAmountRaw),
      },
      paymentInstruction: {
        toAddress: partnerWalletAddress,
        coinType,
        totalCrypto: (Number(expectedCryptoAmountRaw) / Math.pow(10, usdcDecimals)).toFixed(usdcDecimals),
        totalCryptoRaw: expectedCryptoAmountRaw,
        totalPayout: fiatAmount,
      },
      payout: {
        fiatCurrency,
      },
    };
  }



  async confirmUserPayment(orderId: string, dto: ConfirmUserPaymentDto): Promise<OrderResponseDto> {
    // Start a transaction with extended timeout (getTransaction retry can take up to 10s)
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // 1. Get the order
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

      // 3. Validate qrString exists (either from order directly or from paymentTarget)
      const qrString = order.qrString || order.paymentTarget?.qrString;
      if (!qrString) {
        throw new BadRequestException('QR_STRING_NOT_FOUND');
      }

      let updatedOrder = order;

      // 4. Handle on-chain verification if needed
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

      // 5. If we're in a state to call Gaian, do it now
      if ((updatedOrder.status as any) === 'USER_PAYMENT_VERIFIED' || (updatedOrder.status as any) === 'CONFIRMING_GAIAN_PAYMENT') {
        try {
          // Mark as processing to prevent duplicate calls
          await tx.order.update({
            where: { id: orderId },
            data: { status: 'CONFIRMING_GAIAN_PAYMENT' as any },
          });

          // Call Gaian with qrString from order (or fallback to paymentTarget)
          const gaianResp = await this.gaian.placeOrderPrefund({
            qrString,
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

      // 6. If we get here, either we didn't need to do anything or everything succeeded
      return this.toOrderResponse(updatedOrder);
    }, {
      timeout: 30000, // 30 seconds for blockchain verification retry
      maxWait: 60000, // 60 seconds max wait to acquire transaction
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


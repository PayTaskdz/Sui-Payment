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
import { QuoteDto } from './dto/quote.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly gaian: GaianClient,
    private readonly suiRpc: SuiRpcService,
  ) { }

  private getLoyaltyTier(points: number): 'STANDARD' | 'PLUS' | 'PREMIUM' | 'ELITE' {
    const elite = this.configService.get<number>('TIER_ELITE_THRESHOLD', 1150);
    const premium = this.configService.get<number>('TIER_PREMIUM_THRESHOLD', 700);
    const plus = this.configService.get<number>('TIER_PLUS_THRESHOLD', 300);

    if (points >= elite) return 'ELITE';
    if (points >= premium) return 'PREMIUM';
    if (points >= plus) return 'PLUS';
    return 'STANDARD';
  }

  private getPayoutFeeRate(): number {
    // Percent expressed in env (e.g. 2 means 2%)
    const raw = this.configService.get<string>('PAYOUT_FEE_PERCENT') ?? '2';
    const pct = Number(raw);
    if (!Number.isFinite(pct) || pct < 0) {
      throw new BadRequestException('INVALID_PAYOUT_FEE_PERCENT');
    }
    return pct / 100;
  }
private static rawToDecimal(raw: string, decimals: number): number {
    if (!isRawIntString(raw)) throw new BadRequestException('INVALID_RAW_AMOUNT');
    const n = Number(raw);
    if (!Number.isFinite(n)) throw new BadRequestException('INVALID_RAW_AMOUNT');
    return n / Math.pow(10, decimals);
  }

  private static getVnDayWindow(now = new Date()): { start: Date; end: Date } {
    // VN timezone is UTC+7
    const vnNowMs = now.getTime() + 7 * 60 * 60 * 1000;
    const vnNow = new Date(vnNowMs);
    const startVn = new Date(vnNow);
    startVn.setUTCHours(0, 0, 0, 0);
    const startUtcMs = startVn.getTime() - 7 * 60 * 60 * 1000;
    return { start: new Date(startUtcMs), end: now };
  }

  private async sumCompletedUsdcForUserInVnDay(args: { payerWalletAddress: string; usdcDecimals: number }): Promise<number> {
    const { start, end } = PaymentsService.getVnDayWindow();

    const rows = await this.prisma.order.findMany({
      where: {
        payerWalletAddress: args.payerWalletAddress,
        bankTransferStatus: 'COMPLETED',
        createdAt: {
          gte: start,
          lt: end,
        },
      },
      select: { expectedCryptoAmountRaw: true },
    });

    return rows.reduce((sum, r) => sum + PaymentsService.rawToDecimal(r.expectedCryptoAmountRaw, args.usdcDecimals), 0);
  }

  private async sumCompletedNonKycUsdcGlobalInVnDay(args: { usdcDecimals: number }): Promise<number> {
    const { start, end } = PaymentsService.getVnDayWindow();

    const nonKycWallets = await this.prisma.user.findMany({
      where: {
        kycStatus: { not: 'approved' },
      },
      select: { walletAddress: true },
    });

    const walletAddresses = nonKycWallets.map(w => w.walletAddress).filter(Boolean);
    if (walletAddresses.length === 0) return 0;

    const rows = await this.prisma.order.findMany({
      where: {
        payerWalletAddress: { in: walletAddresses },
        bankTransferStatus: 'COMPLETED',
        createdAt: {
          gte: start,
          lt: end,
        },
      },
      select: { expectedCryptoAmountRaw: true },
    });

    return rows.reduce((sum, r) => sum + PaymentsService.rawToDecimal(r.expectedCryptoAmountRaw, args.usdcDecimals), 0);
  }

  private enforceThresholds(args: {
    usdcAmount: number;
    kycApproved: boolean;
    recipientCountry?: string;
    payerWalletAddress: string;
    usdcDecimals: number;
  }) {
    return (async () => {
      const usdc = args.usdcAmount;

      const isVn = (args.recipientCountry ?? '').toUpperCase() === 'VN';

      // KYC-ed user thresholds
      if (args.kycApproved) {
        if (usdc < 0.7) throw new BadRequestException('MIN_AMOUNT_PER_TX_EXCEEDED');
        if (usdc > 500) throw new BadRequestException('MAX_AMOUNT_PER_TX_EXCEEDED');

        const daySum = await this.sumCompletedUsdcForUserInVnDay({
          payerWalletAddress: args.payerWalletAddress,
          usdcDecimals: args.usdcDecimals,
        });

        if (daySum + usdc > 5000) throw new BadRequestException('MAX_AMOUNT_PER_DAY_EXCEEDED');
        return;
      }

      // Non-KYC rules: only allow if recipient is VN
      if (!isVn) throw new BadRequestException('KYC_REQUIRED');

      if (usdc >= 4) throw new BadRequestException('NON_KYC_MAX_AMOUNT_PER_TX_EXCEEDED');

      const userDaySum = await this.sumCompletedUsdcForUserInVnDay({
        payerWalletAddress: args.payerWalletAddress,
        usdcDecimals: args.usdcDecimals,
      });

      if (userDaySum + usdc > 20) throw new BadRequestException('NON_KYC_MAX_AMOUNT_PER_DAY_EXCEEDED');

      const globalNonKycSum = await this.sumCompletedNonKycUsdcGlobalInVnDay({ usdcDecimals: args.usdcDecimals });
      if (globalNonKycSum + usdc > 4000) throw new BadRequestException('TENANT_NON_KYC_MAX_AMOUNT_PER_DAY_EXCEEDED');
    })();
  }

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
      platformFee: order.payoutFeeRate ? {
        feePercent: String(Number(order.payoutFeeRate) * 100),
        feeRate: Number(order.payoutFeeRate),
        feeAmount: Number(order.payoutFeeAmountFiat),
        baseFiatAmount: Number(order.payoutFeeBaseFiatAmount),
        finalFiatAmount: Number(order.payoutFeeFinalFiatAmount),
      } : undefined,
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
// Payer
    const payer = await this.prisma.user.findFirst({
      where: { walletAddress: dto.payerWalletAddress },
    });
    if (!payer) {
      throw new NotFoundException('PAYER_NOT_FOUND');
    }

    const country = dto.country || 'VN';

    // Thresholds
    const usdcDecimals = Number(this.configService.get<string>('SUI_USDC_DECIMALS') ?? '6');
    await this.enforceThresholds({
      usdcAmount: dto.usdcAmount,
      kycApproved: payer.kycStatus === 'approved',
      recipientCountry: dto.recipientCountry,
      payerWalletAddress: dto.payerWalletAddress,
      usdcDecimals,
    });
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
        const payoutFeeRate = this.getPayoutFeeRate();
        const baseFiatAmount = Number(existing.fiatAmount);
        const feeFiatAmount = Math.ceil(baseFiatAmount * payoutFeeRate);
        const finalFiatAmount = Math.max(0, baseFiatAmount - feeFiatAmount);

        return {
          id: existing.id,
          status: existing.status,
          exchangeInfo: (existing.gaianRaw as any)?.exchangeInfo ?? null,
          platformFee: {
            feePercent: String(payoutFeeRate * 100),
            feeRate: payoutFeeRate,
            feeAmount: feeFiatAmount,
            baseFiatAmount,
            finalFiatAmount,
            cryptoEquivalent: null as any,
          },
          paymentInstruction: {
            toAddress: existing.partnerWalletAddress,
            coinType: existing.coinType,
            totalCrypto: (Number(existing.expectedCryptoAmountRaw) / Math.pow(10, usdcDecimals)).toFixed(usdcDecimals),
            totalCryptoRaw: existing.expectedCryptoAmountRaw,
            totalPayout: finalFiatAmount,
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

    // Step 2: User transfers the exact USDC amount they input.
    const usdcAmountDecimal = dto.usdcAmount;
    const expectedCryptoAmountRaw = decimalToRawAmount(String(usdcAmountDecimal), usdcDecimals);

    // Step 3: Calculate fiat values based on the initial USDC amount.
    // exchangeRate = fiat per 1 USDC (e.g., 25500 VND per 1 USDC)
    const baseFiatAmount = Math.round(usdcAmountDecimal * exchangeRate);
    const payoutFeeRate = this.getPayoutFeeRate(); // e.g. 0.02
    const feeFiatAmount = Math.ceil(baseFiatAmount * payoutFeeRate);
    const finalFiatAmount = Math.max(0, baseFiatAmount - feeFiatAmount); // This is what the recipient gets.

    // Create order with qrString directly
    const order = await this.prisma.order.create({
      data: {
        qrString: dto.qrString,
        payerWalletAddress: dto.payerWalletAddress,
        partnerWalletAddress,
        cryptoCurrency,
        coinType,
        expectedCryptoAmountRaw, // Full USDC amount
        fiatAmount: finalFiatAmount, // Final fiat amount for Gaian
        fiatCurrency,
        exchangeRate,
        payoutFeeRate: payoutFeeRate,
        payoutFeeAmountFiat: feeFiatAmount,
        payoutFeeBaseFiatAmount: baseFiatAmount,
        payoutFeeFinalFiatAmount: finalFiatAmount,
        gaianRaw: { note: "Exchange info is based on probed rate", probeResp },
        clientRequestId: dto.clientRequestId,
      },
    });

    return {
      id: order.id,
      status: order.status,
      exchangeInfo: {
        cryptoAmount: usdcAmountDecimal,
        fiatAmount: finalFiatAmount,
        fiatCurrency: fiatCurrency,
        cryptoCurrency: cryptoCurrency,
        exchangeRate: exchangeRate,
        feeAmount: Number(probeResp.exchangeInfo.feeAmount ?? 0),
        timestamp: probeResp.exchangeInfo.timestamp,
      },
      platformFee: {
        feePercent: String(payoutFeeRate * 100),
        feeRate: payoutFeeRate,
        feeAmount: feeFiatAmount,
        baseFiatAmount: baseFiatAmount,
        finalFiatAmount: finalFiatAmount,
        cryptoEquivalent: Number((feeFiatAmount / exchangeRate).toFixed(usdcDecimals)),
      } as any,
      paymentInstruction: {
        toAddress: partnerWalletAddress,
        coinType,
        totalCrypto: String(usdcAmountDecimal),
        totalCryptoRaw: expectedCryptoAmountRaw,
        totalPayout: finalFiatAmount,
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
           // Use gaianRegisteredWallet for fromAddress to bypass KYC in Gaian
          const payer = await tx.user.findFirst({
            where: { walletAddress: updatedOrder.payerWalletAddress },
          });

          if (!payer) {
            throw new BadRequestException('PAYER_NOT_FOUND');
          }
          // Use gaianRegisteredWallet if available, otherwise fall back to payerWalletAddress
          const gaianWalletAddress = payer.gaianRegisteredWallet || updatedOrder.payerWalletAddress;
          
          // Call Gaian with qrString from order (or fallback to paymentTarget)
          const gaianResp = await this.gaian.placeOrderPrefund({
            qrString,
            amount: Number(updatedOrder.fiatAmount),
            fiatCurrency: updatedOrder.fiatCurrency,
            cryptoCurrency: updatedOrder.cryptoCurrency,
            fromAddress: gaianWalletAddress, // Use Gaian-registered wallet for KYC
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
      timeout: 60000, // 60 seconds for blockchain verification retry
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

  async quote(dto: QuoteDto) {
    const usdcDecimals = Number(this.configService.get<string>('SUI_USDC_DECIMALS') ?? '6');

    // Only support USDC_TO_FIAT for now (1 USDC → VND recipient gets)
    if (dto.direction !== 'USDC_TO_FIAT' || !dto.usdcAmount) {
      throw new BadRequestException('ONLY_USDC_TO_FIAT_SUPPORTED');
    }

    // Match createOrder logic: use 100k VND for probe to get exchange rate
    const probeFiatAmount = dto.country.toUpperCase() === 'PH' ? 100 : 100000;
    const probe = await this.calcExchangeFiatToUsdc({
      fiatAmount: probeFiatAmount,
      country: dto.country,
      token: dto.token,
    });

    if (!probe?.exchangeRate) {
      throw new BadRequestException('GAIAN_RATE_FETCH_FAILED');
    }

    const exchangeRate = PaymentsService.toNumberStrict(probe.exchangeRate, 'INVALID_EXCHANGE_RATE');
    const usdcAmount = PaymentsService.toNumberStrict(dto.usdcAmount, 'INVALID_USDC_AMOUNT');

    // Calculate final payout (matching createOrder logic)
    const baseFiatAmount = Math.round(usdcAmount * exchangeRate);
    const payoutFeeRate = this.getPayoutFeeRate();
    const feeFiatAmount = Math.ceil(baseFiatAmount * payoutFeeRate);
    const finalFiatAmount = Math.max(0, baseFiatAmount - feeFiatAmount);

    return {
      success: true,
      direction: dto.direction,
      fiatCurrency: probe.fiatCurrency,
      fiatAmount: finalFiatAmount, // What recipient actually gets
      cryptoCurrency: probe.cryptoCurrency,
      usdcAmount: dto.usdcAmount,
      exchangeRate: probe.exchangeRate, // Base rate before fees
      feeAmount: feeFiatAmount,
      feeRate: payoutFeeRate,
      timestamp: new Date().toISOString(),
      // Include breakdown for transparency
      loyaltyFeeDiscount: {
        feePercent: String(payoutFeeRate * 100),
        feeRate: payoutFeeRate,
        feeAmount: feeFiatAmount,
        baseFiatAmount,
        finalFiatAmount,
      },
    };
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


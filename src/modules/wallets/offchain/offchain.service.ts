import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { GaianService } from '../../../integrations/gaian/gaian.service';
import { BusinessException } from '../../../common/exceptions/business.exception';

@Injectable()
export class OffchainService {
  constructor(
    private prisma: PrismaService,
    private gaianService: GaianService,
  ) {}

  /**
   * UC3B: Scan VietQR to add bank account
   */
  async scanQr(userId: string, qrString: string, label?: string) {
    // 1. Check user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Parse QR via Gaian
    let parsedQr;
    try {
      parsedQr = await this.gaianService.parseQr(qrString);
    } catch (error) {
      throw new BusinessException(
        'Failed to parse QR code',
        'QR_PARSE_FAILED',
        400,
        { error: error.message },
      );
    }

    const { country, bankBin, accountNumber, beneficiaryName, detailedQrInfo } = parsedQr;

    // 3. Check uniqueness
    const existingBank = await this.prisma.offchainWallet.findUnique({
      where: {
        country_bankBin_accountNumber: {
          country: country || 'VN',
          bankBin,
          accountNumber,
        },
      },
      include: { user: true },
    });

    if (existingBank) {
      throw new BusinessException(
        `This bank account is already registered to username: ${existingBank.user.username}`,
        'BANK_ALREADY_REGISTERED',
        409,
        { existingUsername: existingBank.user.username },
      );
    }

    // 4. Check if user has any default wallet (onchain or offchain)
    const hasDefaultOnchain = await this.prisma.onchainWallet.findFirst({
      where: { userId, isDefault: true },
    });

    const hasDefaultOffchain = await this.prisma.offchainWallet.findFirst({
      where: { userId, isDefault: true },
    });

    // Only set as default if no other wallet (onchain or offchain) is default
    const shouldBeDefault = !hasDefaultOnchain && !hasDefaultOffchain;

    // 5. Create bank account
    const bank = await this.prisma.offchainWallet.create({
      data: {
        userId,
        country: country || 'VN',
        bankBin,
        bankName: detailedQrInfo?.provider?.name || 'Unknown Bank',
        accountNumber,
        accountName: beneficiaryName || 'Unknown',
        qrString,
        qrParsedData: parsedQr,
        label: label || `${detailedQrInfo?.provider?.name || 'Bank'} Account`,
        isDefault: shouldBeDefault,
        isActive: true,
      },
    });

    return {
      bankId: bank.id,
      country: bank.country,
      bankBin: bank.bankBin,
      bankName: bank.bankName,
      accountNumber: bank.accountNumber,
      accountName: bank.accountName,
      label: bank.label,
      isDefault: bank.isDefault,
      isActive: bank.isActive,
      createdAt: bank.createdAt,
    };
  }

  /**
   * UC3A: Add bank account manually
   */
  async addManual(userId: string, data: {
    country: string;
    bankBin: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    qrString: string;
    label?: string;
  }) {
    // 1. Check user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Validate required fields
    if (!data.bankBin || !data.accountNumber || !data.qrString) {
      throw new BadRequestException('Missing required fields: bankBin, accountNumber, qrString');
    }

    // 3. Check uniqueness
    const existingBank = await this.prisma.offchainWallet.findUnique({
      where: {
        country_bankBin_accountNumber: {
          country: data.country,
          bankBin: data.bankBin,
          accountNumber: data.accountNumber,
        },
      },
      include: { user: true },
    });

    if (existingBank) {
      throw new BusinessException(
        `This bank account is already registered to username: ${existingBank.user.username}`,
        'BANK_ALREADY_REGISTERED',
        409,
        { existingUsername: existingBank.user.username },
      );
    }

    // 4. Check if user has any default wallet (onchain or offchain)
    const hasDefaultOnchain = await this.prisma.onchainWallet.findFirst({
      where: { userId, isDefault: true },
    });

    const hasDefaultOffchain = await this.prisma.offchainWallet.findFirst({
      where: { userId, isDefault: true },
    });

    // Only set as default if no other wallet (onchain or offchain) is default
    const shouldBeDefault = !hasDefaultOnchain && !hasDefaultOffchain;

    // 5. Create bank account
    const bank = await this.prisma.offchainWallet.create({
      data: {
        userId,
        country: data.country,
        bankBin: data.bankBin,
        bankName: data.bankName,
        accountNumber: data.accountNumber,
        accountName: data.accountName,
        qrString: data.qrString,
        label: data.label || `${data.bankName} Account`,
        isDefault: shouldBeDefault,
        isActive: true,
      },
    });

    return {
      bankId: bank.id,
      country: bank.country,
      bankBin: bank.bankBin,
      bankName: bank.bankName,
      accountNumber: bank.accountNumber,
      accountName: bank.accountName,
      label: bank.label,
      isDefault: bank.isDefault,
      isActive: bank.isActive,
      createdAt: bank.createdAt,
    };
  }

  /**
   * List user's bank accounts
   */
  async listBanks(userId: string) {
    const banks = await this.prisma.offchainWallet.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      total: banks.length,
      banks: banks.map(b => ({
        bankId: b.id,
        country: b.country,
        bankBin: b.bankBin,
        bankName: b.bankName,
        accountNumber: b.accountNumber,
        accountName: b.accountName,
        label: b.label,
        isDefault: b.isDefault,
        isActive: b.isActive,
        createdAt: b.createdAt,
      })),
    };
  }

  /**
   * Get bank by ID
   */
  async getBank(bankId: string) {
    const bank = await this.prisma.offchainWallet.findUnique({
      where: { id: bankId },
    });

    if (!bank) {
      throw new NotFoundException('Bank account not found');
    }

    return bank;
  }

  /**
   * Update bank info (label only for now)
   */
  async updateBank(bankId: string, data: { label?: string }) {
    await this.getBank(bankId);

    const updated = await this.prisma.offchainWallet.update({
      where: { id: bankId },
      data: { label: data.label },
    });

    return {
      bankId: updated.id,
      label: updated.label,
      updatedAt: updated.updatedAt,
    };
  }

  /**
   * UC6: Deactivate bank (soft lock)
   */
  async deactivateBank(bankId: string) {
    const bank = await this.getBank(bankId);

    // Deactivate bank
    const updated = await this.prisma.offchainWallet.update({
      where: { id: bankId },
      data: { isActive: false, isDefault: false },
    });

    // If it was default, try to set another bank as default
    if (bank.isDefault) {
      const nextBank = await this.prisma.offchainWallet.findFirst({
        where: {
          userId: bank.userId,
          isActive: true,
          id: { not: bankId },
        },
      });

      if (nextBank) {
        await this.prisma.offchainWallet.update({
          where: { id: nextBank.id },
          data: { isDefault: true },
        });
      }
    }

    return {
      bankId: updated.id,
      isActive: updated.isActive,
      message: 'Bank account deactivated successfully',
    };
  }

  /**
   * Reactivate bank
   */
  async reactivateBank(bankId: string) {
    await this.getBank(bankId);

    const updated = await this.prisma.offchainWallet.update({
      where: { id: bankId },
      data: { isActive: true },
    });

    return {
      bankId: updated.id,
      isActive: updated.isActive,
      message: 'Bank account reactivated successfully',
    };
  }

  /**
   * UC11: Delete bank (hard delete)
   */
  async deleteBank(bankId: string) {
    const bank = await this.getBank(bankId);

    // Check if it's default bank
    if (bank.isDefault) {
      throw new BusinessException(
        'Cannot delete default bank account. Please set another account as default first.',
        'CANNOT_DELETE_DEFAULT_BANK',
        400,
      );
    }

    // Hard delete
    await this.prisma.offchainWallet.delete({
      where: { id: bankId },
    });

    return {
      bankId,
      message: 'Bank account deleted successfully',
    };
  }
}

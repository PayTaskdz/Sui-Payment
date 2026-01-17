import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import { GaianService } from "../../../integrations/gaian/gaian.service";
import { BusinessException } from "../../../common/exceptions/business.exception";

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
    try {
      // 1. Parse QR code via Gaian API
      const parsedBank = await this.gaianService.parseQr(qrString);

      // 2. Validate parsed result
      if (!parsedBank) {
        throw new BadRequestException('Invalid QR Code');
      }

      // 3. Check user exists
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 4. Return parsed bank info (ready to be added via addManual)
      return {
        success: true,
        bankInfo: {
          country: 'VN', // VietQR is Vietnam only
          bankBin: parsedBank.bankBin,
          bankName: parsedBank.bankName,
          accountNumber: parsedBank.accountNumber,
          accountName: parsedBank.beneficiaryName,
          qrString: qrString,
          label: label || `${parsedBank.bankName} Account`,
          amount: parsedBank.amount, // Optional amount from QR
          memo: parsedBank.memo, // Optional memo from QR
        },
      };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      throw new BadRequestException('Failed to parse QR code');
    }
  }

  /**
   * UC3A: Add bank account manually
   */
  async addManual(
    userId: string,
    data: {
      country: string;
      bankBin: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
      qrString: string;
      label?: string;
    },
  ) {
    // 1. Check user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // 2. Validate required fields
    if (!data.bankBin || !data.accountNumber || !data.qrString) {
      throw new BadRequestException(
        "Missing required fields: bankBin, accountNumber, qrString",
      );
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
        "BANK_ALREADY_REGISTERED",
        409,
        { existingUsername: existingBank.user.username },
      );
    }

    // 4. Create bank account (NOT auto-set as default - user must explicitly set receive wallet)
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
        isDefault: false, // NOT default - user must use setDefaultWallet API
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
      orderBy: { createdAt: "desc" },
    });

    return {
      total: banks.length,
      banks: banks.map((b) => ({
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
   * Get bank by ID (must belong to user)
   */
  async getBank(userId: string, bankId: string) {
    const bank = await this.prisma.offchainWallet.findFirst({
      where: { id: bankId, userId },
    });

    if (!bank) {
      throw new NotFoundException("Bank account not found");
    }

    return bank;
  }

  /**
   * Update bank info (label only for now) (must belong to user)
   */
  async updateBank(userId: string, bankId: string, data: { label?: string }) {
    await this.getBank(userId, bankId);

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
   * Delete bank (hard delete) (must belong to user)
   */
  async deleteBank(userId: string, bankId: string) {
    const bank = await this.getBank(userId, bankId);

    // Check if it's default bank
    if (bank.isDefault) {
      throw new BusinessException(
        "Cannot delete default bank account. Please set another account as default first.",
        "CANNOT_DELETE_DEFAULT_BANK",
        400,
      );
    }

    // Hard delete
    await this.prisma.offchainWallet.delete({
      where: { id: bankId },
    });

    return {
      bankId,
      message: "Bank account deleted successfully",
    };
  }
}

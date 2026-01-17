import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GaianService } from '../../integrations/gaian/gaian.service';
import { BusinessException } from '../../common/exceptions/business.exception';

@Injectable()
export class ContactsService {
  constructor(
    private prisma: PrismaService,
    private gaianService: GaianService,
  ) {}

  /**
   * Save contact
   */
  async saveContact(userId: string, data: { recipientUsername: string; label?: string }) {
    // 1. Check user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Check recipient exists
    const recipient = await this.prisma.user.findUnique({
      where: { username: data.recipientUsername },
    });

    if (!recipient) {
      throw new NotFoundException(`Recipient username '${data.recipientUsername}' not found`);
    }

    // 3. Check if contact already exists
    const existingContact = await this.prisma.contact.findUnique({
      where: {
        userId_recipientUsername: {
          userId,
          recipientUsername: data.recipientUsername,
        },
      },
    });

    if (existingContact) {
      throw new ConflictException('Contact already exists');
    }

    // 4. Create contact
    const contact = await this.prisma.contact.create({
      data: {
        userId,
        recipientUsername: data.recipientUsername,
        recipientUserId: recipient.id,
        label: data.label || data.recipientUsername,
      },
    });

    return {
      contactId: contact.id,
      recipientUsername: contact.recipientUsername,
      label: contact.label,
      createdAt: contact.createdAt,
    };
  }

  /**
   * List contacts with pagination
   */
  async listContacts(userId: string, pagination: { page?: number; limit?: number }) {
    const page = pagination.page || 1;
    const limit = pagination.limit || 20;
    const skip = (page - 1) * limit;

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where: { userId },
        orderBy: { lastTransferAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.contact.count({
        where: { userId },
      }),
    ]);

    return {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
      contacts: contacts.map(c => ({
        contactId: c.id,
        recipientUsername: c.recipientUsername,
        label: c.label,
        transferCount: c.transferCount,
        lastTransferAt: c.lastTransferAt,
        createdAt: c.createdAt,
      })),
    };
  }

  /**
   * Get recent transfers (contacts with recent activity)
   */
  async getRecentTransfers(userId: string) {
    const contacts = await this.prisma.contact.findMany({
      where: {
        userId,
        lastTransferAt: { not: null },
      },
      orderBy: { lastTransferAt: 'desc' },
      take: 10,
    });

    return {
      total: contacts.length,
      contacts: contacts.map(c => ({
        contactId: c.id,
        recipientUsername: c.recipientUsername,
        label: c.label,
        transferCount: c.transferCount,
        lastTransferAt: c.lastTransferAt,
      })),
    };
  }

  /**
   * UC13: Bank QR Resolution
   * Scan bank QR → lookup recipient in offchain_wallets
   */
  async resolveQr(qrString: string) {
    // 1. Parse QR via Gaian
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

    // 2. Lookup in offchain_wallets
    const offchainWallet = await this.prisma.offchainWallet.findUnique({
      where: {
        country_bankBin_accountNumber: {
          country: country || 'VN',
          bankBin,
          accountNumber,
        },
      },
      include: {
        user: true,
      },
    });

    // 3. Return result
    if (offchainWallet) {
      return {
        found: true,
        username: offchainWallet.user.username,
        userId: offchainWallet.user.id,
        bankInfo: {
          country: offchainWallet.country,
          bankBin: offchainWallet.bankBin,
          bankName: offchainWallet.bankName,
          accountNumber: offchainWallet.accountNumber,
          accountName: offchainWallet.accountName,
        },
        canSaveContact: true,
      };
    }

    // Not found - just return bank info from QR
    return {
      found: false,
      username: null,
      userId: null,
      bankInfo: {
        country: country || 'VN',
        bankBin,
        bankName: detailedQrInfo?.provider?.name || 'Unknown Bank',
        accountNumber,
        accountName: beneficiaryName || 'Unknown',
      },
      canSaveContact: false,
    };
  }

  /**
   * Delete contact
   */
  async deleteContact(contactId: string) {
    const contact = await this.prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    await this.prisma.contact.delete({
      where: { id: contactId },
    });

    return {
      contactId,
      message: 'Contact deleted successfully',
    };
  }
}

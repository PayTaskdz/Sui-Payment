import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GaianClient } from '../../gaian/gaian.client';
import { BusinessException } from '../../common/exceptions/business.exception';

@Injectable()
export class KycService {
  constructor(
    private prisma: PrismaService,
    private gaianClient: GaianClient,
  ) { }

  /**
   * UC12: Get KYC Link from Gaian
   * Returns WebSDK URL for user to complete KYC
   */
  async getKycLink(walletAddress: string) {
    // 1. Check user exists
    const user = await this.prisma.user.findFirst({
      where: { walletAddress },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Call Gaian to get KYC link
    try {
      const response = await this.gaianClient.getKycLink(walletAddress);

      return {
        walletAddress,
        kycLink: response.websdkUrl || response.url,
        expiresAt: response.expiresAt,
      };
    } catch (error: any) {
      throw new BusinessException(
        'Failed to get KYC link from Gaian',
        'GAIAN_KYC_LINK_FAILED',
        500,
        { error: error.message },
      );
    }
  }

  /**
   * UC12: Check KYC Status from Gaian
   * Sync KYC status from Gaian to local DB
   */
  async getKycStatus(walletAddress: string) {
    // 1. Check user exists
    const user = await this.prisma.user.findFirst({
      where: { walletAddress },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // 2. Get KYC status from Gaian
    try {
      const gaianResp = await this.gaianClient.getUserInfo(walletAddress);
      const kyc = gaianResp?.user?.kyc;

      const kycStatus = String(kyc?.status ?? 'not started').toLowerCase();
      const firstName = kyc?.firstName ?? null;
      const lastName = kyc?.lastName ?? null;

      // 3. Update local DB with Gaian data
      const updatedUser = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          kycStatus,
          firstName,
          lastName,
        },
      });

      return {
        userId: updatedUser.id,
        username: updatedUser.username,
        walletAddress: updatedUser.walletAddress,
        kycStatus: updatedUser.kycStatus,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        canTransfer: updatedUser.kycStatus === 'approved',
      };
    } catch (error: any) {
      throw new BusinessException(
        'Failed to get KYC status from Gaian',
        'GAIAN_KYC_STATUS_FAILED',
        500,
        { error: error.message },
      );
    }
  }

  

  /**
   * UC12: Handle KYC Webhook from Gaian
   * Auto-update KYC status when changes occur
   */
  async handleWebhook(payload: any) {
    const { walletAddress, kycStatus, firstName, lastName } = payload;

    if (!walletAddress) {
      throw new BusinessException(
        'Webhook payload missing walletAddress',
        'INVALID_WEBHOOK_PAYLOAD',
        400,
      );
    }

    // Find user by wallet address
    const user = await this.prisma.user.findFirst({
      where: { walletAddress },
    });

    if (!user) {
      throw new NotFoundException(`User not found for wallet: ${walletAddress}`);
    }

    // Update KYC status
    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: {
        kycStatus: kycStatus || user.kycStatus,
        firstName: firstName || user.firstName,
        lastName: lastName || user.lastName,
      },
    });

    return {
      success: true,
      userId: updatedUser.id,
      username: updatedUser.username,
      kycStatus: updatedUser.kycStatus,
      message: 'KYC status updated successfully',
    };
  }
}

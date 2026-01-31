import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GaianClient } from '../../gaian/gaian.client';
import { BusinessException } from '../../common/exceptions/business.exception';
import { HttpStatus } from '@nestjs/common';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private gaianClient: GaianClient,
  ) { }

  async register(dto: { walletAddress: string; referralUsername?: string }) {
    try {
      // Lookup referrer if referralUsername provided
      let referrerId: string | undefined;
      if (dto.referralUsername) {
        const referrer = await this.prisma.user.findFirst({
          where: { username: dto.referralUsername },
        });

        if (!referrer) {
          throw new BusinessException(
            'Referral username not found',
            'INVALID_REFERRAL',
            HttpStatus.BAD_REQUEST
          );
        }

        referrerId = referrer.id;
      }

      // Call Gaian API to register user
      const gaianResponse = await this.gaianClient.registerUser({
        walletAddress: dto.walletAddress,
      });

      if (gaianResponse.status !== 'success') {
        throw new BusinessException(
          gaianResponse.message || 'Registration failed',
          'REGISTRATION_FAILED',
          HttpStatus.BAD_REQUEST
        );
      }

      // Check if user already exists in local database
      let user = await this.prisma.user.findFirst({
        where: { walletAddress: dto.walletAddress }
      });

      // If user doesn't exist locally, create them
      if (!user) {
        user = await this.prisma.user.create({
          data: {
            walletAddress: dto.walletAddress,
            username: dto.walletAddress.substring(0, 10), // Use wallet address prefix as username
            referrerId: referrerId, // Set referrer ID if provided
          },
        });
      }

      return {
        status: gaianResponse.status,
        message: gaianResponse.message,
        user: {
          walletAddress: user.walletAddress,
          gaianUser: gaianResponse.user,
        },
      };
    } catch (error: any) {
      if (error instanceof BusinessException) {
        throw error;
      }
      throw new BusinessException(
        error.message || 'Registration failed',
        'GAIAN_REGISTRATION_ERROR',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  async login(address: string) {
    const user = await this.prisma.user.findFirst({
      where: { walletAddress: address },
      include: {
        onchainWallets: { where: { isActive: true } },
        offchainWallets: { where: { isActive: true } },
      },
    });
    return user;
  }
}

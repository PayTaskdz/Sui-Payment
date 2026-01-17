import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { GaianService } from '../../integrations/gaian/gaian.service';
import { BusinessException } from '../../common/exceptions/business.exception';
import { HttpStatus } from '@nestjs/common';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private gaianService: GaianService,
  ) {}
  
  async register(dto: { walletAddress: string; email?: string }) {
    try {
      // Call Gaian API to register user
      const gaianResponse = await this.gaianService.registerUser({
        walletAddress: dto.walletAddress,
        email: dto.email,
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
    } catch (error) {
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

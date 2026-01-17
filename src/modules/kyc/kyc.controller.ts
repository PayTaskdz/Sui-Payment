import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { KycService } from './kyc.service';
import { GetKycLinkDto } from './dto/get-kyc-link.dto';

@ApiTags('Kyc')
@ApiBearerAuth('bearer')
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  /**
   * POST /kyc/get-link
   * UC12: Get WebSDK URL from Gaian for KYC verification
   */
  @UseGuards(JwtAuthGuard)
  @Post('get-link')
  async getKycLink(@Body() dto: GetKycLinkDto) {
    return this.kycService.getKycLink(dto.walletAddress);
  }

  /**
   * GET /kyc/status?walletAddress=xxx
   * UC12: Check KYC status from Gaian and sync to DB
   */
  @UseGuards(JwtAuthGuard)
  @Get('status')
  async getKycStatus(@Query('walletAddress') walletAddress: string) {
    if (!walletAddress) {
      throw new BadRequestException('walletAddress query parameter is required');
    }
    return this.kycService.getKycStatus(walletAddress);
  }

  /**
   * POST /kyc/webhook
   * UC12: Handle KYC status update webhook from Gaian
   * This endpoint will be called by Gaian when KYC status changes
   */
  @Post('webhook')
  async handleWebhook(@Body() payload: any) {
    return this.kycService.handleWebhook(payload);
  }
}

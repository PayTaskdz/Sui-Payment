import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { OnchainService } from './onchain.service';
import { AddOnchainWalletDto } from './dto/add-onchain-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';

@ApiTags('Onchain')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('wallet/onchain')
export class OnchainController {
  constructor(private readonly onchainService: OnchainService) {}

  /**
   * POST /wallet/onchain/add?userId=xxx
   * UC2: Link Onchain Wallet (connect/manual/QR)
   */
  @Post('add')
  async addWallet(@Req() req: any, @Body() dto: AddOnchainWalletDto) {
    return this.onchainService.addWallet(req.user.userId, dto);
  }

  /**
   * GET /wallet/onchain?userId=xxx
   * List all onchain wallets for user
   */
  @Get()
  async listWallets(@Req() req: any) {
    return this.onchainService.listWallets(req.user.userId);
  }

  /**
   * GET /wallet/onchain/:id
   * Get wallet details
   */
  @Get(':id')
  async getWallet(@Req() req: any, @Param('id') id: string) {
    return this.onchainService.getWallet(req.user.userId, id);
  }

  /**
   * GET /wallet/onchain/:id/balance
   * Query balance from blockchain RPC
   */
  @Get(':id/balance')
  async getBalance(@Req() req: any, @Param('id') id: string) {
    return this.onchainService.getBalance(req.user.userId, id);
  }

  /**
   * PATCH /wallet/onchain/:id
   * Update wallet label
   */
  @Patch(':id')
  async updateWallet(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateWalletDto) {
    return this.onchainService.updateWallet(req.user.userId, id, dto);
  }

  /**
   * DELETE /wallet/onchain/:id
   * Hard delete wallet
   */
  @Delete(':id')
  async deleteWallet(@Req() req: any, @Param('id') id: string) {
    return this.onchainService.deleteWallet(req.user.userId, id);
  }
}

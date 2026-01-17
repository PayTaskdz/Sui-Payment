import { Controller, Post, Get, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { OnchainService } from './onchain.service';
import { AddOnchainWalletDto } from './dto/add-onchain-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';

@Controller('wallet/onchain')
export class OnchainController {
  constructor(private readonly onchainService: OnchainService) {}

  /**
   * POST /wallet/onchain/add?userId=xxx
   * UC2: Link Onchain Wallet (connect/manual/QR)
   */
  @Post('add')
  async addWallet(
    @Query('userId') userId: string,
    @Body() dto: AddOnchainWalletDto,
  ) {
    return this.onchainService.addWallet(userId, dto);
  }

  /**
   * GET /wallet/onchain?userId=xxx
   * List all onchain wallets for user
   */
  @Get()
  async listWallets(@Query('userId') userId: string) {
    return this.onchainService.listWallets(userId);
  }

  /**
   * GET /wallet/onchain/:id
   * Get wallet details
   */
  @Get(':id')
  async getWallet(@Param('id') id: string) {
    return this.onchainService.getWallet(id);
  }

  /**
   * GET /wallet/onchain/:id/balance
   * Query balance from blockchain RPC
   */
  @Get(':id/balance')
  async getBalance(@Param('id') id: string) {
    return this.onchainService.getBalance(id);
  }

  /**
   * PATCH /wallet/onchain/:id
   * Update wallet label
   */
  @Patch(':id')
  async updateWallet(
    @Param('id') id: string,
    @Body() dto: UpdateWalletDto,
  ) {
    return this.onchainService.updateWallet(id, dto);
  }

  /**
   * DELETE /wallet/onchain/:id
   * Hard delete wallet
   */
  @Delete(':id')
  async deleteWallet(@Param('id') id: string) {
    return this.onchainService.deleteWallet(id);
  }
}

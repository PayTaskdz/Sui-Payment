import { Controller, Post, Get, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { OnchainService } from './onchain.service';
import { AddOnchainWalletDto } from './dto/add-onchain-wallet.dto';
import { UpdateWalletDto } from './dto/update-wallet.dto';

@Controller('wallets/onchain')
export class OnchainController {
  constructor(private readonly onchainService: OnchainService) {}

  /**
   * POST /wallets/onchain/add?userId=xxx
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
   * GET /wallets/onchain?userId=xxx
   * List all onchain wallets for user
   */
  @Get()
  async listWallets(@Query('userId') userId: string) {
    return this.onchainService.listWallets(userId);
  }

  /**
   * GET /wallets/onchain/:id
   * Get wallet details
   */
  @Get(':id')
  async getWallet(@Param('id') id: string) {
    return this.onchainService.getWallet(id);
  }

  /**
   * GET /wallets/onchain/:id/balance
   * Query balance from blockchain RPC
   */
  @Get(':id/balance')
  async getBalance(@Param('id') id: string) {
    return this.onchainService.getBalance(id);
  }

  /**
   * PATCH /wallets/onchain/:id
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
   * POST /wallets/onchain/:id/deactivate
   * UC6: Deactivate wallet (soft lock)
   */
  @Post(':id/deactivate')
  async deactivateWallet(@Param('id') id: string) {
    return this.onchainService.deactivateWallet(id);
  }

  /**
   * POST /wallets/onchain/:id/reactivate
   * Reactivate wallet
   */
  @Post(':id/reactivate')
  async reactivateWallet(@Param('id') id: string) {
    return this.onchainService.reactivateWallet(id);
  }

  /**
   * DELETE /wallets/onchain/:id
   * UC11: Hard delete wallet
   */
  @Delete(':id')
  async deleteWallet(@Param('id') id: string) {
    return this.onchainService.deleteWallet(id);
  }
}

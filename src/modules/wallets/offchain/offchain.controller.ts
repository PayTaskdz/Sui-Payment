import { Controller, Post, Get, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { OffchainService } from './offchain.service';
import { ScanQrDto } from './dto/scan-qr.dto';
import { AddManualBankDto } from './dto/add-manual-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';

@Controller('wallets/offchain')
export class OffchainController {
  constructor(private readonly offchainService: OffchainService) {}

  /**
   * POST /wallets/offchain/scan-qr?userId=xxx
   * UC3B: Add bank from VietQR scan
   */
  @Post('scan-qr')
  async scanQr(
    @Query('userId') userId: string,
    @Body() dto: ScanQrDto,
  ) {
    return this.offchainService.scanQr(userId, dto.qrString, dto.label);
  }

  /**
   * POST /wallets/offchain/add-manual?userId=xxx
   * UC3A: Add bank manually
   */
  @Post('add-manual')
  async addManual(
    @Query('userId') userId: string,
    @Body() dto: AddManualBankDto,
  ) {
    return this.offchainService.addManual(userId, dto);
  }

  /**
   * GET /wallets/offchain?userId=xxx
   * List bank accounts
   */
  @Get()
  async listBanks(@Query('userId') userId: string) {
    return this.offchainService.listBanks(userId);
  }

  /**
   * GET /wallets/offchain/:id
   * Get bank details
   */
  @Get(':id')
  async getBank(@Param('id') id: string) {
    return this.offchainService.getBank(id);
  }

  /**
   * PATCH /wallets/offchain/:id
   * Update bank info
   */
  @Patch(':id')
  async updateBank(
    @Param('id') id: string,
    @Body() dto: UpdateBankDto,
  ) {
    return this.offchainService.updateBank(id, dto);
  }

  /**
   * POST /wallets/offchain/:id/deactivate
   * UC6: Deactivate bank
   */
  @Post(':id/deactivate')
  async deactivateBank(@Param('id') id: string) {
    return this.offchainService.deactivateBank(id);
  }

  /**
   * POST /wallets/offchain/:id/reactivate
   * Reactivate bank
   */
  @Post(':id/reactivate')
  async reactivateBank(@Param('id') id: string) {
    return this.offchainService.reactivateBank(id);
  }

  /**
   * DELETE /wallets/offchain/:id
   * UC11: Delete bank account
   */
  @Delete(':id')
  async deleteBank(@Param('id') id: string) {
    return this.offchainService.deleteBank(id);
  }
}

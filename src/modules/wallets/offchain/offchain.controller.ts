import { Controller, Post, Get, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { OffchainService } from './offchain.service';
import { ScanQrDto } from './dto/scan-qr.dto';
import { AddManualBankDto } from './dto/add-manual-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';

@Controller('wallet/offchain')
export class OffchainController {
  constructor(private readonly offchainService: OffchainService) {}

  /**
   * POST /wallet/offchain/add?userId=xxx
   * UC3: Add bank via QR scan (primary method)
   */
  @Post('add')
  async addBank(
    @Query('userId') userId: string,
    @Body() dto: ScanQrDto,
  ) {
    return this.offchainService.scanQr(userId, dto.qrString, dto.label);
  }

  /**
   * GET /wallet/offchain?userId=xxx
   * List bank accounts
   */
  @Get()
  async listBanks(@Query('userId') userId: string) {
    return this.offchainService.listBanks(userId);
  }

  /**
   * GET /wallet/offchain/:id
   * Get bank details
   */
  @Get(':id')
  async getBank(@Param('id') id: string) {
    return this.offchainService.getBank(id);
  }

  /**
   * PATCH /wallet/offchain/:id
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
   * DELETE /wallet/offchain/:id
   * Delete bank account
   */
  @Delete(':id')
  async deleteBank(@Param('id') id: string) {
    return this.offchainService.deleteBank(id);
  }
}

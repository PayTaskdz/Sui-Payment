import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { OffchainService } from './offchain.service';
import { ScanQrDto } from './dto/scan-qr.dto';
import { UpdateBankDto } from './dto/update-bank.dto';

@ApiTags('Offchain')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('wallet/offchain')
export class OffchainController {
  constructor(private readonly offchainService: OffchainService) {}

  /**
   * POST /wallet/offchain/add?userId=xxx
   * UC3: Add bank via QR scan
   */
  @Post('add')
  async addBank(@Req() req: any, @Body() dto: ScanQrDto) {
    return this.offchainService.scanQr(req.user.userId, dto.qrString, dto.label);
  }

  /**
   * GET /wallet/offchain?userId=xxx
   * List bank accounts
   */
  @Get()
  async listBanks(@Req() req: any) {
    return this.offchainService.listBanks(req.user.userId);
  }

  /**
   * GET /wallet/offchain/:id
   * Get bank details
   */
  @Get(':id')
  async getBank(@Req() req: any, @Param('id') id: string) {
    return this.offchainService.getBank(req.user.userId, id);
  }

  /**
   * PATCH /wallet/offchain/:id
   * Update bank info
   */
  @Patch(':id')
  async updateBank(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateBankDto) {
    return this.offchainService.updateBank(req.user.userId, id, dto);
  }

  /**
   * DELETE /wallet/offchain/:id
   * Delete bank account
   */
  @Delete(':id')
  async deleteBank(@Req() req: any, @Param('id') id: string) {
    return this.offchainService.deleteBank(req.user.userId, id);
  }
}

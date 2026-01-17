import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { TransferService } from './transfer.service';
import { ScanQrDto } from './dto/scan-qr.dto';

@ApiTags('Transfer')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('transfer')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  /**
   * POST /transfer/scan
   * Smart QR scanner - auto detects onchain/offchain and returns recipient info
   */
  @Post('scan')
  async scanQr(@Req() req: any, @Body() dto: ScanQrDto) {
    return this.transferService.scanQr(dto.qrString, req.user.userId);
  }
}

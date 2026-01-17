import { Controller, Post, Body } from '@nestjs/common';
import { TransferService } from './transfer.service';
import { ScanQrDto } from './dto/scan-qr.dto';

@Controller('transfer')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  /**
   * POST /transfer/scan
   * Smart QR scanner - auto detects onchain/offchain and returns recipient info
   */
  @Post('scan')
  async scanQr(@Body() dto: ScanQrDto) {
    return this.transferService.scanQr(dto.qrString, dto.userId);
  }
}

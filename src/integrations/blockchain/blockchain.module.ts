import { Module, Global } from '@nestjs/common';
import { SuiService } from './sui.service';

@Global()
@Module({
  providers: [SuiService],
  exports: [SuiService],
})
export class BlockchainModule {}

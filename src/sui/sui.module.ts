import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SuiRpcService } from './sui-rpc.service';

@Global()
@Module({
  imports: [HttpModule],
  providers: [SuiRpcService],
  exports: [SuiRpcService],
})
export class SuiModule {}


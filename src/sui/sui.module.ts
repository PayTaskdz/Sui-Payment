import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SuiRpcService } from './sui-rpc.service';

@Module({
  imports: [HttpModule],
  providers: [SuiRpcService],
  exports: [SuiRpcService],
})
export class SuiModule {}


import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GaianClient } from './gaian.client';

@Global()
@Module({
  imports: [HttpModule],
  providers: [GaianClient],
  exports: [GaianClient],
})
export class GaianModule {}


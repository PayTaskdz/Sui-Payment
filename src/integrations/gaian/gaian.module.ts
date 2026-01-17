import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GaianService } from './gaian.service';
import { AppConfigModule } from '../../config/config.module';

@Global()
@Module({
  imports: [HttpModule, AppConfigModule],
  providers: [GaianService],
  exports: [GaianService],
})
export class GaianModule {}

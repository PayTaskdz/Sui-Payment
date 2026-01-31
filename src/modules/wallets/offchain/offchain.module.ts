import { Module } from '@nestjs/common';
import { OffchainController } from './offchain.controller';
import { OffchainService } from './offchain.service';
import { GaianModule } from '../../../gaian/gaian.module';

@Module({
  imports: [GaianModule],
  controllers: [OffchainController],
  providers: [OffchainService],
  exports: [OffchainService],
})
export class OffchainWalletsModule {}

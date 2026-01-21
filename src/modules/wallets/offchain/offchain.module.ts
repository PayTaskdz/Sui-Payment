import { Module } from '@nestjs/common';
import { OffchainController } from './offchain.controller';
import { OffchainService } from './offchain.service';
import { GaianClientModule } from '../../../gaian/gaian.module';

@Module({
  imports: [GaianClientModule],
  controllers: [OffchainController],
  providers: [OffchainService],
  exports: [OffchainService],
})
export class OffchainWalletsModule {}

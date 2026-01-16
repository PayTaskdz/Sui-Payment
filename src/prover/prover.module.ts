import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProverController } from './prover.controller';
import { ProverService } from './prover.service';

@Module({
  imports: [ConfigModule],
  controllers: [ProverController],
  providers: [ProverService],
  exports: [ProverService],
})
export class ProverModule {}


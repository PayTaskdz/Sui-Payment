import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { GaianModule } from '../../gaian/gaian.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [DatabaseModule, GaianModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GaianClient } from './gaian.client';

@Module({
  imports: [HttpModule],
  providers: [GaianClient],
  exports: [GaianClient],
})
export class GaianClientModule { }


import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'HamPay API - Wallet Management & Payment System';
  }
}

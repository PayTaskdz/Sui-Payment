import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hidden Wallet API - Wallet Management & Payment System';
  }
}

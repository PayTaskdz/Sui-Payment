import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserOrdersQueryDto } from './dto/user-orders-query.dto';
import { QuoteDto } from './dto/quote.dto';
import { PaymentsService } from './payments.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ConfirmUserPaymentDto } from './dto/confirm-user-payment.dto';

@ApiTags('Payments')
@Controller('payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('orders')
  @ApiOperation({
    summary: 'Create a new payment order',
    description:
      'Creates a new order, returns instruction for user to transfer USDC on Sui to partner wallet. After the transfer is verified, backend triggers Gaian prefund payout exactly once.',
  })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or missing config' })
  @ApiResponse({ status: 404, description: 'Username not found' })
  createOrder(@Body() dto: CreateOrderDto) {
    return this.paymentsService.createOrder(dto);
  }
@Post('quote')
  @ApiOperation({
    summary: 'Quote exchange using Gaian calculateExchange (no order)',
    description:
      'Quote FIAT->USDC or USDC->FIAT. For USDC->FIAT: backend computes fiat using Gaian exchangeRate then calls calculateExchange again to obtain feeAmount.',
  })
  @ApiResponse({ status: 200, description: 'Quote result' })
  quote(@Body() dto: QuoteDto) {
    return this.paymentsService.quote(dto);
  }

  @Post('orders/:id/confirm-user-payment')
  @ApiOperation({
    summary: 'Confirm user on-chain payment',
    description:
      'Verifies on-chain USDC transfer from user wallet to partner wallet (Sui RPC). If verified, calls Gaian placeOrder/prefund exactly once and transitions order to processing.',
  })
  @ApiResponse({ status: 200, description: 'User payment verified; Gaian prefund payout triggered' })
  @ApiResponse({ status: 400, description: 'Transfer not verified or invalid state' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  confirmUserPayment(@Param('id') id: string, @Body() dto: ConfirmUserPaymentDto) {
    return this.paymentsService.confirmUserPayment(id, dto);
  }

  @Post('orders/:id/sync')
  @ApiOperation({
    summary: 'Sync order status from Gaian',
    description: 'Fetches latest status from Gaian and updates local order state.',
  })
  @ApiResponse({ status: 200, description: 'Status synced' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  sync(@Param('id') id: string) {
    return this.paymentsService.syncStatus(id);
  }

  @Get('orders/:id')
  @ApiOperation({
    summary: 'Get order details',
    description: 'Returns local order state and metadata stored in DB.',
  })
  @ApiResponse({ status: 200, description: 'Order details' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  getOrder(@Param('id') id: string) {
    return this.paymentsService.getOrder(id);
  }
@Get('users/:wallet/orders')
  @ApiOperation({
    summary: 'Get user transaction history from Gaian (by wallet)',
    description:
      'Proxies Gaian endpoint GET /api/v1/users/wallet/{wallet}/orders. Useful for showing history even if local DB is missing past orders.',
  })
  @ApiResponse({ status: 200, description: 'Orders list from Gaian' })
  getUserOrdersByWallet(@Param('wallet') wallet: string, @Query() query: UserOrdersQueryDto) {
    return this.paymentsService.getUserOrdersByWallet(wallet, query);
  }
}


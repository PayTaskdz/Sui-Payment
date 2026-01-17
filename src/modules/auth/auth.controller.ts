import { Controller, Post, Get, Body, Query, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { RestoreDto } from './dto/restore.dto';
import { OnboardingDto } from './dto/onboarding.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/register
   * UC1: Create Identity - Đăng ký user mới
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /auth/restore
   * UC8: Restore Identity - Khôi phục identity từ wallet
   */
  @Post('restore')
  async restore(@Body() dto: RestoreDto) {
    return this.authService.restore(dto.walletAddress);
  }

  /**
   * POST /auth/onboarding
   * UC9: Onboarding Entrypoint - Auto restore hoặc register
   */
  @Post('onboarding')
  async onboarding(@Body() dto: OnboardingDto) {
    return this.authService.onboarding(dto);
  }

  /**
   * GET /auth/check-username?username=xxx
   * Check username availability
   */
  @Get('check-username')
  async checkUsername(@Query('username') username: string) {
    if (!username) {
      throw new BadRequestException('Username is required');
    }
    return this.authService.checkUsername(username);
  }
}

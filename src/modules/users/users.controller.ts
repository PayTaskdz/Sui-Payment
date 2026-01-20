import { Body, Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Users')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users/profile?userId=xxx
   * Get user profile with wallets and KYC status
   * TODO: Later replace with JWT @CurrentUser() decorator
   */
  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user.userId);
  }

  /**
   * PATCH /users/profile?userId=xxx
   * Update profile info (email, firstName, lastName)
   */
  @Patch('profile')
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.userId, dto);
  }

  /**
   * GET /users/lookup?username=xxx
   * Lookup user by username (for transfers)
   */
  @Get('lookup')
  async getUserByUsername(@Query('username') username: string) {
    return this.usersService.getUserByUsername(username);
  }

  /**
   * GET /users/referral-stats
   * Get referral statistics (F0 rewards and F1 rewards)
   */
  @Get('referral-stats')
  async getReferralStats(@Req() req: any) {
    return this.usersService.getReferralStats(req.user.userId);
  }

  /**
   * GET /users/referral-history?limit=50
   * Get referral reward history
   */
  @Get('referral-history')
  async getReferralHistory(
    @Req() req: any,
    @Query('limit') limit?: string
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return this.usersService.getReferralHistory(req.user.userId, limitNum);
  }
}

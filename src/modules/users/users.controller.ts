import { Body, Controller, Get, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
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
   * GET /users/profile
   * Get user profile with wallets, KYC status, and loyalty tier info
   */
  @Get('profile')
  async getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user.userId);
  }

  /**
   * PATCH /users/profile
   * Update profile info (email, firstName, lastName)
   */
  @Patch('profile')
  async updateProfile(@Req() req: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.userId, dto);
  }
  
  /**
   * GET /users/check-username?username=xxx
   * Check if username is available
   */
  @Get('check-username')
  async checkUsername(@Query('username') username: string) {
    return this.usersService.checkUsernameAvailability(username);
  }
  // Bỏ onboarding vì không có bước onboarding
  /**
   * GET /users/lookup?username=xxx
   * Lookup user by username (for transfers)
   */
  @Get('lookup')
  async getUserByUsername(@Query('username') username: string) {
    return this.usersService.getUserByUsername(username);
  }

  /**
   * GET /users/loyalty-stats
   * Get detailed loyalty program statistics
   */
  @Get('loyalty-stats')
  async getLoyaltyStats(@Req() req: any) {
    return this.usersService.getLoyaltyStats(req.user.userId);
  }

  /**
   * GET /users/referral-info
   * Get referral program information and referee list
   */
  @Get('referral-info')
  async getReferralInfo(@Req() req: any) {
    return this.usersService.getReferralInfo(req.user.userId);
  }
}
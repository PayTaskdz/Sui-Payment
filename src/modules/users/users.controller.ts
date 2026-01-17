import { Body, Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangeUsernameDto } from './dto/change-username.dto';

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
   * PATCH /users/profile/username?userId=xxx
   * UC7: Change username (rate limit: 3 per 30 days)
   */
  @Patch('profile/username')
  async changeUsername(@Req() req: any, @Body() dto: ChangeUsernameDto) {
    return this.usersService.changeUsername(req.user.userId, dto.newUsername);
  }

  /**
   * GET /users/lookup?username=xxx
   * Lookup user by username (for transfers)
   */
  @Get('lookup')
  async getUserByUsername(@Query('username') username: string) {
    return this.usersService.getUserByUsername(username);
  }
}

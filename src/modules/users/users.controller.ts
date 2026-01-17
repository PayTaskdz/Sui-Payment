import { Controller, Get, Patch, Body, Param, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangeUsernameDto } from './dto/change-username.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * GET /users/profile?userId=xxx
   * Get user profile with wallets and KYC status
   * TODO: Later replace with JWT @CurrentUser() decorator
   */
  @Get('profile')
  async getProfile(@Query('userId') userId: string) {
    return this.usersService.getProfile(userId);
  }

  /**
   * PATCH /users/profile?userId=xxx
   * Update profile info (email, firstName, lastName)
   */
  @Patch('profile')
  async updateProfile(
    @Query('userId') userId: string,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, dto);
  }

  /**
   * PATCH /users/profile/username?userId=xxx
   * UC7: Change username (rate limit: 3 per 30 days)
   */
  @Patch('profile/username')
  async changeUsername(
    @Query('userId') userId: string,
    @Body() dto: ChangeUsernameDto,
  ) {
    return this.usersService.changeUsername(userId, dto.newUsername);
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

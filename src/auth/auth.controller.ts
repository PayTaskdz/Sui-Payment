import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChallengeQueryDto } from './dto/challenge-query.dto';
import { VerifyDto } from './dto/verify.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('challenge')
  @ApiOperation({ summary: 'Get challenge (nonce) for wallet login' })
  @ApiQuery({ name: 'address', required: true, type: String })
  @ApiResponse({ status: 200, description: 'Challenge issued' })
  challenge(@Query() query: ChallengeQueryDto) {
    return this.authService.issueChallenge(query.address);
  }

  @Post('verify')
  @ApiBody({ type: VerifyDto })
  @ApiOperation({ summary: 'Verify signature and issue JWT' })
  @ApiResponse({ status: 200, description: 'JWT issued' })
  verify(@Body() dto: VerifyDto) {
    return this.authService.verifyAndIssueToken(dto);
  }
}


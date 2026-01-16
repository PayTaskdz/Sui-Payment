import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ChallengeQueryDto } from './dto/challenge-query.dto';
import { VerifyDto } from './dto/verify.dto';
import { ZkLoginChallengeResponseDto } from './dto/zklogin-challenge.dto';
import { ZkLoginRegisterDto } from './dto/zklogin-register.dto';
import { ZkLoginSaltRequestDto, ZkLoginSaltResponseDto } from './dto/zklogin-salt.dto';
import { ZkLoginVerifyDto } from './dto/zklogin-verify.dto';

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

  @Get('zklogin/challenge')
  @ApiOperation({ summary: 'Get challenge (nonce + maxEpoch) for zkLogin' })
  @ApiResponse({ status: 200, type: ZkLoginChallengeResponseDto })
  zkLoginChallenge() {
    return this.authService.issueZkLoginChallenge();
  }

  @Post('zklogin/salt')
  @ApiOperation({ summary: 'Get or create zkLogin user salt (Google)' })
  @ApiBody({ type: ZkLoginSaltRequestDto })
  @ApiResponse({ status: 201, type: ZkLoginSaltResponseDto })
  zkLoginSalt(@Body() dto: ZkLoginSaltRequestDto) {
    return this.authService.getOrCreateZkLoginSalt(dto);
  }

  @Post('zklogin/register')
  @ApiOperation({ summary: 'Register computed nonce for zkLogin' })
  @ApiBody({ type: ZkLoginRegisterDto })
  @ApiResponse({ status: 201, description: 'Nonce registered' })
  zkLoginRegister(@Body() dto: ZkLoginRegisterDto) {
    return this.authService.registerZkLoginNonce(dto);
  }

  @Post('zklogin/verify')
  @ApiOperation({ summary: 'Verify zkLogin proof + issue JWT' })
  @ApiBody({ type: ZkLoginVerifyDto })
  @ApiResponse({ status: 200, description: 'JWT issued' })
  zkLoginVerify(@Body() dto: ZkLoginVerifyDto) {
    return this.authService.verifyZkLoginAndIssueToken(dto);
  }
}


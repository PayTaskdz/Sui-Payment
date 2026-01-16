import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';
import { verifyPersonalMessage } from '@mysten/sui.js/verify';
import { VerifyDto } from './dto/verify.dto';

function normalizeSuiAddress(address: string) {
  const a = address.trim().toLowerCase();
  return a.startsWith('0x') ? a : `0x${a}`;
}

@Injectable()
export class AuthService {
  private readonly domain: string;
  private readonly challengeTtlSeconds: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {
    this.domain = this.config.get<string>('AUTH_DOMAIN') ?? 'paypath.app';
    this.challengeTtlSeconds = Number(this.config.get<string>('AUTH_CHALLENGE_TTL_SECONDS') ?? '300');
  }

  async issueChallenge(address: string) {
    const normalized = normalizeSuiAddress(address);

    const nonce = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + this.challengeTtlSeconds * 1000);

    await this.prisma.authNonce.create({
      data: {
        address: normalized,
        nonce,
        expiresAt,
      },
    });

    return {
      nonce,
      expiresAt: expiresAt.toISOString(),
      domain: this.domain,
    };
  }

  private buildExpectedMessage(args: {
    domain: string;
    address: string;
    nonce: string;
    issuedAt: string;
    expirationTime: string;
    statement?: string;
  }) {
    const lines = [
      `domain: ${args.domain}`,
      `address: ${args.address}`,
      `nonce: ${args.nonce}`,
      `issuedAt: ${args.issuedAt}`,
      `expirationTime: ${args.expirationTime}`,
    ];
    if (args.statement) lines.push(`statement: ${args.statement}`);
    return lines.join('\n');
  }

  async verifyAndIssueToken(dto: VerifyDto) {
    const address = normalizeSuiAddress(dto.address);

    const nonceRow = await this.prisma.authNonce.findFirst({
      where: {
        address,
        nonce: dto.nonce,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!nonceRow) {
      throw new BadRequestException('NONCE_NOT_FOUND');
    }

    if (nonceRow.usedAt) {
      throw new BadRequestException('NONCE_ALREADY_USED');
    }

    if (nonceRow.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('NONCE_EXPIRED');
    }

    const expectedMessage = this.buildExpectedMessage({
      domain: this.domain,
      address,
      nonce: dto.nonce,
      issuedAt: dto.issuedAt,
      expirationTime: dto.expirationTime,
      statement: dto.statement,
    });

    if (dto.message !== expectedMessage) {
      throw new BadRequestException('MESSAGE_MISMATCH');
    }

    if (new Date(dto.expirationTime).getTime() < Date.now()) {
      throw new BadRequestException('MESSAGE_EXPIRED');
    }

    try {
      await verifyPersonalMessage(new TextEncoder().encode(dto.message), dto.signature);
    } catch {
      throw new BadRequestException('INVALID_SIGNATURE');
    }

    await this.prisma.authNonce.update({
      where: { id: nonceRow.id },
      data: { usedAt: new Date() },
    });

    const token = await this.jwt.signAsync({ sub: address, address });

    return {
      accessToken: token,
      tokenType: 'Bearer',
    };
  }
}


import { BadRequestException, Injectable } from '@nestjs/common';
import { ZkLoginRegisterDto } from './dto/zklogin-register.dto';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1PublicKey } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1PublicKey } from '@mysten/sui/keypairs/secp256r1';
import { parseSerializedSignature } from '@mysten/sui/cryptography';
import { VerifyDto } from './dto/verify.dto';
import { ZkLoginSaltRequestDto } from './dto/zklogin-salt.dto';
import { ZkLoginVerifyDto } from './dto/zklogin-verify.dto';
import { randomBase64 } from './zklogin.util';
import { GoogleOidcService } from './google-oidc.service';
import { SuiRpcService } from '../sui/sui-rpc.service';

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
    private readonly googleOidc: GoogleOidcService,
    private readonly suiRpc: SuiRpcService,
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
      const bytes = new TextEncoder().encode(dto.message);
      const parsed = parseSerializedSignature(dto.signature);

      if (parsed.signatureScheme === 'MultiSig') {
        throw new BadRequestException('UNSUPPORTED_SIGNATURE_SCHEME:MultiSig');
      }
      if (parsed.signatureScheme === 'ZkLogin') {
        throw new BadRequestException('UNSUPPORTED_SIGNATURE_SCHEME:ZkLogin');
      }
      if (parsed.signatureScheme === 'Passkey') {
        throw new BadRequestException('UNSUPPORTED_SIGNATURE_SCHEME:Passkey');
      }

      const publicKeyBytes = parsed.publicKey;
      const signature = parsed.signature;

      const publicKey =
        parsed.signatureScheme === 'ED25519'
          ? new Ed25519PublicKey(publicKeyBytes)
          : parsed.signatureScheme === 'Secp256k1'
            ? new Secp256k1PublicKey(publicKeyBytes)
            : new Secp256r1PublicKey(publicKeyBytes);

      const ok = await publicKey.verifyPersonalMessage(bytes, signature);
      if (!ok) {
        throw new BadRequestException('INVALID_SIGNATURE');
      }

      const signerAddress = normalizeSuiAddress(publicKey.toSuiAddress());
      if (signerAddress !== address) {
        throw new BadRequestException('SIGNER_MISMATCH');
      }

      void parsed.signatureScheme;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      const msg = e instanceof Error ? e.message : 'UNKNOWN';
      throw new BadRequestException(`INVALID_SIGNATURE:${msg}`);
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

  async issueZkLoginChallenge() {
    const expiresAt = new Date(Date.now() + this.challengeTtlSeconds * 1000);

    const epoch = await this.suiRpc.getCurrentEpoch();
    const offset = BigInt(this.config.get<string>('ZKLOGIN_MAX_EPOCH_OFFSET') ?? '2');
    const maxEpoch = (BigInt(epoch) + offset).toString();

    return {
      maxEpoch,
      domain: this.domain,
      expirationTime: expiresAt.toISOString(),
    };
  }

  async registerZkLoginNonce(dto: ZkLoginRegisterDto) {
    const expiresAt = new Date(Date.now() + this.challengeTtlSeconds * 1000);

    await this.prisma.authNonce.create({
      data: {
        address: 'zklogin:google',
        nonce: dto.nonce,
        expiresAt,
      },
    });

    return { expirationTime: expiresAt.toISOString() };
  }

  async getOrCreateZkLoginSalt(dto: ZkLoginSaltRequestDto) {
    const payload = await this.googleOidc.verifyIdToken(dto.idToken);

    const provider = 'google';
    const providerSub = payload.sub as string;

    const existing = await this.prisma.zkLoginSalt.findUnique({
      where: {
        provider_providerSub: { provider, providerSub },
      },
    });

    if (existing) {
      return { salt: existing.userSaltB64 };
    }

    const created = await this.prisma.zkLoginSalt.create({
      data: {
        provider,
        providerSub,
        userSaltB64: randomBase64(16),
      },
    });

    return { salt: created.userSaltB64 };
  }

  async verifyZkLoginAndIssueToken(dto: ZkLoginVerifyDto) {
    const nonceRow = await this.prisma.authNonce.findFirst({
      where: {
        address: 'zklogin:google',
        nonce: dto.nonce,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!nonceRow) throw new BadRequestException('NONCE_NOT_FOUND');
    if (nonceRow.usedAt) throw new BadRequestException('NONCE_ALREADY_USED');
    if (nonceRow.expiresAt.getTime() < Date.now()) throw new BadRequestException('NONCE_EXPIRED');

    const payload = await this.googleOidc.verifyIdToken(dto.idToken, dto.nonce);

    const saltRow = await this.prisma.zkLoginSalt.findUnique({
      where: {
        provider_providerSub: { provider: 'google', providerSub: payload.sub as string },
      },
    });

    if (!saltRow) {
      throw new BadRequestException('ZKLOGIN_SALT_NOT_FOUND');
    }

    if (!dto.proof || typeof dto.proof !== 'object') {
      throw new BadRequestException('ZKLOGIN_PROOF_REQUIRED');
    }

    await this.prisma.authNonce.update({
      where: { id: nonceRow.id },
      data: { usedAt: new Date() },
    });

    const token = await this.jwt.signAsync({ sub: payload.sub, provider: 'google', authType: 'zklogin' });

    return {
      accessToken: token,
      tokenType: 'Bearer',
    };
  }
}


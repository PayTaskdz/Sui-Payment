import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify } from 'jose';

const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

@Injectable()
export class GoogleOidcService {
  constructor(private readonly config: ConfigService) {}

  async verifyIdToken(idToken: string, expectedNonce?: string) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    if (!clientId) {
      throw new BadRequestException('GOOGLE_CLIENT_ID_NOT_SET');
    }

    const { payload } = await jwtVerify(idToken, googleJwks, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    });

    if (expectedNonce != null) {
      const nonce = payload.nonce;
      if (typeof nonce !== 'string' || nonce !== expectedNonce) {
        throw new BadRequestException('OIDC_NONCE_MISMATCH');
      }
    }

    const sub = payload.sub;
    if (typeof sub !== 'string' || !sub) {
      throw new BadRequestException('OIDC_SUB_MISSING');
    }

    return payload;
  }
}


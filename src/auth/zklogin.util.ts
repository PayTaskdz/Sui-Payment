import { randomBytes } from 'crypto';

export function randomBase64(bytes: number) {
  return randomBytes(bytes).toString('base64');
}

export function decodeJwtPayloadUnsafe(idToken: string): any {
  const parts = idToken.split('.');
  if (parts.length < 2) return null;
  const payloadB64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = payloadB64.padEnd(payloadB64.length + ((4 - (payloadB64.length % 4)) % 4), '=');
  const json = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(json);
}


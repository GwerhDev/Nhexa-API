import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { OAuthAccessClaims } from '../types';

// The keys OAuth access tokens are signed with (RS256): only Nhexa has the private one; the
// public ones are published (JWKS) so a resource server checks a token by itself, with no
// secret shared. A key's id is its JWK thumbprint (RFC 7638). Earlier keys only verify.

export interface PublicJwk { kty: string; n: string; e: string; kid: string; use: 'sig'; alg: 'RS256' }

export interface OAuthSigner {
  kid: string;
  sign(claims: Omit<OAuthAccessClaims, 'iss'>): string;
  verify(token: string): OAuthAccessClaims;
  jwks(): { keys: PublicJwk[] };
}

const thumbprint = (key: crypto.KeyObject): string => {
  const { e, kty, n } = key.export({ format: 'jwk' }) as { e: string; kty: string; n: string };
  return crypto.createHash('sha256').update(JSON.stringify({ e, kty, n })).digest('base64url');
};

const publicJwk = (key: crypto.KeyObject, kid: string): PublicJwk => {
  const { e, kty, n } = key.export({ format: 'jwk' }) as { e: string; kty: string; n: string };
  return { kty, n, e, kid, use: 'sig', alg: 'RS256' };
};

/** PEM keys, separated by blank lines (as an env var holds several). */
export const splitPemKeys = (text: string | undefined): string[] =>
  (text ?? '').split(/(?=-----BEGIN [A-Z ]+-----)/).map(k => k.trim()).filter(Boolean);

export function createOAuthSigner(issuer: string, privateKeyPem: string, previousKeysPem: string[] = []): OAuthSigner {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  if (privateKey.asymmetricKeyType !== 'rsa') throw new Error('OAUTH_SIGNING_KEY must be an RSA private key');
  const publicKey = crypto.createPublicKey(privateKey);
  const kid = thumbprint(publicKey);
  const verifyKeys = new Map<string, crypto.KeyObject>([[kid, publicKey]]);
  for (const pem of previousKeysPem) {
    const key = crypto.createPublicKey(pem);
    verifyKeys.set(thumbprint(key), key);
  }

  return {
    kid,
    sign: claims => jwt.sign({ ...claims, iss: issuer }, privateKey, { algorithm: 'RS256', keyid: kid }),
    verify(token) {
      const header = jwt.decode(token, { complete: true })?.header;
      const key = header?.kid ? verifyKeys.get(header.kid) : undefined;
      if (!key) throw new Error('Unknown signing key');
      return jwt.verify(token, key, { algorithms: ['RS256'], issuer }) as OAuthAccessClaims;
    },
    jwks: () => ({ keys: [...verifyKeys.entries()].map(([id, key]) => publicJwk(key, id)) }),
  };
}

/** A key for development, when none is configured: tokens it signs don't outlive the process. */
export const ephemeralSigningKey = (): string =>
  crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();

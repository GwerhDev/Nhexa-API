import { generateSecret, verify, generateURI } from 'otplib';
import qrcode from 'qrcode';
import crypto from 'crypto';
import { privateSecret } from '../config';

const ALGORITHM = 'aes-256-gcm';

const deriveKey = (): Buffer =>
  crypto.createHash('sha256').update(privateSecret).digest();

export { generateSecret as generateTOTPSecret };

export const getOtpauthUrl = (email: string, secret: string): string =>
  generateURI({ issuer: 'Nhexa', label: email, secret });

export const getQRCodeDataUrl = (otpauthUrl: string): Promise<string> =>
  qrcode.toDataURL(otpauthUrl);

export const verifyTOTP = async (token: string, secret: string): Promise<boolean> => {
  try {
    const result = await verify({ token, secret });
    return result.valid;
  } catch {
    return false;
  }
};

export const encryptSecret = (plaintext: string): string => {
  const key = deriveKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
};

export const decryptSecret = (ciphertext: string): string => {
  const [ivHex, tagHex, encryptedHex] = ciphertext.split(':');
  const key = deriveKey();
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
};

export const generateBackupCodes = (): string[] =>
  Array.from({ length: 10 }, () => {
    const part = () => crypto.randomBytes(2).toString('hex').toUpperCase();
    return `${part()}-${part()}`;
  });

export const hashBackupCode = (code: string): string =>
  crypto.createHash('sha256').update(code.toUpperCase()).digest('hex');

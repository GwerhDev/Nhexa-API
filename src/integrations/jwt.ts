import jwt from 'jsonwebtoken';
import { privateSecret } from '../config';
import type { TokenPayload, JWTClaims } from '../types';

export const createToken = async (data: TokenPayload, timeInHours: number): Promise<string> => {
  const expiration = timeInHours * 60 * 60;
  const payload = {
    data,
    exp: Math.floor(Date.now() / 1000) + expiration,
  };
  return jwt.sign(payload, privateSecret);
};

export const decodeToken = async (token: string): Promise<JWTClaims> => {
  const decoded = jwt.verify(token, privateSecret) as JWTClaims;
  return decoded;
};

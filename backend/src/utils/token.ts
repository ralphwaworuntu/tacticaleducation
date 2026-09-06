import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export function generateAccessToken(payload: {
  sub: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  name: string;
  referralCode: string;
  isEmailVerified: boolean;
  sessionVersion: number;
}) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
  });
}

export function generateRefreshToken(payload: {
  sub: string;
  email: string;
  role: 'ADMIN' | 'MEMBER';
  sessionVersion: number;
}) {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_TTL_DAYS}d`,
  });
}

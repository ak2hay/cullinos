import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

export interface JwtPayload {
  sub: string;
  organizationId: string;
  email: string;
  type: 'access' | 'refresh' | 'super_admin';
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateAccessToken(
  payload: Omit<JwtPayload, 'type'>,
  secret: string,
  expiresIn: SignOptions['expiresIn'] = '15m',
): string {
  const options: SignOptions = { expiresIn };
  return jwt.sign({ ...payload, type: 'access' }, secret, options);
}

export function generateRefreshToken(
  payload: Omit<JwtPayload, 'type'>,
  secret: string,
  expiresIn: SignOptions['expiresIn'] = '7d',
): string {
  const options: SignOptions = { expiresIn };
  return jwt.sign({ ...payload, type: 'refresh' }, secret, options);
}

export function verifyToken(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}

export function generateTokenPair(
  payload: Omit<JwtPayload, 'type'>,
  accessSecret: string,
  refreshSecret: string,
  accessExpiresIn: SignOptions['expiresIn'] = '15m',
  refreshExpiresIn: SignOptions['expiresIn'] = '7d',
): TokenPair {
  const accessToken = generateAccessToken(payload, accessSecret, accessExpiresIn);
  const refreshToken = generateRefreshToken(payload, refreshSecret, refreshExpiresIn);
  const decoded = jwt.decode(accessToken) as { exp: number };
  const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
  return { accessToken, refreshToken, expiresIn };
}

export function hasPermission(userPermissions: string[], required: string): boolean {
  return userPermissions.includes(required);
}

export function hasAnyPermission(userPermissions: string[], required: string[]): boolean {
  return required.some((p) => userPermissions.includes(p));
}

export function hasAllPermissions(userPermissions: string[], required: string[]): boolean {
  return required.every((p) => userPermissions.includes(p));
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'civicai-super-secret-key-12345';

/** Hash a plaintext password using bcrypt. */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

/** Verify a plaintext password against a stored bcrypt hash. */
export function verifyPassword(password: string, stored: string): boolean {
  try {
    return bcrypt.compareSync(password, stored);
  } catch {
    return false;
  }
}

/** Generate a JWT token for a user. */
export function generateToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

/** Verify a JWT token and return the payload. */
export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}

/** Generate a random unique id. */
export function generateId(prefix: string): string {
  return `${prefix}-${crypto.randomBytes(8).toString('hex')}`;
}

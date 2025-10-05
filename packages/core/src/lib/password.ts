// File: src/lib/password.ts
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Hash a plain-text password before you store it.
 *
 * @param password - The user’s plain-text password
 * @returns A bcrypt hash
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plain-text password to a bcrypt hash.
 *
 * @param plainText - The user’s submitted password
 * @param hash      - The stored bcrypt hash
 * @returns `true` if they match, else `false`
 */
export async function verifyPassword(
  plainText: string,
  hash:      string
): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

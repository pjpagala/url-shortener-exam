import { randomBytes } from "crypto";

/**
 * Generates a cryptographically random alphanumeric short code.
 *
 * Spec criteria:
 * - Length between 6 and 8 characters (defaults to 7)
 * - Characters drawn from `a-z`, `A-Z`, `0-9`
 * - Uses `crypto.randomBytes` for uniform, secure randomness
 *
 * @param length - Desired code length (default: 7)
 * @returns A random alphanumeric string of the given length
 */
export function generateCode(length = 7): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

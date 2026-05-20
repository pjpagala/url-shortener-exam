import { randomBytes } from "crypto";

/**
 * Generates a cryptographically random alphanumeric short code.
 *
 * Spec criteria:
 * - Length between 6 and 8 characters (defaults to 7)
 * - Characters drawn from `a-z`, `A-Z`, `0-9`
 * - Uses `crypto.randomBytes` for uniform, secure randomness
 *
 * Enhancement (A): rejection sampling eliminates modulo bias.
 * Without it, `256 % 62 = 8` means chars `a`–`h` are ~3% more likely.
 * Bytes >= `max` are discarded; the rejection rate is only ~3%.
 *
 * @param length - Desired code length (default: 7)
 * @returns A random alphanumeric string of the given length
 */
export function generateCode(length = 7): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  // Highest multiple of chars.length that fits in a byte (0–255)
  const max = 256 - (256 % chars.length);
  let result = "";
  while (result.length < length) {
    const [byte] = randomBytes(1);
    if (byte < max) {
      result += chars[byte % chars.length];
    }
  }
  return result;
}

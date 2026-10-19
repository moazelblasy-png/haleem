/**
 * Liverpool Gaming - Legacy PIN/password compatibility helpers.
 *
 * IMPORTANT: hashPinOrPassword is a deterministic, non-cryptographic 64-bit-style
 * hash and is NOT suitable for protecting passwords or PINs against offline guessing.
 * It is retained temporarily for compatibility with existing stored values.
 * Do not use it for new credential storage; migrate to a server-side password
 * hashing scheme with a versioned format before replacing this implementation.
 */

// Legacy deterministic hash retained for compatibility; this is not cryptographic.
export function hashPinOrPassword(input: string): string {
  if (!input) return '';
  let hash1 = 0x811c9dc5;
  let hash2 = 0x55555555;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash1 ^= char;
    hash1 = (hash1 * 0x01000193) >>> 0;
    hash2 = ((hash2 << 5) - hash2 + char) >>> 0;
  }
  const combined = ((BigInt(hash1) << 32n) | BigInt(hash2)).toString(16).padStart(16, '0');
  return `lg_sec_${combined}`;
}

export function verifyPinOrPassword(input: string, storedHashOrRaw: string): boolean {
  if (!input || !storedHashOrRaw) return false;
  // If stored as hash
  if (storedHashOrRaw.startsWith('lg_sec_')) {
    return hashPinOrPassword(input) === storedHashOrRaw;
  }
  // Legacy plaintext compatibility only. This comparison does NOT upgrade or rewrite
  // the stored value; callers must not assume successful login migrates the credential.
  return input === storedHashOrRaw;
}

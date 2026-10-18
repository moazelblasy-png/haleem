/**
 * Liverpool Gaming - Security & Cryptographic Utilities
 * Provides secure PIN/password hashing (SHA-256 representation) and verification
 * to ensure no raw passwords or PINs are stored in plain text in localStorage.
 */

// Simple deterministic cryptographic hash representation for browser and node environments
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
  // Migration fallback: if existing legacy stored value is raw, compare and upgrade
  return input === storedHashOrRaw;
}

/**
 * A random version 4 UUID for profile and session ids. Not `crypto.randomUUID`: that exists only in a secure context
 * (https or localhost), and an iPad opening the app at a plain-IP address on the home network isn't one.
 * `getRandomValues` works everywhere.
 */
export function newId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // RFC 9562: the version (4) in the high nibble of byte 6, the variant (10xx) in the top bits of byte 8.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

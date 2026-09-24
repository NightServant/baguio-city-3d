// RFC 4122 §4.3 UUID v5: SHA-1 of (namespace bytes + name bytes), with the
// version nibble forced to 5 and the variant bits forced to 10xx.
// Implemented on node:crypto so the project doesn't need the `uuid` package
// (not installed, not even transitively) just for deterministic ids.
import { createHash } from "node:crypto";

/** Parse a UUID string ("xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx") to 16 raw bytes. */
function uuidToBytes(uuid) {
  const hex = uuid.replace(/-/g, "");
  if (!/^[0-9a-f]{32}$/i.test(hex)) throw new Error(`not a UUID: ${uuid}`);
  const bytes = Buffer.alloc(16);
  for (let i = 0; i < 16; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/** Format 16 raw bytes as a lowercase UUID string. */
function bytesToUuid(bytes) {
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Deterministic UUID v5 of `name` within `namespace` (a UUID string).
 * Same (name, namespace) always yields the same id.
 */
export function uuidV5(name, namespace) {
  const nsBytes = uuidToBytes(namespace);
  const hash = createHash("sha1")
    .update(nsBytes)
    .update(Buffer.from(String(name), "utf8"))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx
  return bytesToUuid(bytes);
}

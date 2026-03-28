import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha2.js";

// noble/ed25519 v2 requires setting the sha512 sync hash
ed.etc.sha512Sync = (...m: Uint8Array[]) =>
  sha512(ed.etc.concatBytes(...m));

/** Helper to convert Uint8Array to ArrayBuffer for WebCrypto APIs (TS 5.9 compat). */
function toBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
}

export interface KeyPair {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  keyId: string;
}

/** Generate a new random Ed25519 keypair. */
export async function generateKeyPair(): Promise<KeyPair> {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = await ed.getPublicKeyAsync(privateKey);
  const keyId = await fingerprint(publicKey);
  return { publicKey, privateKey, keyId };
}

/** Sign a payload with an Ed25519 private key. */
export async function sign(
  payload: Uint8Array,
  privateKey: Uint8Array,
): Promise<Uint8Array> {
  return ed.signAsync(payload, privateKey);
}

/** Verify an Ed25519 signature. */
export async function verify(
  payload: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array,
): Promise<boolean> {
  try {
    return await ed.verifyAsync(signature, payload, publicKey);
  } catch {
    return false;
  }
}

/** Compute key fingerprint: first 16 chars of base64url(SHA-256(publicKey)). */
export async function fingerprint(publicKey: Uint8Array): Promise<string> {
  const hash = await globalThis.crypto.subtle.digest("SHA-256", toBuffer(publicKey));
  return base64urlEncode(new Uint8Array(hash)).slice(0, 16);
}

/** Derive an AES-256 encryption key from a passphrase using PBKDF2.
 *  Note: In production, use Argon2id via a WASM module.
 *  PBKDF2 is used here as a portable fallback that works in all JS runtimes. */
export async function deriveEncryptionKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return globalThis.crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toBuffer(salt), iterations: 600_000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Encrypt data with AES-256-GCM. */
export async function encrypt(
  data: Uint8Array,
  key: CryptoKey,
): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    toBuffer(data),
  );
  return { ciphertext: new Uint8Array(encrypted), iv };
}

/** Decrypt AES-256-GCM ciphertext. */
export async function decrypt(
  ciphertext: Uint8Array,
  key: CryptoKey,
  iv: Uint8Array,
): Promise<Uint8Array> {
  const decrypted = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toBuffer(iv) },
    key,
    toBuffer(ciphertext),
  );
  return new Uint8Array(decrypted);
}

/** SHA-256 hash of canonical (sorted-key) JSON. For data_hash in consent tokens. */
export async function canonicalHash(
  data: Record<string, unknown>,
): Promise<string> {
  const canonical = JSON.stringify(data, Object.keys(data).sort());
  const encoded = new TextEncoder().encode(canonical);
  const hash = await globalThis.crypto.subtle.digest("SHA-256", toBuffer(encoded));
  return `sha256:${hexEncode(new Uint8Array(hash))}`;
}

/** Generate a random salt (32 bytes). */
export function generateSalt(): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}

// --- Encoding utilities ---

export function base64urlEncode(data: Uint8Array): string {
  const binary = String.fromCharCode(...data);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

function hexEncode(data: Uint8Array): string {
  return Array.from(data)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

import nacl from 'tweetnacl';
import { extractErrorMessage } from './devLog';

/** Intentional: authentication is session-only and must never be written here. */
export const AUTH_STORAGE_KEY = 'moginhoodAuth';

export const FOREST_ACCESS_APP_ID = 'moginhood-forest';

export const NONCE_BYTES = 16;

export type AuthIssue = 'unsupported' | 'rejected' | 'invalid';

export type ForestAccessMessageFields = {
  wallet: string;
  nonce: string;
  issuedAt: string;
  origin: string;
};

export function encodeUtf8(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** tweetnacl rejects Buffer and cross-realm typed arrays. Always copy. */
export function toUint8Array(bytes: ArrayLike<number> | ArrayBufferView): Uint8Array {
  const source = ArrayBuffer.isView(bytes)
    ? new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    : Uint8Array.from(bytes as ArrayLike<number>);
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function createAuthNonce(
  randomBytes: (size: number) => Uint8Array = secureRandomBytes,
): string {
  return bytesToHex(randomBytes(NONCE_BYTES));
}

export function secureRandomBytes(size: number): Uint8Array {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function resolveAuthOrigin(origin?: string): string {
  if (origin) return origin;
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return FOREST_ACCESS_APP_ID;
}

export function buildForestAccessMessage(fields: ForestAccessMessageFields): string {
  return [
    'MoginHood Forest Access',
    '',
    'Sign this message to prove ownership of this wallet.',
    '',
    `App: ${FOREST_ACCESS_APP_ID}`,
    `Origin: ${fields.origin}`,
    `Wallet: ${fields.wallet}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
    '',
    'This signature does not authorize a transaction or token transfer.',
  ].join('\n');
}

export function walletCanSignMessage(
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | undefined,
  adapter?: object | null,
): boolean {
  return typeof signMessage === 'function' || hasSignMessage(adapter);
}

export function resolveSignMessage(
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | undefined,
  adapter?: object | null,
): ((message: Uint8Array) => Promise<Uint8Array>) | undefined {
  if (typeof signMessage === 'function') return signMessage;
  const method = readSignMessage(adapter);
  return method ? method.bind(adapter) : undefined;
}

function hasSignMessage(adapter?: object | null): boolean {
  return typeof readSignMessage(adapter) === 'function';
}

function readSignMessage(
  adapter?: object | null,
): ((message: Uint8Array) => Promise<Uint8Array>) | undefined {
  if (!adapter || !('signMessage' in adapter)) return undefined;
  const method = (adapter as { signMessage?: unknown }).signMessage;
  return typeof method === 'function'
    ? (method as (message: Uint8Array) => Promise<Uint8Array>)
    : undefined;
}

export function isSignatureUserRejection(err: unknown): boolean {
  const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : '';
  const message = extractErrorMessage(err);
  return /reject|cancel|decline|denied/i.test(`${name} ${message}`);
}

export function verifyEd25519Signature(input: {
  messageBytes: Uint8Array;
  signature: Uint8Array;
  publicKeyBytes: Uint8Array;
}): boolean {
  const messageBytes = toUint8Array(input.messageBytes);
  const signature = toUint8Array(input.signature);
  const publicKeyBytes = toUint8Array(input.publicKeyBytes);
  if (signature.length !== nacl.sign.signatureLength) return false;
  if (publicKeyBytes.length !== nacl.sign.publicKeyLength) return false;
  try {
    return nacl.sign.detached.verify(messageBytes, signature, publicKeyBytes);
  } catch {
    return false;
  }
}

/** Authentication is never persisted. Stale keys, if any, are ignored. */
export function readPersistedWalletAuthentication(
  storage: Pick<Storage, 'getItem'> | null = typeof window === 'undefined' ? null : window.localStorage,
): null {
  try {
    storage?.getItem(AUTH_STORAGE_KEY);
  } catch {
    // Private mode / blocked storage must not affect access.
  }
  return null;
}

export function shouldStartHolderCheck(input: {
  connected: boolean;
  publicKey: string | null;
  authenticated: boolean;
}): boolean {
  return Boolean(input.connected && input.publicKey && input.authenticated);
}

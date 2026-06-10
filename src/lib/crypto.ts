// End-to-end encryption primitives for project chat + attachments.
// WebCrypto only — no dependencies. The server never sees key material:
// device private keys live non-extractable in IndexedDB, and per-project
// AES-GCM keys travel only wrapped via ECDH for a specific device.

const DB_NAME = "workflowz-e2ee";
const STORE = "device-keys";
const DEVICE_RECORD_KEY = "device";

export interface DeviceKeyRecord {
  deviceId: string;
  privateKey: CryptoKey;
  publicKeyJwk: JsonWebKey;
}

// ---------------------------------------------------------------------------
// IndexedDB helpers (CryptoKey objects are structured-cloneable)
// ---------------------------------------------------------------------------

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) {
        req.result.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open key store"));
  });
}

function idbGet<T>(db: IDBDatabase, key: string): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
    tx.onsuccess = () => resolve(tx.result as T | undefined);
    tx.onerror = () => reject(tx.error || new Error("Key store read failed"));
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite").objectStore(STORE).put(value, key);
    tx.onsuccess = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("Key store write failed"));
  });
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

function toBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------------------------------------------------------------------------
// Device keypair (ECDH P-256, private key non-extractable)
// ---------------------------------------------------------------------------

export async function getOrCreateDeviceKey(): Promise<DeviceKeyRecord> {
  const db = await openDb();
  try {
    const existing = await idbGet<DeviceKeyRecord>(db, DEVICE_RECORD_KEY);
    if (existing?.privateKey && existing.deviceId) return existing;

    const pair = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      false, // private key can never leave this device
      ["deriveKey", "deriveBits"]
    );
    const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    const record: DeviceKeyRecord = {
      deviceId: crypto.randomUUID(),
      privateKey: pair.privateKey,
      publicKeyJwk,
    };
    await idbPut(db, DEVICE_RECORD_KEY, record);
    return record;
  } finally {
    db.close();
  }
}

export function getDeviceLabel(): string {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const platform = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "Unknown";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "Browser";
  return `${browser} on ${platform}`;
}

// ---------------------------------------------------------------------------
// Project key (AES-GCM-256) + ECDH wrapping
// ---------------------------------------------------------------------------

export async function generateProjectKey(): Promise<CryptoKey> {
  // Extractable so a key-holding device can wrap it for newly approved devices
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

async function deriveWrappingKey(privateKey: CryptoKey, publicKeyJwk: JsonWebKey): Promise<CryptoKey> {
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    publicKeyJwk,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: publicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"]
  );
}

/** Wrap the project key for a recipient device. Returns base64(iv || ciphertext) + the ephemeral public key. */
export async function wrapProjectKey(
  projectKey: CryptoKey,
  recipientPublicKeyJwk: JsonWebKey
): Promise<{ wrappedKey: string; ephemeralPublicKey: JsonWebKey }> {
  const ephemeral = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey", "deriveBits"]
  );
  const wrappingKey = await deriveWrappingKey(ephemeral.privateKey, recipientPublicKeyJwk);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.wrapKey("raw", projectKey, wrappingKey, { name: "AES-GCM", iv });
  const combined = new Uint8Array(iv.length + wrapped.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(wrapped), iv.length);
  return {
    wrappedKey: toBase64(combined),
    ephemeralPublicKey: await crypto.subtle.exportKey("jwk", ephemeral.publicKey),
  };
}

/** Unwrap a project key granted to this device. */
export async function unwrapProjectKey(
  wrappedKey: string,
  ephemeralPublicKeyJwk: JsonWebKey,
  devicePrivateKey: CryptoKey
): Promise<CryptoKey> {
  const combined = fromBase64(wrappedKey);
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const wrappingKey = await deriveWrappingKey(devicePrivateKey, ephemeralPublicKeyJwk);
  // Extractable so this device can in turn approve other devices
  return crypto.subtle.unwrapKey(
    "raw",
    ciphertext,
    wrappingKey,
    { name: "AES-GCM", iv },
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// ---------------------------------------------------------------------------
// Message + file encryption (AES-GCM, fresh 96-bit IV per item)
// ---------------------------------------------------------------------------

export async function encryptText(key: CryptoKey, text: string): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(text));
  return { ciphertext: toBase64(encrypted), iv: toBase64(iv) };
}

export async function decryptText(key: CryptoKey, ciphertext: string, iv: string): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(iv) },
    key,
    fromBase64(ciphertext)
  );
  return new TextDecoder().decode(decrypted);
}

export interface EncryptedFilePayload {
  blob: Blob;
  iv: string;
  /** Encrypted JSON {name, type} as "ivB64.cipherB64" */
  encryptedMetadata: string;
}

export async function encryptFile(key: CryptoKey, file: File): Promise<EncryptedFilePayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, await file.arrayBuffer());
  const meta = await encryptText(key, JSON.stringify({ name: file.name, type: file.type }));
  return {
    blob: new Blob([encrypted], { type: "application/octet-stream" }),
    iv: toBase64(iv),
    encryptedMetadata: `${meta.iv}.${meta.ciphertext}`,
  };
}

export async function decryptFileBytes(key: CryptoKey, data: ArrayBuffer, iv: string): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv) }, key, data);
}

export async function decryptFileMetadata(
  key: CryptoKey,
  encryptedMetadata: string
): Promise<{ name: string; type: string }> {
  const [metaIv, metaCipher] = encryptedMetadata.split(".");
  return JSON.parse(await decryptText(key, metaCipher, metaIv));
}

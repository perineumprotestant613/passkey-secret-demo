import { base64ToBytes, bytesToBase64 } from "./base64.ts";
import { deriveScryptBytes } from "./scrypt.ts";
import type { PasskeyWrap, ScryptKdf, StoredEnvelope } from "./types.ts";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const AES_KEY_LENGTH = 256;
const GCM_IV_BYTES = 12;
const RECOVERY_SALT_BYTES = 16;
const RECOVERY_SCRYPT_PARAMS: Omit<ScryptKdf, "salt"> = {
  name: "scrypt",
  N: 32768,
  r: 8,
  p: 1,
  dkLen: 32,
};

const PASSKEY_HKDF_SALT = textEncoder.encode("passkey-secret-demo/passkey-wrap-salt");
const PASSKEY_HKDF_INFO = textEncoder.encode("passkey-secret-demo/dek-wrap/v1");
type BytesLike = ArrayBuffer | ArrayBufferView<ArrayBufferLike>;

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function toBytes(value: BytesLike): Uint8Array {
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value.slice(0));
  }

  return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
}

function toArrayBuffer(value: BytesLike): ArrayBuffer {
  const bytes = toBytes(value);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer as ArrayBuffer;
}

function normalizeError(message: string, error: unknown): Error {
  if (error instanceof Error) {
    return new Error(message, { cause: error });
  }

  return new Error(message);
}

async function generateDek(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: AES_KEY_LENGTH },
    true,
    ["encrypt", "decrypt"],
  );
}

async function exportDek(dek: CryptoKey): Promise<Uint8Array> {
  const rawKey = await crypto.subtle.exportKey("raw", dek);
  return new Uint8Array(rawKey);
}

async function importDek(rawKey: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", toArrayBuffer(rawKey), { name: "AES-GCM", length: AES_KEY_LENGTH }, true, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptBytes(payload: Uint8Array, key: CryptoKey): Promise<{ iv: string; ciphertext: string }> {
  const iv = randomBytes(GCM_IV_BYTES);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(payload),
  );

  return {
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

async function decryptBytes(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey,
  failureMessage: string,
): Promise<Uint8Array> {
  try {
    const ciphertext = base64ToBytes(ciphertextBase64);
    const iv = base64ToBytes(ivBase64);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext),
    );

    return new Uint8Array(plaintext);
  } catch (error) {
    throw normalizeError(failureMessage, error);
  }
}

async function encryptString(plaintext: string, key: CryptoKey): Promise<{ iv: string; ciphertext: string }> {
  return encryptBytes(textEncoder.encode(plaintext), key);
}

async function decryptString(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey,
  failureMessage: string,
): Promise<string> {
  const plaintext = await decryptBytes(ciphertextBase64, ivBase64, key, failureMessage);

  return textDecoder.decode(plaintext);
}

async function deriveRecoveryKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  return deriveRecoveryKeyWithParams(passphrase, {
    ...RECOVERY_SCRYPT_PARAMS,
    salt: bytesToBase64(salt),
  });
}

async function deriveRecoveryKeyWithParams(passphrase: string, params: ScryptKdf): Promise<CryptoKey> {
  const derivedKey = await deriveScryptBytes({
    password: textEncoder.encode(passphrase),
    salt: base64ToBytes(params.salt),
    N: params.N,
    r: params.r,
    p: params.p,
    dkLen: params.dkLen,
  });

  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(derivedKey),
    {
      name: "AES-GCM",
      length: AES_KEY_LENGTH,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

async function derivePasskeyKey(prfOutput: BytesLike): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey("raw", toArrayBuffer(prfOutput), "HKDF", false, ["deriveKey"]);

  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(PASSKEY_HKDF_SALT),
      info: toArrayBuffer(PASSKEY_HKDF_INFO),
    },
    keyMaterial,
    {
      name: "AES-GCM",
      length: AES_KEY_LENGTH,
    },
    false,
    ["encrypt", "decrypt"],
  );
}

async function unwrapRecoveryDek(envelope: StoredEnvelope, passphrase: string): Promise<CryptoKey> {
  const recoveryKey = await deriveRecoveryKeyWithParams(passphrase, envelope.recoveryWrap.kdf);
  const rawDek = await decryptBytes(
    envelope.recoveryWrap.ct,
    envelope.recoveryWrap.nonce,
    recoveryKey,
    "Recovery passphrase could not unwrap the stored key.",
  );

  return importDek(rawDek);
}

async function unwrapPasskeyDek(passkeyWrap: PasskeyWrap, prfOutput: BytesLike): Promise<CryptoKey> {
  const passkeyKey = await derivePasskeyKey(prfOutput);
  const rawDek = await decryptBytes(
    passkeyWrap.wrappedKey,
    passkeyWrap.iv,
    passkeyKey,
    "Passkey PRF output could not unwrap the stored key.",
  );

  return importDek(rawDek);
}

export async function createEnvelope(secret: string, passphrase: string): Promise<StoredEnvelope> {
  const dek = await generateDek();
  const [encryptedSecret, rawDek, recoverySalt] = await Promise.all([
    encryptString(secret, dek),
    exportDek(dek),
    Promise.resolve(randomBytes(RECOVERY_SALT_BYTES)),
  ]);

  const recoveryKey = await deriveRecoveryKey(passphrase, recoverySalt);
  const recoveryWrap = await encryptBytes(rawDek, recoveryKey);

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    ciphertext: encryptedSecret.ciphertext,
    ciphertextIv: encryptedSecret.iv,
    recoveryWrap: {
      algorithm: "scrypt-aes-gcm",
      nonce: recoveryWrap.iv,
      ct: recoveryWrap.ciphertext,
      kdf: {
        ...RECOVERY_SCRYPT_PARAMS,
        salt: bytesToBase64(recoverySalt),
      },
    },
  };
}

export async function unlockWithRecovery(
  envelope: StoredEnvelope,
  passphrase: string,
): Promise<{ plaintext: string; dek: CryptoKey }> {
  const dek = await unwrapRecoveryDek(envelope, passphrase);
  const plaintext = await decryptString(
    envelope.ciphertext,
    envelope.ciphertextIv,
    dek,
    "Stored ciphertext could not be decrypted with the recovery-unwrapped key.",
  );

  return { plaintext, dek };
}

export async function addPasskeyWrap(
  envelope: StoredEnvelope,
  dek: CryptoKey,
  credentialId: string,
  prfInput: Uint8Array,
  prfOutput: Uint8Array,
): Promise<StoredEnvelope> {
  const passkeyKey = await derivePasskeyKey(prfOutput);
  const rawDek = await exportDek(dek);
  const wrapped = await encryptBytes(rawDek, passkeyKey);

  return {
    ...envelope,
    passkeyWrap: {
      algorithm: "webauthn-prf-aes-gcm",
      credentialId,
      prfInput: bytesToBase64(prfInput),
      iv: wrapped.iv,
      wrappedKey: wrapped.ciphertext,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function unlockWithPasskey(
  envelope: StoredEnvelope,
  prfOutput: Uint8Array,
): Promise<{ plaintext: string; dek: CryptoKey }> {
  if (!envelope.passkeyWrap) {
    throw new Error("No passkey wrap is stored yet.");
  }

  const dek = await unwrapPasskeyDek(envelope.passkeyWrap, prfOutput);
  const plaintext = await decryptString(
    envelope.ciphertext,
    envelope.ciphertextIv,
    dek,
    "Stored ciphertext could not be decrypted with the passkey-unwrapped key.",
  );

  return { plaintext, dek };
}

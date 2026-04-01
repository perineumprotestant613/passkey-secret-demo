export const STORAGE_KEY = "passkey-secret-demo:envelope:v1";

export type UnlockMethod = "recovery" | "passkey";

export interface ScryptKdf {
  name: "scrypt";
  salt: string;
  N: number;
  r: number;
  p: number;
  dkLen: number;
  maxmem?: number;
}

export interface RecoveryWrap {
  algorithm: "scrypt-aes-gcm";
  nonce: string;
  ct: string;
  kdf: ScryptKdf;
}

export interface PasskeyWrap {
  algorithm: "webauthn-prf-aes-gcm";
  credentialId: string;
  prfInput: string;
  iv: string;
  wrappedKey: string;
  createdAt: string;
}

export interface StoredEnvelope {
  version: 1;
  createdAt: string;
  ciphertext: string;
  ciphertextIv: string;
  recoveryWrap: RecoveryWrap;
  passkeyWrap?: PasskeyWrap;
}

export interface DemoSession {
  plaintext: string;
  unlockedWith: UnlockMethod;
  unlockedAt: string;
}

export interface PasskeyRegistration {
  credentialId: string;
  prfCreateSupported: boolean | null;
  prfOutput?: Uint8Array;
}

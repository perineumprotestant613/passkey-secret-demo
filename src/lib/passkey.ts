import { base64urlToBytes, bytesToBase64url } from "./base64.ts";
import type { PasskeyRegistration } from "./types.ts";

const RP_NAME = "Passkey Secret Demo";
const PASSKEY_TIMEOUT_MS = 60_000;
type BytesLike = ArrayBuffer | ArrayBufferView<ArrayBufferLike>;

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function toArrayBuffer(value: BytesLike): ArrayBuffer {
  if (value instanceof ArrayBuffer) {
    return value.slice(0);
  }

  const source = new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  const copy = new Uint8Array(source.byteLength);
  copy.set(source);
  return copy.buffer as ArrayBuffer;
}

function toUint8Array(value: BytesLike): Uint8Array {
  return new Uint8Array(toArrayBuffer(value));
}

function ensureWebAuthnSupport(): void {
  if (!window.isSecureContext) {
    throw new Error("Passkeys require a secure context. Use https:// or http://localhost.");
  }

  if (!("credentials" in navigator) || typeof PublicKeyCredential === "undefined") {
    throw new Error("WebAuthn is not available in this browser.");
  }
}

export function getSupportSnapshot(): {
  secureContext: boolean;
  webauthn: boolean;
} {
  return {
    secureContext: window.isSecureContext,
    webauthn: typeof PublicKeyCredential !== "undefined",
  };
}

export async function registerPasskey(prfInput: Uint8Array): Promise<PasskeyRegistration> {
  ensureWebAuthnSupport();

  const credential = await navigator.credentials.create({
    publicKey: {
      rp: { name: RP_NAME },
      user: {
        id: toArrayBuffer(randomBytes(16)),
        name: `local-demo-${Date.now()}@example.com`,
        displayName: "Local-only demo credential",
      },
      challenge: toArrayBuffer(randomBytes(32)),
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      timeout: PASSKEY_TIMEOUT_MS,
      attestation: "none",
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      extensions: {
        prf: {
          eval: {
            first: toArrayBuffer(prfInput),
          },
        },
      },
    },
  });

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("Browser did not return a public key credential.");
  }

  const prfOutput = credential.getClientExtensionResults().prf?.results?.first;

  return {
    credentialId: bytesToBase64url(new Uint8Array(credential.rawId)),
    prfCreateSupported: credential.getClientExtensionResults().prf?.enabled ?? null,
    prfOutput: prfOutput ? toUint8Array(prfOutput) : undefined,
  };
}

export async function evaluatePrf(credentialId: string, prfInput: Uint8Array): Promise<Uint8Array> {
  ensureWebAuthnSupport();

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: toArrayBuffer(randomBytes(32)),
      timeout: PASSKEY_TIMEOUT_MS,
      allowCredentials: [
        {
          type: "public-key",
          id: toArrayBuffer(base64urlToBytes(credentialId)),
        },
      ],
      userVerification: "required",
      extensions: {
        prf: {
          eval: {
            first: toArrayBuffer(prfInput),
          },
        },
      },
    },
  });

  if (!(assertion instanceof PublicKeyCredential)) {
    throw new Error("Browser did not return a public key assertion.");
  }

  const result = assertion.getClientExtensionResults().prf?.results?.first;

  if (!result) {
    throw new Error(
      "This credential did not return a PRF output. Try a recent Chromium-based browser with passkey PRF support.",
    );
  }

  return toUint8Array(result);
}

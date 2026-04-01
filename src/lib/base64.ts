function encodeBinary(binary: string): string {
  return btoa(binary);
}

function decodeBinary(base64: string): string {
  return atob(base64);
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";

  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }

  return encodeBinary(binary);
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = decodeBinary(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

export function bytesToBase64url(bytes: Uint8Array): string {
  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function base64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  const base64 = remainder === 0 ? padded : `${padded}${"=".repeat(4 - remainder)}`;

  return base64ToBytes(base64);
}

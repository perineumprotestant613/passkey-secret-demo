import { STORAGE_KEY, type StoredEnvelope } from "./types.ts";

export function loadEnvelope(): StoredEnvelope | null {
  const rawValue = localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredEnvelope;
  } catch {
    return null;
  }
}

export function saveEnvelope(envelope: StoredEnvelope): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
}

export function clearEnvelope(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function readRawStorageValue(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

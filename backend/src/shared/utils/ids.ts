import { randomBytes, randomUUID } from "node:crypto";

export function randomId(prefix: string): string {
  return `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function documentNumber(prefix: string): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${y}${m}${d}-${suffix}`;
}

export const DOCUMENT_NUMBER_MAX_ATTEMPTS = 8;

export function isDocumentNumberConflict(error: { code?: string; message?: string; details?: string | null; hint?: string | null } | null): boolean {
  if (!error || error.code !== "23505") return false;

  return [error.message, error.details, error.hint].some((value) => String(value ?? "").toLowerCase().includes("number"));
}

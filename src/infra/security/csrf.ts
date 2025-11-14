import { CSRF_HEADER_NAME } from "@src/core/config/security";
import { randomUUID, createHash } from "crypto";
export function generateCsrfSecret() {
  return createHash("sha256").update(randomUUID()).digest("hex");
}
export function extractCsrfToken(h: Headers) {
  return h.get(CSRF_HEADER_NAME) || "";
}
export function validateCsrfToken(secret?: string, token?: string) {
  if (!secret || !token) return false;
  return secret === token;
}
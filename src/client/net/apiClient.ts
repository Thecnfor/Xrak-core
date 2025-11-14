import ky from "ky";
import { enqueueOutbox, setResource, getResource } from "@client/storage/indexeddb";
function genId() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return Array.from(a).map((x) => x.toString(16).padStart(2, "0")).join("");
}
const client = ky.create({ timeout: 10000, retry: 0 });
export async function getJson<T>(endpoint: string, resource: string, key: string) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    const c = await getResource(resource, key);
    return (c?.data as T) ?? null;
  }
  try {
    const r = await client.get(endpoint).json<T>();
    await setResource(resource, key, r);
    return r;
  } catch {
    const c = await getResource(resource, key);
    return (c?.data as T) ?? null;
  }
}
export async function postJson(endpoint: string, body: unknown, headers?: Record<string, string>) {
  const opId = genId();
  const h = { "content-type": "application/json", "X-Idempotency-Key": opId, ...(headers ?? {}) };
  const swActive = typeof navigator !== "undefined" && !!navigator.serviceWorker && !!navigator.serviceWorker.controller;
  if (typeof navigator !== "undefined" && navigator.onLine === false && swActive) {
    try { await client.post(endpoint, { json: body, headers: h }); } catch {}
    return { queued: true };
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    await enqueueOutbox({ opId, endpoint, method: "POST", body, headers: h, createdAt: Date.now(), attempts: 0, status: "pending" });
    return { queued: true };
  }
  try {
    const r = await client.post(endpoint, { json: body, headers: h });
    return { ok: r.ok };
  } catch {
    if (!swActive) await enqueueOutbox({ opId, endpoint, method: "POST", body, headers: h, createdAt: Date.now(), attempts: 0, status: "pending" });
    return { queued: true };
  }
}
export async function putJson(endpoint: string, body: unknown, headers?: Record<string, string>) {
  const opId = genId();
  const h = { "content-type": "application/json", "X-Idempotency-Key": opId, ...(headers ?? {}) };
  const swActive = typeof navigator !== "undefined" && !!navigator.serviceWorker && !!navigator.serviceWorker.controller;
  if (typeof navigator !== "undefined" && navigator.onLine === false && swActive) { try { await client.put(endpoint, { json: body, headers: h }); } catch {} return { queued: true }; }
  if (typeof navigator !== "undefined" && navigator.onLine === false) { await enqueueOutbox({ opId, endpoint, method: "PUT", body, headers: h, createdAt: Date.now(), attempts: 0, status: "pending" }); return { queued: true }; }
  try { const r = await client.put(endpoint, { json: body, headers: h }); return { ok: r.ok }; } catch { if (!swActive) await enqueueOutbox({ opId, endpoint, method: "PUT", body, headers: h, createdAt: Date.now(), attempts: 0, status: "pending" }); return { queued: true }; }
}
export async function patchJson(endpoint: string, body: unknown, headers?: Record<string, string>) {
  const opId = genId();
  const h = { "content-type": "application/json", "X-Idempotency-Key": opId, ...(headers ?? {}) };
  const swActive = typeof navigator !== "undefined" && !!navigator.serviceWorker && !!navigator.serviceWorker.controller;
  if (typeof navigator !== "undefined" && navigator.onLine === false && swActive) { try { await client.patch(endpoint, { json: body, headers: h }); } catch {} return { queued: true }; }
  if (typeof navigator !== "undefined" && navigator.onLine === false) { await enqueueOutbox({ opId, endpoint, method: "PATCH", body, headers: h, createdAt: Date.now(), attempts: 0, status: "pending" }); return { queued: true }; }
  try { const r = await client.patch(endpoint, { json: body, headers: h }); return { ok: r.ok }; } catch { if (!swActive) await enqueueOutbox({ opId, endpoint, method: "PATCH", body, headers: h, createdAt: Date.now(), attempts: 0, status: "pending" }); return { queued: true }; }
}
export async function deleteJson(endpoint: string, headers?: Record<string, string>) {
  const opId = genId();
  const h = { "X-Idempotency-Key": opId, ...(headers ?? {}) };
  const swActive = typeof navigator !== "undefined" && !!navigator.serviceWorker && !!navigator.serviceWorker.controller;
  if (typeof navigator !== "undefined" && navigator.onLine === false && swActive) { try { await client.delete(endpoint, { headers: h }); } catch {} return { queued: true }; }
  if (typeof navigator !== "undefined" && navigator.onLine === false) { await enqueueOutbox({ opId, endpoint, method: "DELETE", headers: h, createdAt: Date.now(), attempts: 0, status: "pending" }); return { queued: true }; }
  try { const r = await client.delete(endpoint, { headers: h }); return { ok: r.ok }; } catch { if (!swActive) await enqueueOutbox({ opId, endpoint, method: "DELETE", headers: h, createdAt: Date.now(), attempts: 0, status: "pending" }); return { queued: true }; }
}
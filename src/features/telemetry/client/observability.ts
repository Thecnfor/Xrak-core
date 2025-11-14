import { postJson } from "@client/net/apiClient";
export async function trackEvent(name: string, payload?: unknown) {
  try { await postJson("/api/telemetry/events", { name, payload }); } catch {}
}
export async function log(level: string, msg: string, meta?: unknown) {
  try { await postJson("/api/telemetry/logs", { level, msg, meta }); } catch {}
}
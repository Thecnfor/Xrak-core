import { insertLog, insertEvent } from "./TelemetryRepo";
export async function recordLog(level: string, msg: string, meta?: unknown) {
  await insertLog(level, msg, meta);
}
export async function recordEvent(name: string, payload?: unknown) {
  await insertEvent(name, payload);
}
export async function recordRequestLog(meta: { path: string; method: string; status: number; duration: number }) {
  await recordLog("info", "api_request", meta);
}
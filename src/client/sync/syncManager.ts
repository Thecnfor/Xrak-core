import { listOutbox, updateOutboxStatus, ensureSyncState, setSyncState } from "@client/storage/indexeddb";
import ky from "ky";
import { awaitLeadership, isLeader } from "@src/core/sync/leader";
let running = false;
let timer: number | undefined;
const MAX_ATTEMPTS = 8;
async function flush() {
  const items = await listOutbox(20);
  for (const it of items) {
    try {
      const r = await ky(it.endpoint, { method: it.method, json: it.body, headers: it.headers, timeout: 10000 });
      await updateOutboxStatus(it.opId, r.ok ? "done" : "pending", it.attempts + 1);
    } catch {
      const next = it.attempts + 1;
      await updateOutboxStatus(it.opId, next >= MAX_ATTEMPTS ? "dead" : "pending", next);
    }
  }
}
async function tick() {
  await setSyncState({ lastOnlineAt: Date.now(), backoffMs: 1000 });
  await flush();
  schedule(2000);
}
function schedule(ms: number) {
  if (typeof window === "undefined") return;
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(tick, ms);
}
export async function start() {
  if (running) return;
  running = true;
  await ensureSyncState();
  if (typeof window !== "undefined") {
    await awaitLeadership();
    if (!isLeader()) return;
  }
  schedule(1000);
  if (typeof window !== "undefined") {
    window.addEventListener("online", () => schedule(500));
    window.addEventListener("offline", () => schedule(2000));
  }
}
export function stop() {
  running = false;
  if (typeof window !== "undefined" && timer) window.clearTimeout(timer);
}
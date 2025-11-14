import Dexie, { Table } from "dexie";
export type PrefsUserRow = { userId: number; data: unknown; version?: string; updatedAt?: number };
export type PrefsAppRow = { appKey: string; data: unknown; version?: string; updatedAt?: number };
export type ResourceCacheRow = { resource: string; key: string; data: unknown; version?: string; updatedAt?: number };
export type OutboxRow = { opId: string; endpoint: string; method: string; body?: unknown; headers?: Record<string, string>; createdAt: number; attempts: number; status: string };
export type SyncStateRow = { id: string; lastOnlineAt?: number; nextPollAt?: number; backoffMs?: number };
class XrakLocalDb extends Dexie {
  prefs_user!: Table<PrefsUserRow, number>;
  prefs_app_cache!: Table<PrefsAppRow, string>;
  resource_cache!: Table<ResourceCacheRow, string>;
  outbox!: Table<OutboxRow, string>;
  sync_state!: Table<SyncStateRow, string>;
  constructor() {
    super("xrak_local_v1");
    this.version(1).stores({
      prefs_user: "userId",
      prefs_app_cache: "appKey",
      resource_cache: "[resource+key]",
      outbox: "opId,status,createdAt",
      sync_state: "id",
    });
  }
}
export const db = new XrakLocalDb();
export async function getResource(resource: string, key: string) {
  return db.resource_cache.get({ resource, key });
}
export async function setResource(resource: string, key: string, data: unknown, version?: string) {
  const updatedAt = Date.now();
  await db.resource_cache.put({ resource, key, data, version, updatedAt });
}
export async function enqueueOutbox(row: OutboxRow) {
  await db.outbox.put(row);
}
export async function listOutbox(limit = 50) {
  return db.outbox.where("status").equals("pending").limit(limit).toArray();
}
export async function updateOutboxStatus(opId: string, status: string, attempts: number) {
  await db.outbox.update(opId, { status, attempts });
}
export async function ensureSyncState() {
  const id = "sync";
  const s = await db.sync_state.get(id);
  if (!s) await db.sync_state.put({ id, backoffMs: 1000 });
}
export async function getSyncState() {
  const r = await db.sync_state.get("sync");
  return r ?? null;
}
export async function setSyncState(state: Partial<SyncStateRow>) {
  const id = "sync";
  const s = await db.sync_state.get(id);
  await db.sync_state.put({ id, lastOnlineAt: state.lastOnlineAt ?? s?.lastOnlineAt, nextPollAt: state.nextPollAt ?? s?.nextPollAt, backoffMs: state.backoffMs ?? s?.backoffMs });
}
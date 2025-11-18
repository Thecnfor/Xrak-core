import { createIndexDB } from "../adapters/indexdb"
import { INDEXDB } from "../core/config"

type Priority = "HIGH" | "MEDIUM" | "LOW"

export const syncService = {
  async enqueue(action: string, data: unknown, priority: Priority = "MEDIUM") {
    if (typeof window === "undefined") return
    const idb = await createIndexDB({ name: INDEXDB.NAME, version: INDEXDB.VERSION, stores: [{ name: "syncQueue", keyPath: "id", autoIncrement: true, indexes: [{ name: "timestamp", keyPath: "timestamp" }, { name: "status", keyPath: "status" }, { name: "priority", keyPath: "priority" }] }, { name: "syncMetadata", keyPath: "key" }] })
    const task = { action, data, timestamp: new Date().toISOString(), status: "pending", priority, retryCount: 0 }
    await idb.set("syncQueue", Date.now(), task)
  },
  async getQueue() {
    if (typeof window === "undefined") return []
    const idb = await createIndexDB({ name: INDEXDB.NAME, version: INDEXDB.VERSION, stores: [{ name: "syncQueue" }] })
    return idb.getAll("syncQueue")
  },
  async clearFailed() {
    if (typeof window === "undefined") return
    const idb = await createIndexDB({ name: INDEXDB.NAME, version: INDEXDB.VERSION, stores: [{ name: "syncQueue" }] })
    await idb.clear("syncQueue")
  },
}
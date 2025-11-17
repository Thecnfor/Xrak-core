type Value = unknown

type OpenOptions = {
  name?: string
  version?: number
  stores?: readonly string[]
}

function isClient() {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined"
}

async function openDB({ name = "app", version = 1, stores = ["kv"] }: OpenOptions): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!isClient()) {
      reject(new Error("IndexedDB unavailable"))
      return
    }
    const req = indexedDB.open(name, version)
    req.onupgradeneeded = () => {
      const db = req.result
      stores.forEach((s) => {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s)
      })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

function tx(db: IDBDatabase, store: string, mode: IDBTransactionMode) {
  return db.transaction(store, mode).objectStore(store)
}

export type IndexDB = {
  get: (store: string, key: IDBValidKey) => Promise<Value | undefined>
  set: (store: string, key: IDBValidKey, value: Value) => Promise<void>
  del: (store: string, key: IDBValidKey) => Promise<void>
  clear: (store: string) => Promise<void>
  close: () => void
}

export async function createIndexDB(opts?: OpenOptions): Promise<IndexDB> {
  const db = await openDB(opts ?? {})
  async function get(store: string, key: IDBValidKey): Promise<Value | undefined> {
    return new Promise((resolve, reject) => {
      const r = tx(db, store, "readonly").get(key)
      r.onsuccess = () => resolve(r.result as Value | undefined)
      r.onerror = () => reject(r.error)
    })
  }
  async function set(store: string, key: IDBValidKey, value: Value): Promise<void> {
    return new Promise((resolve, reject) => {
      const r = tx(db, store, "readwrite").put(value, key)
      r.onsuccess = () => resolve()
      r.onerror = () => reject(r.error)
    })
  }
  async function del(store: string, key: IDBValidKey): Promise<void> {
    return new Promise((resolve, reject) => {
      const r = tx(db, store, "readwrite").delete(key)
      r.onsuccess = () => resolve()
      r.onerror = () => reject(r.error)
    })
  }
  async function clear(store: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const r = tx(db, store, "readwrite").clear()
      r.onsuccess = () => resolve()
      r.onerror = () => reject(r.error)
    })
  }
  function close() {
    db.close()
  }
  return { get, set, del, clear, close }
}
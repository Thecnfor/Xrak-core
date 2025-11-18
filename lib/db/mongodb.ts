import { MongoClient, Db } from "mongodb"
import { MONGO } from "./config"

declare global {
  var __mongoClient: MongoClient | undefined
}

export async function getMongoClient(): Promise<MongoClient> {
  if (!globalThis.__mongoClient) {
    const client = new MongoClient(String(MONGO.URI))
    await client.connect()
    globalThis.__mongoClient = client
  }
  return globalThis.__mongoClient as MongoClient
}

export async function getMongoDb(): Promise<Db> {
  const client = await getMongoClient()
  return client.db(String(MONGO.DB_NAME))
}

export async function mongoHealth(): Promise<boolean> {
  try {
    const db = await getMongoDb()
    await db.command({ ping: 1 })
    return true
  } catch {
    return false
  }
}
import { MongoClient } from "mongodb";
import { getEnv } from "@core/config/env";
let client: MongoClient | null = null;
export async function getMongo() {
  if (client) return client;
  const url = getEnv().MONGO_URL;
  client = new MongoClient(url);
  await client.connect();
  return client;
}

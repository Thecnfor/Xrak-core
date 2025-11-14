import { MongoClient } from "mongodb";
let client: MongoClient | null = null;
export async function getMongo() {
  if (client) return client;
  const url = process.env.MONGO_URL as string;
  client = new MongoClient(url);
  await client.connect();
  return client;
}

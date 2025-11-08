// 服务端专用的 MongoDB 封装，按环境变量连接远程/本地实例
import { readMongoEnv } from "./env";

function assertServer() {
  if (typeof window !== "undefined") {
    throw new Error("MongoDB 服务仅允许在服务端/运行时使用");
  }
}

// 采用惰性导入，避免被客户端打包
let _mongodb: typeof import("mongodb") | undefined;
async function ensureDeps() {
  if (!_mongodb) _mongodb = await import("mongodb");
}

type MongoClient = import("mongodb").MongoClient;
type Db = import("mongodb").Db;

declare global {
  // Dev/HMR 单例，避免重复连接
  var __mongo_client__: MongoClient | undefined;
  var __mongo_db__: Db | undefined;
}

// 生成连接字符串（用户名/密码需进行 URI 编码）
function buildMongoUri() {
  const cfg = readMongoEnv();
  const user = encodeURIComponent(cfg.MONGO_USER);
  const pass = encodeURIComponent(cfg.MONGO_PASSWORD);
  return `mongodb://${user}:${pass}@${cfg.host}:${cfg.port}/${cfg.MONGO_DATABASE}`;
}

export async function getMongoClient(): Promise<MongoClient> {
  assertServer();
  await ensureDeps();

  if (global.__mongo_client__) return global.__mongo_client__;
  const uri = buildMongoUri();
  const client = new _mongodb!.MongoClient(uri, {
    // 服务器环境下的合理默认值
    maxPoolSize: 10,
    minPoolSize: 0,
    // 禁用自动重试写入，避免非预期副作用（可按需开启）
    retryWrites: false,
  });
  await client.connect();
  global.__mongo_client__ = client;
  return client;
}

export async function getMongoDb(): Promise<Db> {
  assertServer();
  await ensureDeps();

  if (global.__mongo_db__) return global.__mongo_db__;
  const client = await getMongoClient();
  const cfg = readMongoEnv();
  const db = client.db(cfg.MONGO_DATABASE);
  global.__mongo_db__ = db;
  return db;
}

// 健康检查，便于就绪探针
export async function ping(): Promise<boolean> {
  try {
    const db = await getMongoDb();
    // 简单运行一个命令（空命令返回服务器信息）
    await db.command({ ping: 1 });
    return true;
  } catch {
    return false;
  }
}
// 博客内容工具方法：用于测试页与后续内容模块复用
// 说明：封装 Redis 缓存与数据库读取的降级策略，避免 Redis 不可用导致页面崩溃。

import { getRedisClient } from "@src/services/db/redis";
import { getMongoDb } from "@src/services/db/mongo";

export async function getBlogPage(page: number, pageSize: number) {
  "use server";
  const key = `cache:blog:page:${page}:${pageSize}`;
  let client: Awaited<ReturnType<typeof getRedisClient>> | null = null;
  try {
    client = await getRedisClient();
  } catch {
    client = null;
  }

  if (client) {
    try {
      const cached = await client.get(key);
      if (cached) {
        return JSON.parse(cached) as { items: any[]; page: number; pageSize: number };
      }
    } catch {
      // 缓存失败降级为直读数据库
    }
  }

  try {
    const db = await getMongoDb();
    const col = db.collection("posts");
    const docs = (await col
      .find({}, { projection: { title: 1, slug: 1, createdAt: 1, summary: 1 } })
      .sort({ createdAt: -1 })
      .skip(Math.max(0, (page - 1) * pageSize))
      .limit(pageSize)
      .toArray()) as unknown as Array<{ _id?: unknown; title?: string; slug?: string; createdAt?: unknown; summary?: string }>;
    const items = docs.map((d) => ({
      _id: d._id ? String(d._id) : undefined,
      title: d.title,
      slug: d.slug,
      createdAt: d.createdAt ? String(d.createdAt) : undefined,
      summary: d.summary,
    }));
    const payload = { items, page, pageSize };

  if (client) {
    try {
      await client.set(key, JSON.stringify(payload), { EX: 60 });
    } catch {
      // 设置缓存失败直接忽略
    }
  }
    return payload;
  } catch {
    return { items: [], page, pageSize };
  }
}
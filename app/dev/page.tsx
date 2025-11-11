import React from "react";
import { headers } from "next/headers";
import { getRedisClient } from "@src/services/db/redis";
import { getDeviceList } from "@src/utils/sessionDevices";
import { runDrizzleMigrations, getTableIndexes, getThreeDbStatus, getRecentSessionAudits } from "@src/utils/dbStatus";
import { getCurrentSession } from "@src/utils/authActions";
import { getBlogPage } from "@src/utils/blogContent";
import ClientTestArea from "./ClientTestArea";

// 本页面仅在服务器端渲染，用于测试与验证；工具方法已工程化抽离到 src/utils/*。

// 运行时：Node 专用，确保 mysql2/redis/mongodb 可用
export const runtime = "nodejs";
// 强制动态：便于查看最新数据库状态与会话
export const dynamic = "force-dynamic";

// MySQL：使用 information_schema 列出当前库的表（强类型避免 any）
// 建表/修复结构改为调用 Drizzle 迁移：<form action={runDrizzleMigrations}> 直接复用

// 查询指定表的索引信息，便于在页面展示合规性
// getTableIndexes 已抽离到 src/utils/dbStatus

// MongoDB：列出集合名称
// listMongoCollections 已抽离到 src/utils/dbStatus

// Redis：采样列出部分 Key（SCAN）
// listRedisSampleKeys 已抽离到 src/utils/dbStatus

// CSRF 校验：从表单隐藏字段读取 token，并比对当前会话的 csrfSecret
// assertCsrf 已抽离到 src/utils/authActions

// 已移除未使用的最小测试表创建函数，避免未使用警告

// 服务器动作：注册用户（CSRF + 最小写入）
// registerUser 已抽离到 src/utils/authActions

// 服务器动作：登录（CSRF + 发放 cookie+session，并记录审计）
// loginUser 已抽离到 src/utils/authActions

// 服务器动作：登出（CSRF + 撤销 session）
// logoutUser 已抽离到 src/utils/authActions

// 服务器动作：注销指定设备（会话 SID）
// revokeDevice 已抽离到 src/utils/authActions

// 服务器动作：注销当前用户的全部设备
// revokeAllDevices 已抽离到 src/utils/authActions

// SSR：查询当前用户会话
// getCurrentSession 已抽离到 src/utils/authActions

// SSR：三库状态聚合
// getThreeDbStatus 已抽离到 src/utils/dbStatus

// 查询最近的会话审计日志（便于验证登录/登出行为）
// getRecentSessionAudits 已抽离到 src/utils/dbStatus

export default async function DevPage({
  searchParams,
}: {
  // Next.js 16：searchParams 为 Promise，需要 await 解包
  searchParams: Promise<{ page?: string }>;
}) {
  const status = await getThreeDbStatus();
  const session = await getCurrentSession();
  const audits = await getRecentSessionAudits(10);
  const devices = session && session.userId > 0 ? await getDeviceList(session.userId) : [];
  const sp = await searchParams;
  const page = Number(sp?.page ?? 1) || 1;
  // 合规索引展示：查询三张认证相关表的索引
  const authIndexes = await getTableIndexes(["users", "auth_session_audit", "auth_login_attempts"]);
  // 指标聚合：从 Redis 读取最近延迟与成功率
  async function getAuthMetrics() {
    // 加固：Redis 客户端不可用时返回零值，避免 ECONNREFUSED 导致 SSR 崩溃
    let rc: Awaited<ReturnType<typeof getRedisClient>> | null = null;
    try {
      rc = await getRedisClient();
    } catch {
      rc = null;
    }
    if (!rc) return { total: 0, success: 0, rate: 0, avg: 0, min: 0, max: 0 };
    try {
      const total = Number((await rc.get("metrics:auth:attempts:total")) || 0);
      const success = Number((await rc.get("metrics:auth:attempts:success")) || 0);
      const latencies = (await rc.lRange("metrics:auth:latency", 0, 49)) || [];
      const nums = latencies.map((s: string) => Number(s)).filter((n: number) => Number.isFinite(n));
      const avg = nums.length ? Math.round(nums.reduce((a: number, b: number) => a + b, 0) / nums.length) : 0;
      const max = nums.length ? Math.max(...nums) : 0;
      const min = nums.length ? Math.min(...nums) : 0;
      const rate = total > 0 ? Math.round((success / total) * 100) : 0;
      return { total, success, rate, avg, min, max };
    } catch {
      return { total: 0, success: 0, rate: 0, avg: 0, min: 0, max: 0 };
    }
  }
  const metrics = await getAuthMetrics();

  return (
    <div style={{ padding: 24, background: "#ffffff", color: "#111827" }}>
      {/* 页内仅展示最小而完整的三库状态与登录流程，生产环境可直接复用此结构 */}
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>
        三库状态与认证流程（Dev/Prod 可用）
      </h1>
      <p style={{ opacity: 0.8, marginBottom: 18 }}>
        通过全局包裹（SessionRoot/Query/SEO/Toaster/Observability）保持页面简洁，集成 CSRF + Session + Cookie + 会话审计。
      </p>

      {/* 三库状态展示 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>MySQL</h2>
          {status.mysql.tables.length === 0 ? (
            <p style={{ opacity: 0.8 }}>当前库无表或连接不可用。</p>
          ) : (
            <ul data-testid="list-mysql-tables" style={{ listStyle: "disc", paddingLeft: 20 }}>
              {status.mysql.tables.map((t) => (
                <li key={t} style={{ marginBottom: 4 }}>
                  {t}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>MongoDB</h2>
          {status.mongo.collections.length === 0 ? (
            <p style={{ opacity: 0.8 }}>当前库无集合或连接不可用。</p>
          ) : (
            <ul data-testid="list-mongo-collections" style={{ listStyle: "disc", paddingLeft: 20 }}>
              {status.mongo.collections.map((n) => (
                <li key={n} style={{ marginBottom: 4 }}>
                  {n}
                </li>
              ))}
            </ul>
          )}
        </section>
        <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Redis</h2>
          {status.redis.keys.length === 0 ? (
            <p style={{ opacity: 0.8 }}>暂无可见键或连接不可用。</p>
          ) : (
            <ul data-testid="list-redis-keys" style={{ listStyle: "disc", paddingLeft: 20 }}>
              {status.redis.keys.map((k) => (
                <li key={k} style={{ marginBottom: 4 }}>
                  {k}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* 认证结构与索引 + 指标面板 */}
      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>认证结构与索引</h2>
        <form action={runDrizzleMigrations} style={{ marginBottom: 12 }}>
          <button data-testid="btn-create-auth-schema" type="submit" style={{ padding: "8px 12px" }}>
            重置数据库并执行 Drizzle 迁移（危险，开发环境使用）：users / auth_session_audit / auth_login_attempts / auth_user_devices
          </button>
        </form>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {["users", "auth_session_audit", "auth_login_attempts"].map((t) => (
            <div key={t} style={{ border: "1px dashed #e5e7eb", borderRadius: 8, padding: 10 }}>
              <strong style={{ display: "block", marginBottom: 6 }}>{t}</strong>
              {authIndexes[t] && authIndexes[t].length > 0 ? (
                <ul style={{ listStyle: "disc", paddingLeft: 20 }}>
                  {authIndexes[t].map((i) => (
                    <li key={`${t}:${i}`}>{i}</li>
                  ))}
                </ul>
              ) : (
                <p style={{ opacity: 0.75 }}>未查询到索引或表不存在。</p>
              )}
            </div>
          ))}
        </div>
        <hr style={{ margin: "16px 0" }} />
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>认证监控指标</h3>
        <ul style={{ listStyle: "none", paddingLeft: 0, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <li style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>尝试次数：{metrics.total}</li>
          <li style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>成功次数：{metrics.success}</li>
          <li style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>成功率：{metrics.rate}%</li>
          <li style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>平均响应：{metrics.avg}ms</li>
          <li style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>最慢：{metrics.max}ms</li>
          <li style={{ border: "1px solid #eee", borderRadius: 8, padding: 10 }}>最快：{metrics.min}ms</li>
        </ul>
        <p style={{ fontSize: 12, opacity: 0.7, marginTop: 8 }}>
          会话发放延迟采集自一次登录动作内的 KV 写入与 Cookie 设置，总体目标保持 &lt;200ms。
          匿名会话与 CSRF 令牌由全局挂件（SessionRoot）首次刷新时下发，避免页面阻塞。
        </p>
      </section>

      <hr style={{ margin: "24px 0" }} />
      {/* 内容浏览：MongoDB 博客文章，支持分页与 Redis 缓存（未认证可访问） */}
      {await MongoBlogSection(page)}
      {/* 客户端测试面板：会话/Cookie 由全局 Provider 管理（useSession/Toaster/Theme/Analytics） */}
      <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>客户端测试面板</h2>
        <ClientTestArea />
      </section>
    </div>
  );
}

// MongoDB 内容：分页读取博客文章并使用 Redis 缓存
// getBlogPage 已抽离到 src/utils/blogContent

async function MongoBlogSection(page: number) {
  const pageSize = 5;
  const { items } = await getBlogPage(page, pageSize);
  return (
    <section style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>博客内容（MongoDB）</h2>
      {items.length === 0 ? (
        <p style={{ opacity: 0.8 }}>暂无文章或数据源为空。</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {items.map((p, i) => (
            <li key={(p.slug || p._id || String(i)) + "-blog-item"} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600 }}>{p.title || p.slug}</div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{String(p.createdAt || "")}</div>
              {p.summary ? <div style={{ fontSize: 13 }}>{p.summary}</div> : null}
            </li>
          ))}
        </ul>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <a href={`?page=${Math.max(1, page - 1)}`} style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6 }}>
          上一页
        </a>
        <a href={`?page=${page + 1}`} style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6 }}>
          下一页
        </a>
      </div>
    </section>
  );
}
import React from "react";
import { headers } from "next/headers";
import { SessionProvider, SessionData } from "./SessionProvider";

// Server 组件：读取当前请求的 cookies，并构造 SessionProvider 的初始值
export default async function SessionRoot({ children }: React.PropsWithChildren) {
  const hdrs = await headers();
  const cookieHeader = (typeof hdrs.get === "function" ? hdrs.get("cookie") : "") ?? "";
  const pairs = cookieHeader
    .split(/;\s*/)
    .filter((s) => s.length > 0)
    .map((s) => {
      const idx = s.indexOf("=");
      if (idx === -1) return [s, ""] as [string, string];
      const name = s.slice(0, idx);
      const value = s.slice(idx + 1);
      return [decodeURIComponent(name), decodeURIComponent(value)] as [string, string];
    });
  const initialCookies = Object.fromEntries(pairs) as Record<string, string>;

  let initialSession: SessionData | null = null;
  const raw = initialCookies["session"];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") initialSession = parsed as SessionData;
    } catch {
      // 非 JSON 格式时跳过，交由客户端刷新
    }
  }

  return (
    <SessionProvider initialCookies={initialCookies} initialSession={initialSession}>{children}</SessionProvider>
  );
}
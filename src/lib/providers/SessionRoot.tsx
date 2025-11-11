import React from "react";
import { cookies } from "next/headers";
import { SessionProvider } from "./SessionProvider";
import type { SessionData } from "@src/types/session";
import { getSession } from "@src/services/session/kv";
import { SessionBootstrap } from "./SessionBootstrap";
import { SESSION_COOKIE_NAME } from "@src/config/session";

// Server 组件：读取当前请求的 sid 并预取 KV 会话，构造 SessionProvider 的初始值
export default async function SessionRoot({
  children,
}: React.PropsWithChildren) {
  const c = await cookies();
  // 使用统一 cookie 名称常量，避免硬编码导致不一致
  const sid = c.get?.(SESSION_COOKIE_NAME)?.value ?? undefined;
  const initialCookies: Record<string, string> = sid ? { sid } : {};
  let initialSession: SessionData | null = null;
  if (sid) {
    const ctx = await getSession(sid);
    if (ctx) {
      // 将服务端 KV 会话映射为客户端初始 SessionData（避免类型不匹配）
      initialSession = {
        userId: `${ctx.userId}`,
        roles: ctx.roles as string[] | undefined,
        email: ctx.email,
        displayName: ctx.displayName,
      } as SessionData;
    }
  }

  return (
    <SessionProvider
      initialCookies={initialCookies}
      initialSession={initialSession}
    >
      <SessionBootstrap />
      {children}
    </SessionProvider>
  );
}

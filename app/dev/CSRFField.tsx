// 服务器组件：注入 CSRF 令牌到表单隐藏域
// 说明：会话由全局 SessionRoot + /api/session 下发，在服务端读取 cookie+KV 会话即可获得 csrfSecret。
import React from "react";
import { headers } from "next/headers";
import { getSession } from "@src/services/session/kv";
import { SESSION_COOKIE_NAME } from "@src/config/session";

async function getSid(): Promise<string | null> {
  const h = await headers();
  const cookieStr = h.get("cookie") || "";
  return (
    cookieStr.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))?.[1] ?? null
  );
}

export default async function CSRFField() {
  const sid = await getSid();
  const ctx = sid ? await getSession(sid) : null;
  const token = ctx?.csrfSecret ?? "";
  return <input type="hidden" name="csrf" value={token} />;
}
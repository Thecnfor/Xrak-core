import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@src/config/session";
import { getSession } from "@src/services/session/kv";
import type { SessionContext, Role } from "@src/types/session";

// 鉴权辅助方法集合：统一在服务层封装，供布局、路由与服务端组件复用。

/** 从 Cookies 读取会话并返回常用鉴权标记 */
export async function getAuthFlags(): Promise<{
  isLoggedIn: boolean;
  isAdmin: boolean;
  session: SessionContext | null;
}> {
  const c = await cookies();
  const sid = c.get?.(SESSION_COOKIE_NAME)?.value ?? undefined;
  const session = sid ? await getSession(sid) : null;
  const isLoggedIn = !!session && (session.userId ?? 0) > 0;
  const isAdmin = !!(session?.isAdmin || session?.roles?.includes?.("admin"));
  return { isLoggedIn, isAdmin, session };
}

/** 检查是否拥有指定角色 */
export function hasRole(
  session: SessionContext | null | undefined,
  role: Role,
): boolean {
  return !!session?.roles?.includes?.(role);
}

/** 是否为管理员 */
export function isAdmin(session: SessionContext | null | undefined): boolean {
  return !!(session?.isAdmin || hasRole(session, "admin"));
}

/** 是否为普通用户 */
export function isUser(session: SessionContext | null | undefined): boolean {
  return hasRole(session, "user");
}
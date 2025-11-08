// 会话配置中心：统一 TTL、cookie 名称与选项，避免散落各处导致不一致
export const SESSION_COOKIE_NAME = "sid";
export const SESSION_TTL_SECONDS = 3600; // 默认 1 小时

// Cookie 选项（服务端签发使用）
// 根据环境动态判定是否启用 Secure Cookie：
// - Vercel 环境：preview/production 启用，development 关闭
// - 非 Vercel：NODE_ENV=production 启用，开发关闭
function isSecureCookieEnabled(): boolean {
  const nodeEnv = process.env.NODE_ENV;
  const vercelEnv = process.env.VERCEL_ENV; // development | preview | production
  const isVercel = !!process.env.VERCEL;
  if (isVercel) {
    return vercelEnv === "preview" || vercelEnv === "production";
  }
  return nodeEnv === "production";
}

export const SESSION_COOKIE_OPTIONS: {
  path: string;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  httpOnly: boolean;
} = {
  path: "/",
  sameSite: "lax",
  // 动态控制 Secure，避免本地开发因非 https 导致 Cookie 不生效
  secure: isSecureCookieEnabled(),
  httpOnly: true,
};

// 客户端可见的 Cookie 写入默认（HttpOnly 在客户端不可写）
export const CLIENT_COOKIE_DEFAULTS: {
  path: string;
  sameSite: "lax" | "strict" | "none";
  secure: boolean;
  maxAge?: number;
} = {
  path: "/",
  sameSite: "lax",
  secure: isSecureCookieEnabled(),
  maxAge: SESSION_TTL_SECONDS,
};
// CSRF 工具方法：生成与校验
// 说明：CSRF 秘钥仅存于服务端会话对象（Redis 存储）中，通过 /api/session 下发到客户端内存。
// 客户端在执行敏感写操作时，将该秘钥以请求头 x-csrf-token 回传，服务端进行校验。

/** 生成 CSRF 秘钥（高熵随机字符串） */
export function generateCsrfSecret(): string {
  // 使用 UUID 作为轻量随机源，生产可改为随机字节编码为 Base64URL
  return crypto.randomUUID().replace(/-/g, "");
}

/** 校验 CSRF（固定等值校验） */
export function validateCsrfToken(
  secret: string | undefined,
  token: string | null | undefined
): boolean {
  if (!secret || !token) return false;
  return secret === token;
}

/** 从请求头提取 CSRF Token */
export function extractCsrfToken(headers: Headers): string | null {
  // 统一约定：使用 x-csrf-token
  const token = headers.get("x-csrf-token");
  return token ? token.trim() : null;
}

// 密码哈希与校验（argon2）- 服务器端专用
// 说明：仅在 Node 运行时使用，不可在 Edge 环境调用。

function assertServer() {
  if (typeof window !== "undefined") {
    throw new Error("password service can only run on server");
  }
}

export async function hashPassword(plain: string): Promise<string> {
  assertServer();
  const argon2 = await import("argon2");
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  assertServer();
  const argon2 = await import("argon2");
  return argon2.verify(hash, plain);
}
import { NextRequest } from "next/server";
import { z } from "zod";
import { getLoginRateLimitConfig, setLoginRateLimitConfig } from "@infra/security/config";
import { withApi } from "@server/middleware/api";
import { requireAdmin } from "@server/middleware/admin";
import { ok, badRequest } from "@server/api/respond";
import { ensureOnce } from "../../../../../src/core/services/IdempotencyService";
export async function GET(req: NextRequest) {
  return withApi(req, [requireAdmin], async () => {
    const conf = await getLoginRateLimitConfig();
    return ok(conf);
  });
}
export async function PUT(req: NextRequest) {
  return withApi(req, [requireAdmin], async (ctx) => {
    const body = await ctx.req.json();
    const parsed = z.object({ windowSec: z.number().min(1), max: z.number().min(1) }).safeParse(body);
    if (!parsed.success) return badRequest();
    const key = ctx.req.headers.get("x-idempotency-key") || "";
    if (key) {
      const first = await ensureOnce("idemp:admin:rateLimit", String(parsed.data.windowSec) + "/" + String(parsed.data.max) + ":" + key);
      if (!first) return ok({ ok: true, dedup: true });
    }
    await setLoginRateLimitConfig(parsed.data.windowSec, parsed.data.max);
    return ok({ ok: true });
  });
}

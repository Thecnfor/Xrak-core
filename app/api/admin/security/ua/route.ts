import { NextRequest } from "next/server";
import { z } from "zod";
import { addUaBlacklist, removeUaBlacklist, getUaBlacklist } from "@infra/security/config";
import { withApi } from "@server/middleware/api";
import { requireAdmin } from "@server/middleware/admin";
import { ok } from "@server/api/respond";
import { ensureOnce } from "../../../../../src/core/services/IdempotencyService";
export async function GET(req: NextRequest) {
  return withApi(req, [requireAdmin], async () => {
    const list = await getUaBlacklist();
    return ok({ list });
  });
}
export async function POST(req: NextRequest) {
  return withApi(req, [requireAdmin], async (ctx) => {
    const body = await ctx.req.json();
    const val = z.string().min(1).parse(body?.value);
    const key = ctx.req.headers.get("x-idempotency-key") || "";
    if (key) {
      const first = await ensureOnce("idemp:admin:ua:add", val + ":" + key);
      if (!first) return ok({ ok: true, dedup: true });
    }
    await addUaBlacklist(val);
    return ok({ ok: true });
  });
}
export async function DELETE(req: NextRequest) {
  return withApi(req, [requireAdmin], async (ctx) => {
    const body = await ctx.req.json();
    const val = z.string().min(1).parse(body?.value);
    const key = ctx.req.headers.get("x-idempotency-key") || "";
    if (key) {
      const first = await ensureOnce("idemp:admin:ua:del", val + ":" + key);
      if (!first) return ok({ ok: true, dedup: true });
    }
    await removeUaBlacklist(val);
    return ok({ ok: true });
  });
}

import { NextRequest } from "next/server";
import { recordLog } from "@features/telemetry/server/TelemetryService";
import { ensureOnce } from "@server/services/IdempotencyService";
import { withApi } from "@server/middleware/api";
import { ok } from "@server/api/respond";
export async function POST(req: NextRequest) {
  return withApi(req, [], async (ctx) => {
    const body = await ctx.req.json();
    const key = ctx.req.headers.get("x-idempotency-key") || "";
    if (key) { const first = await ensureOnce("idemp:telemetry:logs", key); if (!first) return ok({ ok: true, dedup: true }); }
    await recordLog(String(body?.level ?? "info"), String(body?.msg ?? "log"), body?.meta);
    return ok({ ok: true });
  });
}

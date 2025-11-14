import { NextRequest } from "next/server";
import { recordEvent } from "@features/telemetry/server/TelemetryService";
import { ensureOnce } from "@server/services/IdempotencyService";
import { withApi } from "@server/middleware/api";
import { ok } from "@server/api/respond";
export async function POST(req: NextRequest) {
  return withApi(req, [], async (ctx) => {
    const body = await ctx.req.json();
    const key = ctx.req.headers.get("x-idempotency-key") || "";
    if (key) { const first = await ensureOnce("idemp:telemetry:events", key); if (!first) return ok({ ok: true, dedup: true }); }
    await recordEvent(String(body?.name ?? "event"), body?.payload);
    return ok({ ok: true });
  });
}

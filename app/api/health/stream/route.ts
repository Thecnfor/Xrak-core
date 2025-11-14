import { NextResponse } from "next/server";
import { createClient } from "redis";
import { ensureHealthMonitor } from "@server/health/monitor";
export async function GET() {
  await ensureHealthMonitor();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const r = createClient({ url: process.env.REDIS_URL });
      r.on("error", () => {});
      await r.connect();
      try {
        const status = await r.get("sys:db:status");
        const atRaw = await r.get("sys:db:lastChange");
        const bRaw = await r.get("sys:db:backoffMs");
        const at = atRaw ? Number(atRaw) : Date.now();
        const backoffMs = bRaw ? Number(bRaw) : 1000;
        controller.enqueue(encoder.encode(`event: status\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status: status || "unknown", at, backoffMs })}\n\n`));
      } catch {}
      await r.subscribe("sys:db:broadcast", (msg) => {
        controller.enqueue(encoder.encode(`event: status\n`));
        controller.enqueue(encoder.encode(`data: ${msg}\n\n`));
      });
      setInterval(() => { controller.enqueue(encoder.encode(`event: ping\n`)); controller.enqueue(encoder.encode(`data: {}\n\n`)); }, 15000);
      // Stream will be closed by runtime when client disconnects
    },
  });
  return new NextResponse(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" } });
}
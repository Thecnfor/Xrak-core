import { NextRequest, NextResponse } from "next/server";
import { run, type Ctx, type Middleware } from "./compose";
import { logging } from "./logging";
import { securityHeaders } from "./securityHeaders";

export async function withApi(req: NextRequest, extra: Middleware[], handler: (ctx: Ctx) => Promise<NextResponse> | NextResponse) {
  const mws = [logging, securityHeaders, ...extra];
  return run({ req }, mws, handler);
}
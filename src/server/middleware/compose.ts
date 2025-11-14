import { NextRequest, NextResponse } from "next/server";
export type Ctx = { req: NextRequest; res?: NextResponse; state?: Record<string, unknown> };
export type Middleware = (ctx: Ctx, next: () => Promise<void>) => Promise<void> | void;
export async function run(ctx: Ctx, middlewares: Middleware[], handler: (ctx: Ctx) => Promise<NextResponse> | NextResponse) {
  let index = -1;
  async function dispatch(i: number): Promise<void> {
    if (i <= index) throw new Error("next_called_twice");
    index = i;
    const fn = middlewares[i];
    if (!fn) {
      const r = await handler(ctx);
      ctx.res = r;
      return;
    }
    await fn(ctx, () => dispatch(i + 1));
  }
  await dispatch(0);
  return ctx.res as NextResponse;
}
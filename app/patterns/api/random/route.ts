import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export async function GET() {
  return NextResponse.json({ value: Math.random(), at: Date.now() });
}

export async function POST(req: NextRequest) {
  revalidateTag("random", "auto");
  return NextResponse.json({ ok: true });
}
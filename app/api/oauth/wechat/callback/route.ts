import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ error: "not_enabled" }, { status: 501 });
}

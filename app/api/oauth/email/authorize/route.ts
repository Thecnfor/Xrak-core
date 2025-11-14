import { NextResponse } from "next/server";
export async function POST() {
  return NextResponse.json({ error: "not_enabled" }, { status: 501 });
}

import { NextResponse } from "next/server";
export function ok<T>(data: T) { return NextResponse.json(data); }
export function badRequest(msg?: string) { return NextResponse.json({ error: msg || "bad_request" }, { status: 400 }); }
export function unauthorized(msg?: string) { return NextResponse.json({ error: msg || "unauthorized" }, { status: 401 }); }
export function forbidden(msg?: string) { return NextResponse.json({ error: msg || "forbidden" }, { status: 403 }); }
export function notFound(msg?: string) { return NextResponse.json({ error: msg || "not_found" }, { status: 404 }); }
export function notImplemented(msg?: string) { return NextResponse.json({ error: msg || "not_implemented" }, { status: 501 }); }
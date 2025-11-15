import { headers } from "next/headers";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export default async function Page() {
  const h = await headers();
  const host = h.get("host") || "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const res = await fetch(`${proto}://${host}/patterns/api/time`, { cache: "no-store" });
  const data = await res.json();
  return (
    <div className="p-6 space-y-2">
      <h1 className="text-xl">SSR</h1>
      <div>time: {String(data.now)}</div>
    </div>
  );
}
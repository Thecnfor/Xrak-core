import { Suspense } from "react";
import { headers } from "next/headers";

async function A() {
  await new Promise((r) => setTimeout(r, 500));
  const h = await headers();
  const host = h.get("host") || "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const res = await fetch(`${proto}://${host}/patterns/api/time`, { cache: "no-store" });
  const data = await res.json();
  return <div>a: {String(data.now)}</div>;
}

async function B() {
  await new Promise((r) => setTimeout(r, 1200));
  const h = await headers();
  const host = h.get("host") || "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const res = await fetch(`${proto}://${host}/patterns/api/time`, { cache: "no-store" });
  const data = await res.json();
  return <div>b: {String(data.now)}</div>;
}

export default async function Page() {
  return (
    <div className="p-6 space-y-2">
      <h1 className="text-xl">SSR Stream</h1>
      <Suspense fallback={<div>loading a</div>}>
        <A />
      </Suspense>
      <Suspense fallback={<div>loading b</div>}>
        <B />
      </Suspense>
    </div>
  );
}
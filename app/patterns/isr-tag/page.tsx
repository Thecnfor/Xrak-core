import { headers } from "next/headers";

export default async function Page() {
  const h = await headers();
  const host = h.get("host") || "";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const res = await fetch(`${proto}://${host}/patterns/api/random`, { next: { tags: ["random"] } });
  const data = await res.json();
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl">ISR Tag</h1>
      <div>value: {String(data.value)}</div>
      <form action={`${proto}://${host}/patterns/api/random`} method="post" className="space-x-2">
        <button type="submit" className="px-3 py-1 rounded bg-black text-white">revalidate</button>
      </form>
    </div>
  );
}
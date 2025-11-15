import DynamicIsland from "../_client/DynamicIsland";

export default async function Page() {
  const now = Date.now();
  return (
    <div className="p-6 space-y-3">
      <h1 className="text-xl">Combo SSR+CSR</h1>
      <div>ssr: {String(now)}</div>
      <DynamicIsland />
    </div>
  );
}
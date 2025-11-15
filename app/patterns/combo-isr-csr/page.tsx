import DynamicIsland from "../_client/DynamicIsland";

export const revalidate = 30;


export default async function Page() {
  const now = Date.now();
  return (
    <div className="p-6 space-y-3">
      <h1 className="text-xl">Combo ISR+CSR</h1>
      <div>isr: {String(now)}</div>
      <DynamicIsland />
    </div>
  );
}
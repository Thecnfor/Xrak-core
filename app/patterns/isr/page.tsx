export const revalidate = 60;

export default async function Page() {
  const now = Date.now();
  return (
    <div className="p-6 space-y-2">
      <h1 className="text-xl">ISR</h1>
      <div>time: {String(now)}</div>
    </div>
  );
}